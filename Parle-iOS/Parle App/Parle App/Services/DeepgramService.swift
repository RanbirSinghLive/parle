import Foundation

/// Deepgram STT service — transcribes audio to text.
///
/// Port of lib/stt/deepgram.ts.
/// No MIME type detection needed — always sends audio/mp4 (AAC from AVAudioRecorder).
actor DeepgramService {
    static let shared = DeepgramService()

    private let apiKey = Config.deepgramAPIKey

    struct TranscriptionResult {
        let transcript: String
        let confidence: Double?
    }

    /// Transcribe AAC audio data with multilingual code-switching (French/English).
    func transcribe(audioData: Data) async throws -> TranscriptionResult {
        guard !audioData.isEmpty else {
            throw ParleError.audio("Empty audio data")
        }

        // Build Deepgram URL with parameters
        // Nova-3 with language=multi enables code-switching between French and English
        var components = URLComponents(string: "https://api.deepgram.com/v1/listen")!
        components.queryItems = [
            URLQueryItem(name: "model", value: "nova-3"),
            URLQueryItem(name: "language", value: "multi"),
            URLQueryItem(name: "punctuate", value: "true"),
            URLQueryItem(name: "smart_format", value: "true"),
        ]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")
        // Always audio/mp4 — no MIME type detection dance
        request.setValue("audio/mp4", forHTTPHeaderField: "Content-Type")
        request.httpBody = audioData

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ParleError.api(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                "Deepgram error: \(body)"
            )
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let results = json?["results"] as? [String: Any]
        let channels = results?["channels"] as? [[String: Any]]
        let alternatives = channels?.first?["alternatives"] as? [[String: Any]]
        let best = alternatives?.first

        return TranscriptionResult(
            transcript: best?["transcript"] as? String ?? "",
            confidence: best?["confidence"] as? Double
        )
    }
}
