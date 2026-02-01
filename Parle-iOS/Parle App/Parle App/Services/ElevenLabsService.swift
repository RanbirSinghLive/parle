import Foundation

/// ElevenLabs TTS service — synthesizes text to speech audio.
///
/// Port of lib/tts/elevenlabs.ts.
/// Returns MP3 data that can be played directly by AVAudioPlayer.
actor ElevenLabsService {
    static let shared = ElevenLabsService()

    private let apiKey = Config.elevenLabsAPIKey
    private let voiceId = Config.elevenLabsVoiceID
    private let modelId = Config.elevenLabsModelID

    /// Synthesize French text to MP3 audio.
    func synthesize(text: String) async throws -> Data {
        let url = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceId)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let body: [String: Any] = [
            "text": text,
            "model_id": modelId,
            "voice_settings": [
                "stability": 0.5,
                "similarity_boost": 0.75,
            ],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ParleError.api(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                "ElevenLabs error: \(body)"
            )
        }

        guard !data.isEmpty else {
            throw ParleError.audio("Empty audio buffer from ElevenLabs")
        }

        return data
    }
}

// MARK: - Fallback: Apple TTS

import AVFoundation

/// Apple's built-in text-to-speech as a free fallback.
class AppleTTSService: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = AppleTTSService()

    private let synthesizer = AVSpeechSynthesizer()
    private var completion: (() -> Void)?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(text: String) async {
        await withCheckedContinuation { continuation in
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: "fr-FR")
            utterance.rate = 0.45  // Slightly slower for learners
            utterance.pitchMultiplier = 1.0

            completion = { continuation.resume() }
            synthesizer.speak(utterance)
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        completion?()
        completion = nil
    }

    // MARK: - Delegate

    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didFinish utterance: AVSpeechUtterance
    ) {
        completion?()
        completion = nil
    }
}
