import Foundation
import SwiftUI
import Combine

/// Manages the voice conversation loop.
///
/// This is the heart of the app. Compare to the PWA's 750-line
/// conversation/page.tsx — the same loop is ~100 lines here because
/// AVFoundation doesn't need gesture-context workarounds.
@MainActor
final class ConversationViewModel: ObservableObject {
    // MARK: - Published State

    @Published var messages: [Message] = []
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var isSpeaking = false
    @Published var sessionId: String?
    @Published var sessionStartTime: Date?
    @Published var isSessionActive = false
    @Published var isEndingSession = false
    @Published var sessionSummary: SessionSummary?
    @Published var microphoneError: String?

    // MARK: - Accumulated Data

    private(set) var allCorrections: [Correction] = []
    private(set) var profile: Profile?

    // MARK: - Services

    let audioService = AudioService()
    private let deepgram = DeepgramService.shared
    private let claude = ClaudeService.shared
    private let elevenLabs = ElevenLabsService.shared
    private let sessionService = SessionService.shared
    private let supabase = SupabaseService.shared

    // MARK: - User Info

    var userId: String?

    // MARK: - Lifecycle

    func setup(userId: String?) async {
        self.userId = userId
        await requestMicrophonePermission()
        await fetchProfile()
    }

    private func requestMicrophonePermission() async {
        let granted = await audioService.requestMicrophonePermission()
        if !granted {
            microphoneError = "Microphone access denied. Go to Settings > Parle > Microphone to enable."
        }
    }

    private func fetchProfile() async {
        guard let userId else { return }
        do {
            profile = try await supabase.fetchProfile(userId: userId)
        } catch {
            print("[ConversationVM] Failed to fetch profile: \(error)")
        }
    }

    // MARK: - Session Management

    func startSession(mode: SessionMode = .freeConversation, topic: String? = nil) async {
        guard let userId else { return }

        messages = []
        allCorrections = []
        sessionSummary = nil
        isEndingSession = false

        do {
            let id = try await sessionService.startSession(
                userId: userId, mode: mode, topic: topic
            )
            sessionId = id
            sessionStartTime = Date()
            isSessionActive = true

            // If structured lesson, add greeting
            if let topic {
                let greeting = "Bonjour! Today we'll practice \"\(topic)\". Let's start! Comment allez-vous?"
                messages.append(Message(role: .tutor, content: greeting))
                await speakText(greeting)
            }
        } catch {
            print("[ConversationVM] Failed to start session: \(error)")
            // Continue with local session
            sessionId = "local-\(Int(Date().timeIntervalSince1970))"
            sessionStartTime = Date()
            isSessionActive = true
        }
    }

    func endSession() async {
        guard let sessionId, let userId, !isEndingSession else { return }
        isEndingSession = true

        let transcript = messages.map { msg in
            TranscriptEntry(
                timestamp: ISO8601DateFormatter().string(from: msg.timestamp),
                speaker: msg.role == .user ? "user" : "tutor",
                text: msg.content
            )
        }

        do {
            let summary = try await sessionService.endSession(
                sessionId: sessionId,
                userId: userId,
                transcript: transcript,
                corrections: allCorrections,
                sessionStartTime: sessionStartTime ?? Date()
            )
            sessionSummary = summary
            isSessionActive = false
            isEndingSession = false

            // Success haptic
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            print("[ConversationVM] Failed to end session: \(error)")
            // Show basic summary
            let duration = Int(Date().timeIntervalSince(sessionStartTime ?? Date()) / 60)
            sessionSummary = SessionSummary(
                durationMinutes: max(1, duration),
                newVocabulary: [],
                practicedGrammar: [],
                correctionsCount: allCorrections.count,
                highlights: "Session completed!",
                recommendedFocus: ["Keep practicing!"]
            )
            isSessionActive = false
            isEndingSession = false
        }
    }

    func clearSession() {
        sessionId = nil
        sessionStartTime = nil
        isSessionActive = false
        sessionSummary = nil
        messages = []
        allCorrections = []
    }

    // MARK: - Recording Start/Stop

    func startRecording() {
        guard isSessionActive else { return }
        do {
            try audioService.startRecording()
            isRecording = true
        } catch {
            print("[ConversationVM] Recording error: \(error)")
            microphoneError = "Failed to start recording: \(error.localizedDescription)"
        }
    }

    func stopRecording() {
        guard let audioData = audioService.stopRecording() else {
            isRecording = false
            return
        }
        isRecording = false

        Task {
            await processRecording(audioData)
        }
    }

    // MARK: - The Conversation Loop

    /// The entire voice conversation pipeline — clean, no iOS workarounds.
    ///
    /// In the PWA this spans ~200 lines with gesture-context management.
    /// Here it's a straightforward async pipeline.
    private func processRecording(_ audioData: Data) async {
        isProcessing = true

        do {
            // Step 1: Transcribe (Deepgram)
            let result = try await deepgram.transcribe(audioData: audioData)
            guard !result.transcript.trimmingCharacters(in: .whitespaces).isEmpty else {
                isProcessing = false
                return
            }

            // Add user message
            messages.append(Message(role: .user, content: result.transcript))

            // Step 2: Get Claude response
            let chatMessages = messages.map { msg in
                ChatMessage(
                    role: msg.role == .user ? "user" : "assistant",
                    content: msg.content
                )
            }

            let response = try await claude.chat(
                messages: Array(chatMessages.dropLast()),  // Exclude the one we're about to send
                userMessage: result.transcript,
                profile: profile,
                tutorName: profile?.settings.tutorName ?? "Parle"
            )

            // Add tutor message
            let tutorMessage = Message(
                role: .tutor,
                content: response.content,
                corrections: response.corrections
            )
            messages.append(tutorMessage)
            allCorrections.append(contentsOf: response.corrections)

            isProcessing = false

            // Step 3: Speak the response
            await speakText(response.content)

        } catch {
            print("[ConversationVM] Conversation error: \(error)")
            isProcessing = false
        }
    }

    // MARK: - TTS

    /// Speak text using ElevenLabs, falling back to Apple TTS.
    private func speakText(_ text: String) async {
        isSpeaking = true
        let speed = Float(profile?.settings.ttsSpeed ?? 1.0)

        do {
            // Try ElevenLabs first
            let audioData = try await elevenLabs.synthesize(text: text)
            print("[ConversationVM] ElevenLabs returned \(audioData.count) bytes, playing at \(speed)x...")
            // Reconfigure audio session for playback (may have been left in recording mode)
            audioService.configureForPlayback()
            try await audioService.play(data: audioData, rate: speed)
            print("[ConversationVM] ElevenLabs playback complete")
        } catch {
            print("[ConversationVM] ElevenLabs TTS failed, using Apple TTS: \(error)")
            // Fallback to Apple's built-in TTS
            await AppleTTSService.shared.speak(text: text, rate: speed)
        }

        isSpeaking = false
    }

    // MARK: - API Messages Helper

    var apiMessages: [ChatMessage] {
        messages.map { msg in
            ChatMessage(
                role: msg.role == .user ? "user" : "assistant",
                content: msg.content
            )
        }
    }
}
