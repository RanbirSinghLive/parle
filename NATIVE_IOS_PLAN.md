# Parle — Native iOS App Implementation Plan

## Why Native iOS

The PWA has gone through 6 major iterations of audio workarounds for iOS Safari/Chrome.
The fundamental problem is **gesture-context boundary crossing**: iOS browsers require
audio playback to start during a user gesture, but Parle's pipeline (record → transcribe
→ Claude → TTS → play) is inherently async. Native iOS has no such restriction —
`AVAudioPlayer` plays anytime, no gesture required.

| Problem | PWA | Native iOS |
|---------|-----|------------|
| Gesture-gated audio | 6 workarounds, still unreliable | Not a concept |
| AudioContext unlocking | Complex state machine | Not a concept |
| MIME type detection | 5+ format branches | Always AAC natively |
| Mic permission persistence | Stream kept alive as hack | Persists until revoked |
| Viewport instability | CSS hacks + JS listeners | Native safe areas |
| Background audio | Impossible | AVAudioSession background mode |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  SwiftUI Views                    │
│  ConversationView · DashboardView · SettingsView │
│  HistoryView · LoginView · SignupView            │
├──────────────────────────────────────────────────┤
│              ViewModels (ObservableObject)        │
│  ConversationVM · DashboardVM · ProfileVM        │
│  SessionVM · AuthVM                              │
├──────────────────────────────────────────────────┤
│                  Services Layer                   │
│  AudioService · ClaudeService · DeepgramService  │
│  ElevenLabsService · SessionService              │
│  SupabaseService (Auth + DB)                     │
├──────────────────────────────────────────────────┤
│                  Data Layer                       │
│  Models (Codable structs matching Supabase)       │
│  LearnerProfile · Session · Message · Correction │
└──────────────────────────────────────────────────┘
```

**Same backend.** Vercel API routes and Supabase stay as-is. The iOS app calls
the same endpoints via URLSession. No server changes required.

---

## Phase 1: Project Setup & Audio Core

**Goal:** Xcode project with working audio record + playback. The hardest part of
the PWA becomes the easiest part of the native app.

### 1.1 Xcode Project Setup
- Create new Xcode project: "Parle", iOS 17+, SwiftUI lifecycle
- Add Swift Package dependencies:
  - `supabase-swift` (Supabase auth + database)
  - No other external deps needed — AVFoundation, Speech, URLSession are all system frameworks
- Configure `Info.plist`:
  - `NSMicrophoneUsageDescription`: "Parle needs your microphone to practice French conversation"
  - `NSSpeechRecognitionUsageDescription`: "Parle can use on-device speech recognition as a fallback"
  - `UIBackgroundModes`: `audio` (for TTS playback when screen locks)
- Create folder structure:
  ```
  Parle/
  ├── App/
  │   └── ParleApp.swift           # @main entry point
  ├── Models/
  │   ├── LearnerProfile.swift
  │   ├── Session.swift
  │   ├── Message.swift
  │   ├── Correction.swift
  │   └── VocabularyEntry.swift
  ├── Services/
  │   ├── AudioService.swift
  │   ├── ClaudeService.swift
  │   ├── DeepgramService.swift
  │   ├── ElevenLabsService.swift
  │   ├── SessionService.swift
  │   └── SupabaseService.swift
  ├── ViewModels/
  │   ├── ConversationViewModel.swift
  │   ├── DashboardViewModel.swift
  │   ├── AuthViewModel.swift
  │   └── SettingsViewModel.swift
  ├── Views/
  │   ├── ConversationView.swift
  │   ├── DashboardView.swift
  │   ├── HistoryView.swift
  │   ├── SettingsView.swift
  │   ├── LoginView.swift
  │   ├── SignupView.swift
  │   └── Components/
  │       ├── PushToTalkButton.swift
  │       ├── MessageBubble.swift
  │       ├── TranscriptView.swift
  │       ├── SessionSummaryView.swift
  │       ├── LessonPickerView.swift
  │       ├── TroubleWordsCard.swift
  │       ├── GrammarCard.swift
  │       ├── TopicsCard.swift
  │       └── ProgressCards.swift
  └── Config/
      └── Secrets.swift            # API keys (gitignored)
  ```

### 1.2 AudioService — The Core Win

This replaces 750+ lines of PWA workarounds with ~100 lines of clean Swift.

```swift
import AVFoundation

@MainActor
class AudioService: ObservableObject {
    @Published var isRecording = false
    @Published var isPlaying = false

    private var audioRecorder: AVAudioRecorder?
    private var audioPlayer: AVAudioPlayer?
    private var recordingURL: URL

    init() {
        recordingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("recording.m4a")
        configureSession()
    }

    // ONE-TIME setup. No gesture gates. No unlocking. No tainting.
    private func configureSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default,
                                  options: [.defaultToSpeaker, .allowBluetooth])
        try? session.setActive(true)
    }

    // RECORD — always works, no permission dance
    func startRecording() throws {
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        audioRecorder = try AVAudioRecorder(url: recordingURL, settings: settings)
        audioRecorder?.record()
        isRecording = true
    }

    func stopRecording() -> Data? {
        audioRecorder?.stop()
        isRecording = false
        return try? Data(contentsOf: recordingURL)
    }

    // PLAY — always works, no gesture context needed
    func play(data: Data) throws {
        audioPlayer = try AVAudioPlayer(data: data)
        audioPlayer?.delegate = self // handle didFinishPlaying
        audioPlayer?.play()
        isPlaying = true
    }

    func stop() {
        audioPlayer?.stop()
        isPlaying = false
    }
}
```

**What's gone:**
- `unlockAudioForIOS()` — not needed
- `preWarmedAudioElement` — not needed
- `preWarmedElementPrimed` flag — not needed
- `sharedAudioContext` — not needed
- `AudioContext.resume()` — not needed
- Silent MP3 data URI trick — not needed
- 60-second safety timeout — not needed
- MIME type detection (`getSupportedAudioMimeType()`) — always AAC
- Web Audio API decode + BufferSourceNode — not needed

### 1.3 Verify Audio Pipeline

- Build a minimal test view with a record button and playback button
- Record audio → save to file → play back
- Confirm it works on a real iPhone (not just simulator)
- Test with screen locked, app backgrounded
- Test Bluetooth headphone routing

---

## Phase 2: Data Models & Supabase Integration

**Goal:** All data models defined, Supabase auth working, profile CRUD functional.

### 2.1 Swift Data Models

Port all TypeScript interfaces to Codable structs. These map 1:1 to the existing
Supabase schema — no backend changes needed.

```swift
// Models/LearnerProfile.swift
struct LearnerProfile: Codable {
    var currentLevel: CEFRLevel
    var vocabulary: [VocabularyEntry]
    var grammar: [GrammarEntry]
    var strengths: [String]
    var weaknesses: [String]
    var totalPracticeMinutes: Int
    var streakDays: Int
    var lastSessionDate: Date?
}

enum CEFRLevel: String, Codable, CaseIterable {
    case a1 = "A1", a2 = "A2", b1 = "B1", b2 = "B2", c1 = "C1", c2 = "C2"
}

struct VocabularyEntry: Codable, Identifiable {
    let id: UUID
    var word: String
    var translation: String
    var exampleSentence: String?
    var masteryLevel: Int        // 1-5
    var timesSeen: Int
    var timesCorrect: Int
    var lastSeen: Date
    var tags: [String]
}

// Models/Session.swift
struct Session: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let startedAt: Date
    var endedAt: Date?
    let mode: SessionMode
    var lessonTopic: String?
    var transcript: [TranscriptEntry]
    var corrections: [Correction]
    var summary: SessionSummary?
}

// Models/Message.swift
struct Message: Identifiable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    var corrections: [Correction]?
}

enum MessageRole { case user, tutor }

struct Correction: Codable {
    let original: String
    let corrected: String
    let explanation: String
    let category: CorrectionCategory
}
```

### 2.2 SupabaseService

```swift
import Supabase

class SupabaseService {
    static let shared = SupabaseService()
    let client: SupabaseClient

    init() {
        client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // Auth
    func signUp(email: String, password: String, name: String) async throws -> User
    func signIn(email: String, password: String) async throws -> User
    func signInWithGoogle() async throws -> User
    func signOut() async throws
    var currentUser: User? { get }

    // Profile
    func fetchProfile() async throws -> Profile
    func updateProfile(_ updates: ProfileUpdate) async throws -> Profile

    // Sessions
    func createSession(mode: SessionMode, topic: String?) async throws -> UUID
    func endSession(id: UUID, transcript: [TranscriptEntry],
                    corrections: [Correction]) async throws
    func fetchSessions(limit: Int = 20) async throws -> [Session]
}
```

### 2.3 Auth Flow

- LoginView: email/password + "Sign in with Google" (ASAuthorizationAppleIDButton style)
- SignupView: name + email + password + "Sign up with Google"
- Use `supabase-swift` auth, which handles JWT refresh automatically
- Store session in Keychain via Supabase SDK
- AuthViewModel manages auth state, publishes `isAuthenticated`

---

## Phase 3: API Services (Claude, Deepgram, ElevenLabs)

**Goal:** All three API integrations working. These are straightforward HTTP calls —
identical logic to the PWA, just in Swift.

### 3.1 ClaudeService

```swift
class ClaudeService {
    // Same system prompt from lib/claude/prompts.ts
    // Same personalization injection (level, vocabulary, strengths, etc.)

    func chat(messages: [ChatMessage], userMessage: String,
              profile: LearnerProfile?) async throws -> ChatResponse {
        // POST to Anthropic API (or keep calling /api/chat on Vercel)
        // Parse corrections using same regex pattern
        // Return: content + corrections
    }
}
```

**Decision: Direct API vs. Vercel proxy**

Option A: Call Claude/Deepgram/ElevenLabs APIs directly from the iOS app.
- Pro: Lower latency (no Vercel hop), works offline for Apple Speech
- Con: API keys in the app binary (obfuscated but extractable)
- Acceptable for personal use

Option B: Keep calling Vercel API routes as proxy.
- Pro: API keys stay server-side, existing routes unchanged
- Con: Extra network hop, Vercel cold starts add latency
- Better if you ever distribute the app

**Recommendation:** Option A for personal use (direct API calls). The app is for one
user. Embed keys in a gitignored `Secrets.swift` file.

### 3.2 DeepgramService

```swift
class DeepgramService {
    func transcribe(audioData: Data) async throws -> TranscriptionResult {
        // POST audioData to https://api.deepgram.com/v1/listen
        // Content-Type: audio/mp4 (always, since we record AAC)
        // Query: model=nova-2&language=fr&punctuate=true&smart_format=true
        // Returns: { transcript: String, confidence: Double }
    }
}
```

No MIME type detection needed. Always `audio/mp4`.

### 3.3 ElevenLabsService

```swift
class ElevenLabsService {
    func synthesize(text: String) async throws -> Data {
        // POST to https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
        // Body: { text, model_id, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }
        // Returns: MP3 audio data
    }
}
```

Then play it: `audioService.play(data: mp3Data)`. That's it. No Web Audio API,
no gesture gates, no pre-warming.

### 3.4 Fallback: Apple Speech Framework (Free STT)

```swift
import Speech

class AppleSpeechService {
    func transcribe(audioURL: URL) async throws -> String {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "fr-FR"))!
        let request = SFSpeechURLRecognitionRequest(url: audioURL)
        let result = try await recognizer.recognitionTask(with: request)
        return result.bestTranscription.formattedString
    }
}
```

- On-device, no API cost, works offline
- Quality is decent but not as good as Deepgram for French
- Use as fallback when Deepgram is down or for cost savings

### 3.5 Fallback: AVSpeechSynthesizer (Free TTS)

```swift
import AVFoundation

class AppleTTSService {
    func speak(text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "fr-FR")
        utterance.rate = 0.45 // Slightly slower for learners
        AVSpeechSynthesizer().speak(utterance)
    }
}
```

---

## Phase 4: Conversation View (Main Screen)

**Goal:** The full voice conversation loop working end-to-end.

### 4.1 ConversationViewModel

```swift
@MainActor
class ConversationViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var isSpeaking = false
    @Published var sessionId: UUID?
    @Published var sessionSummary: SessionSummary?

    private let audio = AudioService()
    private let deepgram = DeepgramService()
    private let claude = ClaudeService()
    private let elevenLabs = ElevenLabsService()
    private let sessions = SessionService()

    // THE CONVERSATION LOOP — clean, no workarounds
    func onRecordingComplete() async {
        guard let audioData = audio.stopRecording() else { return }
        isProcessing = true

        // 1. Transcribe (Deepgram)
        let transcript = try await deepgram.transcribe(audioData: audioData)
        guard !transcript.text.isEmpty else { isProcessing = false; return }
        messages.append(Message(role: .user, content: transcript.text))

        // 2. Get Claude response
        let response = try await claude.chat(
            messages: messages.map { ... },
            userMessage: transcript.text,
            profile: profileService.profile
        )
        messages.append(Message(role: .tutor, content: response.content,
                                corrections: response.corrections))
        isProcessing = false

        // 3. Speak response (ElevenLabs)
        isSpeaking = true
        let audioData = try await elevenLabs.synthesize(text: response.content)
        try audio.play(data: audioData)  // ← Just works. No iOS hacks.
        // Wait for playback to finish (AVAudioPlayerDelegate)
        isSpeaking = false
    }
}
```

Compare this to the PWA's 750-line conversation page. The entire flow is ~30 lines.

### 4.2 ConversationView (SwiftUI)

```swift
struct ConversationView: View {
    @StateObject var vm = ConversationViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button("End") { vm.endSession() }
                Spacer()
                Text("Parle").font(.headline)
                Spacer()
                // Timer or status indicator
            }
            .padding()

            // Transcript
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(vm.messages) { message in
                            MessageBubble(message: message)
                        }
                        if vm.isProcessing {
                            TypingIndicator()
                        }
                    }
                    .padding()
                }
                .onChange(of: vm.messages.count) { proxy.scrollTo(vm.messages.last?.id) }
            }

            // Push to Talk Button
            PushToTalkButton(
                isRecording: vm.isRecording,
                isProcessing: vm.isProcessing,
                isSpeaking: vm.isSpeaking,
                onStart: { try vm.audio.startRecording() },
                onStop: { Task { await vm.onRecordingComplete() } }
            )
            .padding(.bottom) // SafeArea handled automatically by SwiftUI
        }
    }
}
```

### 4.3 PushToTalkButton

```swift
struct PushToTalkButton: View {
    let isRecording: Bool
    let isProcessing: Bool
    let isSpeaking: Bool
    let onStart: () throws -> Void
    let onStop: () -> Void

    var body: some View {
        let label = isRecording ? "Recording..." :
                    isProcessing ? "Thinking..." :
                    isSpeaking ? "Listening..." : "Hold to Speak"

        Text(label)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(isRecording ? Color.red : Color.blue)
            .foregroundColor(.white)
            .cornerRadius(16)
            .scaleEffect(isRecording ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: isRecording)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isRecording && !isProcessing && !isSpeaking {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            try? onStart()
                        }
                    }
                    .onEnded { _ in
                        if isRecording {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            onStop()
                        }
                    }
            )
            .disabled(isProcessing || isSpeaking)
            .padding(.horizontal)
    }
}
```

Haptic feedback is native (`UIImpactFeedbackGenerator`), not a `navigator.vibrate` hack.

### 4.4 MessageBubble

```swift
struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(12)
                    .background(message.role == .user ? Color.blue : Color(.systemGray6))
                    .foregroundColor(message.role == .user ? .white : .primary)
                    .cornerRadius(16)

                if let corrections = message.corrections, !corrections.isEmpty {
                    Text("\(corrections.count) correction\(corrections.count > 1 ? "s" : "")")
                        .font(.caption)
                        .foregroundColor(.orange)
                }

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            if message.role == .tutor { Spacer() }
        }
    }
}
```

---

## Phase 5: Dashboard, History, Settings

**Goal:** Feature parity with PWA dashboard, history, and settings screens.

### 5.1 DashboardView

Port from `/app/dashboard/page.tsx`. SwiftUI equivalents:

| PWA Component | SwiftUI Equivalent |
|---|---|
| Greeting (time-based) | `Text(greeting)` with `Calendar.current.component(.hour)` |
| Streak counter | `Label("\(streak) day streak", systemImage: "flame.fill")` |
| Daily goal progress | `ProgressView(value: minutes, total: goal)` |
| Start Conversation button | `NavigationLink` to ConversationView |
| LessonPicker modal | `.sheet(isPresented:)` with LessonPickerView |
| TroubleWordsCard | SwiftUI `Section` with `ForEach` |
| GrammarCard | SwiftUI `Section` with mastery dots |
| Recent sessions | `List` with `ForEach` |

### 5.2 HistoryView

Port from `/app/history/page.tsx`:
- `List` of sessions with `DisclosureGroup` for expandable details
- Each row: date, duration, corrections count, mode
- Expanded: summary highlights, vocabulary badges, grammar list

### 5.3 SettingsView

Port from `/app/settings/page.tsx`:
- `Form` with `Section` groups
- Level picker: `Picker` with segmented style for A1-C2
- Correction style: `Picker` with 3 options
- Speech speed: `Slider(value:in:step:)` 0.5...1.5, step 0.1
- Daily goal: horizontal `ScrollView` of buttons (5/10/15/20/30)
- Tutor name: `TextField`
- Logout: `Button(role: .destructive)`

### 5.4 SessionSummaryView

Port from `/components/SessionSummary.tsx`:
- Checkmark animation (SF Symbol `checkmark.circle.fill`)
- Duration, corrections count, new words count
- Vocabulary list, grammar list, recommendations
- "Start New Session" + "Back to Dashboard" buttons

---

## Phase 6: Session Management & Compression

**Goal:** Full session lifecycle — start, record transcript, compress, update profile.

### 6.1 SessionService (Swift)

Port from `/lib/session/service.ts`:

```swift
class SessionService {
    func startSession(mode: SessionMode, topic: String?) async throws -> UUID
    func endSession(id: UUID, transcript: [TranscriptEntry],
                    corrections: [Correction]) async throws -> SessionSummary
    func compressSession(transcript: [TranscriptEntry],
                         corrections: [Correction],
                         durationMinutes: Int) async throws -> SessionSummary
    func updateProfileFromSession(summary: SessionSummary) async throws
}
```

### 6.2 Session Compression

Same Claude prompt from `/lib/session/compression.ts`. Extracts:
- New vocabulary (word, translation, context)
- Practiced grammar concepts
- Highlights (encouraging summary)
- Recommended focus areas (2-3 items)

### 6.3 Profile Update Logic

Same merge logic from the PWA:
- Add new vocabulary (avoid duplicates by word)
- Update mastery levels for seen vocabulary
- Calculate streak (same day = no change, next day = +1, gap = reset to 1)
- Update weaknesses from correction categories
- Add practice minutes
- Sync to Supabase

---

## Phase 7: Polish & Native Advantages

**Goal:** Leverage native iOS capabilities the PWA couldn't access.

### 7.1 Haptic Feedback (Rich)
- Light impact on record start/stop (already in PushToTalkButton)
- Success notification when session ends
- Warning notification on errors

### 7.2 Background Audio
- `AVAudioSession` with `.playAndRecord` category already supports this
- TTS continues playing if user locks screen or switches apps
- Add `UIBackgroundModes: audio` in Info.plist (done in Phase 1)

### 7.3 Push Notifications (Optional)
- Daily reminder: "Time for your French practice!"
- Streak reminder: "Don't break your 7-day streak!"
- Use `UNUserNotificationCenter` for local notifications (no server needed)

### 7.4 App Icon & Launch Screen
- App icon: "P" in blue circle (match PWA theme #1e40af)
- Launch screen: "Parle" text centered, blue background

### 7.5 Dark Mode
- SwiftUI handles this automatically with semantic colors
- Use `Color(.systemBackground)`, `Color(.label)`, etc.
- Custom colors: define in Asset Catalog with light/dark variants

### 7.6 Accessibility
- VoiceOver labels on all interactive elements
- Dynamic Type support (SwiftUI handles this by default)
- Reduce Motion: skip button scale animation

---

## Phase Summary & Dependency Graph

```
Phase 1: Project Setup & Audio ─────┐
                                     │
Phase 2: Models & Supabase ──────────┤
                                     │
Phase 3: API Services ───────────────┤
                                     ├─→ Phase 4: Conversation View
                                     │
                                     ├─→ Phase 5: Dashboard/History/Settings
                                     │
                                     ├─→ Phase 6: Session Management
                                     │
                                     └─→ Phase 7: Polish & Native Features
```

Phases 1-3 can be developed somewhat in parallel. Phase 4 depends on all three.
Phases 5-7 can proceed in parallel after Phase 4 is working.

---

## What Stays the Same

- **Supabase backend** — same database, same schema, same RLS policies
- **Vercel API routes** — can keep as-is (or call APIs directly from Swift)
- **Claude system prompt** — identical Quebec French tutor personality
- **Session compression prompt** — identical analysis logic
- **Learner profile model** — same fields, same merge logic
- **Lesson topics** — same 12 structured lessons + free conversation

## What's Gone Forever

- `unlockAudioForIOS()`
- `preWarmedAudioElement`
- `preWarmedElementPrimed` flag
- `sharedAudioContext`
- `AudioContext.resume()` during gesture
- Silent MP3 data URI trick
- 60-second safety timeout for audio playback
- `getSupportedAudioMimeType()` detection
- Web Audio API `decodeAudioData` + `BufferSourceNode`
- CSS `--vh` viewport height variable
- `env(safe-area-inset-*)` CSS hacks
- MediaRecorder timeslice workaround
- Stream-alive permission persistence hack
- ~750 lines of iOS audio workaround code

## Cost Impact

| Service | PWA Cost | Native Cost | Change |
|---------|----------|-------------|--------|
| Vercel | Free | Free (keep for web redirect) | Same |
| Supabase | Free | Free (same backend) | Same |
| Claude API | ~$5-10/mo | ~$5-10/mo | Same |
| Deepgram | ~$3-5/mo | ~$3-5/mo (or $0 with Apple Speech) | Same or less |
| ElevenLabs | ~$5/mo | ~$5/mo (or $0 with AVSpeechSynthesizer) | Same or less |
| Apple Developer | $0 | $99/year (or $0 via Xcode direct install) | +$0-99/yr |
| **Total** | **~$15-20/mo** | **~$8-20/mo** | **Same or less** |

Note: For personal use, you can install directly to your iPhone via Xcode without
an Apple Developer account ($0). The $99/year is only needed for App Store distribution
or TestFlight.

---

## Migration Path

1. Build the native iOS app (Phases 1-6)
2. Test on your iPhone alongside the PWA
3. Once native app is stable, stop using the PWA
4. Keep Vercel/Supabase backend running (shared by both)
5. Optionally keep PWA as a landing page / web redirect
