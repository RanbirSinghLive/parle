import AVFoundation
import Combine
import UIKit

/// Manages all audio recording and playback.
///
/// Replaces ~750 lines of PWA iOS audio workarounds with clean AVFoundation usage.
/// No gesture gates, no AudioContext unlocking, no pre-warmed elements, no tainting.
@MainActor
final class AudioService: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var isPlaying = false

    private var audioRecorder: AVAudioRecorder?
    private var audioPlayer: AVAudioPlayer?
    private var playbackCompletion: (() -> Void)?

    private var recordingURL: URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("parle_recording.m4a")
    }

    override init() {
        super.init()
        configureAudioSession()
    }

    // MARK: - Audio Session

    /// Configure AVAudioSession once. No gesture gates. No unlocking.
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .allowBluetooth]
            )
            try session.setActive(true)
        } catch {
            print("[AudioService] Failed to configure audio session: \(error)")
        }
    }

    // MARK: - Recording

    /// Start recording audio. Always works — no permission dance on subsequent calls.
    func startRecording() throws {
        // Clean up any previous recording
        audioRecorder?.stop()

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16000,           // Optimal for speech recognition
            AVNumberOfChannelsKey: 1,          // Mono for speech
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        audioRecorder = try AVAudioRecorder(url: recordingURL, settings: settings)
        audioRecorder?.record()
        isRecording = true

        // Haptic feedback on start
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Stop recording and return the audio data as AAC/M4A.
    /// Always returns `audio/mp4` — no MIME type detection needed.
    func stopRecording() -> Data? {
        guard let recorder = audioRecorder, recorder.isRecording else { return nil }
        recorder.stop()
        isRecording = false

        // Haptic feedback on stop
        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        return try? Data(contentsOf: recordingURL)
    }

    // MARK: - Playback

    /// Play MP3 data from ElevenLabs TTS. Just works — no gesture context needed.
    func play(data: Data) async throws {
        // Stop any current playback
        stop()

        audioPlayer = try AVAudioPlayer(data: data)
        audioPlayer?.delegate = self
        audioPlayer?.prepareToPlay()

        isPlaying = true

        // Wait for playback to finish
        await withCheckedContinuation { continuation in
            playbackCompletion = {
                continuation.resume()
            }
            audioPlayer?.play()
        }
    }

    /// Stop any currently playing audio.
    func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        playbackCompletion?()
        playbackCompletion = nil
    }

    // MARK: - Permissions

    /// Request microphone permission. Call early in app lifecycle.
    func requestMicrophonePermission() async -> Bool {
        await AVAudioApplication.requestRecordPermission()
    }
}

// MARK: - AVAudioPlayerDelegate

extension AudioService: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(
        _ player: AVAudioPlayer,
        successfully flag: Bool
    ) {
        Task { @MainActor in
            isPlaying = false
            playbackCompletion?()
            playbackCompletion = nil
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(
        _ player: AVAudioPlayer,
        error: Error?
    ) {
        Task { @MainActor in
            print("[AudioService] Playback decode error: \(error?.localizedDescription ?? "unknown")")
            isPlaying = false
            playbackCompletion?()
            playbackCompletion = nil
        }
    }
}
