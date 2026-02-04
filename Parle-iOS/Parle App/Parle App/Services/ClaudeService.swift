import Foundation

/// Claude API integration for conversation and session compression.
///
/// Ports the logic from lib/claude/client.ts and lib/claude/prompts.ts.
actor ClaudeService {
    static let shared = ClaudeService()

    private let apiKey = Config.anthropicAPIKey
    private let model = Config.claudeModel

    // MARK: - Chat

    struct ChatResponse {
        let content: String
        let corrections: [Correction]
    }

    func chat(
        messages: [ChatMessage],
        userMessage: String,
        profile: Profile?,
        tutorName: String = "Parle"
    ) async throws -> ChatResponse {
        let systemPrompt = buildSystemPrompt(profile: profile, tutorName: tutorName)

        var anthropicMessages = messages.map { msg in
            ["role": msg.role, "content": msg.content]
        }
        anthropicMessages.append(["role": "user", "content": userMessage])

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 256,
            "system": systemPrompt,
            "messages": anthropicMessages,
        ]

        let data = try JSONSerialization.data(withJSONObject: body)

        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = data

        let (responseData, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let body = String(data: responseData, encoding: .utf8) ?? ""
            throw ParleError.api(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                "Claude API error: \(body)"
            )
        }

        let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        let contentArray = json?["content"] as? [[String: Any]]
        let textBlock = contentArray?.first { ($0["type"] as? String) == "text" }
        let content = textBlock?["text"] as? String ?? ""

        let corrections = parseCorrections(content)

        return ChatResponse(content: content, corrections: corrections)
    }

    // MARK: - Session Compression

    func compressSession(
        transcript: [TranscriptEntry],
        corrections: [Correction],
        durationMinutes: Int
    ) async throws -> SessionSummary {
        let transcriptText = transcript
            .map { "[\($0.speaker.uppercased())]: \($0.text)" }
            .joined(separator: "\n")

        let correctionsText = corrections.isEmpty
            ? "No corrections were made in this session."
            : corrections.map { c in
                "- Corrected: \"\(c.corrected)\" | Explanation: \(c.explanation) | Category: \(c.category.rawValue)"
            }.joined(separator: "\n")

        let prompt = compressionPrompt
            .replacingOccurrences(of: "{transcript}", with: transcriptText)
            .replacingOccurrences(of: "{corrections}", with: correctionsText)
            .replacingOccurrences(of: "{duration}", with: String(durationMinutes))

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 1024,
            "messages": [["role": "user", "content": prompt]],
        ]

        let data = try JSONSerialization.data(withJSONObject: body)

        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = data

        let (responseData, _) = try await URLSession.shared.data(for: request)

        let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        let contentArray = json?["content"] as? [[String: Any]]
        let textBlock = contentArray?.first { ($0["type"] as? String) == "text" }
        let content = textBlock?["text"] as? String ?? "{}"

        // Parse JSON response
        guard let parsed = try? JSONSerialization.jsonObject(with: Data(content.utf8)) as? [String: Any] else {
            return basicSummary(corrections: corrections, durationMinutes: durationMinutes)
        }

        let vocab = (parsed["newVocabulary"] as? [[String: String]])?.map { v in
            NewVocabularyItem(
                word: v["word"] ?? "",
                translation: v["translation"] ?? "",
                context: v["context"]
            )
        } ?? []

        return SessionSummary(
            durationMinutes: durationMinutes,
            newVocabulary: vocab,
            practicedGrammar: parsed["practicedGrammar"] as? [String] ?? [],
            correctionsCount: corrections.count,
            highlights: parsed["highlights"] as? String ?? "Great practice session!",
            recommendedFocus: parsed["recommendedFocus"] as? [String] ?? []
        )
    }

    private func basicSummary(corrections: [Correction], durationMinutes: Int) -> SessionSummary {
        let grammarExplanations = corrections
            .filter { $0.category == .grammar }
            .map { String($0.explanation.prefix(50)) }
        let unique = Array(Set(grammarExplanations))

        return SessionSummary(
            durationMinutes: durationMinutes,
            newVocabulary: [],
            practicedGrammar: unique,
            correctionsCount: corrections.count,
            highlights: "Completed a \(durationMinutes) minute conversation.",
            recommendedFocus: corrections.isEmpty
                ? ["Keep practicing conversational French"]
                : ["Review the corrections from this session"]
        )
    }

    // MARK: - Correction Parsing

    /// Parses corrections from Claude's response using the em dash pattern.
    /// Port of parseCorrections() from lib/claude/client.ts
    private func parseCorrections(_ content: String) -> [Correction] {
        var corrections: [Correction] = []

        // Match pattern: "French text — English explanation."
        let pattern = "([^.!?]+)\\s*—\\s*([^.]+(?:\\.|!))"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))

        for match in matches {
            guard match.numberOfRanges >= 3 else { continue }
            let correctedForm = nsContent.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
            let explanation = nsContent.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespaces)

            // Skip if it looks like a normal sentence rather than a correction
            if explanation.count > 10 && explanation.range(of: "[a-zA-Z]", options: .regularExpression) != nil {
                corrections.append(Correction(
                    original: "",
                    corrected: correctedForm,
                    explanation: explanation,
                    category: categorizeCorrection(explanation)
                ))
            }
        }

        return corrections
    }

    private func categorizeCorrection(_ explanation: String) -> CorrectionCategory {
        let lower = explanation.lowercased()

        if lower.contains("verb") || lower.contains("tense") || lower.contains("conjugat") ||
            lower.contains("agreement") || lower.contains("gender") || lower.contains("plural") ||
            lower.contains("article") {
            return .grammar
        }
        if lower.contains("word") || lower.contains("mean") || lower.contains("say") ||
            lower.contains("term") || lower.contains("expression") {
            return .vocabulary
        }
        if lower.contains("pronounc") || lower.contains("sound") || lower.contains("accent") {
            return .pronunciation
        }
        return .usage
    }

    // MARK: - System Prompt

    /// Builds personalized system prompt — port of buildSystemPrompt() from lib/claude/prompts.ts
    private func buildSystemPrompt(profile: Profile?, tutorName: String) -> String {
        guard let profile = profile else {
            return baseSystemPrompt.replacingOccurrences(of: "{{TUTOR_NAME}}", with: tutorName)
        }

        let levelDesc = CEFRLevel(rawValue: profile.currentLevel)?.longDescription ?? "Beginner to Intermediate"
        let recentVocab = profile.vocabulary.suffix(10)
            .map { "\($0.word) (\($0.translation))" }
            .joined(separator: ", ")
        let weaknesses = profile.weaknesses.isEmpty ? "None identified yet" : profile.weaknesses.joined(separator: ", ")
        let strengths = profile.strengths.isEmpty ? "None identified yet" : profile.strengths.joined(separator: ", ")

        // Onboarding personalization data
        let displayName = profile.displayName ?? "student"
        let nativeLanguage = profile.settings.nativeLanguage ?? "English"
        let learningReason = profile.settings.learningReason ?? "general interest in French"
        let preferredTopics = profile.settings.preferredTopics?.joined(separator: ", ") ?? "various topics"
        let targetLevel = profile.settings.targetLevel.rawValue

        return """
        You are \(tutorName), a friendly and patient Quebec French tutor having a voice conversation with \(displayName).

        ## Quebec French Focus
        You teach Quebec French (francais quebecois), not Metropolitan/European French.
        - Use Quebec vocabulary: "char" (car), "blonde" (girlfriend), "chum" (boyfriend/buddy), "depanneur" (convenience store), "tuque" (winter hat), "pogner" (to catch/get)
        - Use Quebec expressions: "c'est correct" (it's okay), "pantoute" (not at all), "tantot" (earlier/later), "icitte" (here)
        - Note Quebec pronunciation when relevant: "tu" sounds like "tsu", "di" like "dzi" (affrication before i/u)
        - Include Quebec cultural references when natural: depanneurs, poutine, cabane a sucre, Bonhomme Carnaval
        - When there's a difference between Quebec and France French, favor the Quebec form

        ## Student Profile
        - Name: \(displayName)
        - Native Language: \(nativeLanguage)
        - Current Level: \(profile.currentLevel) (\(levelDesc))
        - Target Level: \(targetLevel)
        - Learning Goal: \(learningReason)
        - Preferred Topics: \(preferredTopics)
        - Strengths: \(strengths)
        - Areas to improve: \(weaknesses)
        - Recent vocabulary: \(recentVocab.isEmpty ? "Starting fresh" : recentVocab)
        - Practice streak: \(profile.streakDays) days
        - Total practice time: \(profile.totalPracticeMinutes) minutes

        ## Personalization Guidelines
        - Use \(displayName)'s name occasionally to make the conversation feel personal
        - When appropriate, relate topics to their interests: \(preferredTopics)
        - Remember they're learning French because: \(learningReason)
        - Their native language is \(nativeLanguage), so be aware of common transfer errors from that language
        - They want to reach \(targetLevel) level, so gradually challenge them appropriately

        ## Your Teaching Style
        1. Speak primarily in Quebec French, but explain corrections in English
        2. Match your language complexity to \(profile.currentLevel) level
        3. Keep responses short (2-3 sentences) since this is a voice conversation
        4. When the student makes an error:
           - Gently repeat the correct form
           - Give a brief explanation in English
           - Continue the conversation naturally in French
        5. Be encouraging and praise progress
        6. If the student seems stuck, offer helpful prompts or switch to English briefly
        7. Naturally incorporate vocabulary from their "recent vocabulary" list to reinforce learning
        8. Focus on their areas to improve when opportunities arise naturally

        ## Correction Format
        When correcting, ALWAYS use this exact pattern with the em dash:
        "[Correct form in French] — [Brief explanation in English]. [Continue conversation in French]"

        Example: "On y va ! — We say 'on y va' not 'nous allons la' in casual speech. Alors, qu'est-ce que tu veux faire ?"

        ## Response Guidelines
        - Keep responses concise for voice playback
        - Use natural, conversational Quebec French appropriate for \(profile.currentLevel) level
        - Vary your topics and questions to keep the conversation interesting
        - Occasionally introduce new vocabulary with context

        Remember: This is a spoken conversation, so be natural and conversational.
        """
    }

    private let baseSystemPrompt = """
    You are {{TUTOR_NAME}}, a friendly and patient Quebec French tutor having a voice conversation with your student.

    ## Quebec French Focus
    You teach Quebec French (francais quebecois), not Metropolitan/European French.
    - Use Quebec vocabulary: "char" (car), "blonde" (girlfriend), "chum" (boyfriend/buddy), "depanneur" (convenience store), "tuque" (winter hat), "pogner" (to catch/get)
    - Use Quebec expressions: "c'est correct" (it's okay), "pantoute" (not at all), "tantot" (earlier/later), "icitte" (here)
    - Note Quebec pronunciation when relevant: "tu" sounds like "tsu", "di" like "dzi" (affrication before i/u)

    ## Your Teaching Style
    1. Speak primarily in Quebec French, but explain corrections in English
    2. Keep responses short (2-3 sentences) since this is a voice conversation
    3. When the student makes an error:
       - Gently repeat the correct form
       - Give a brief explanation in English
       - Continue the conversation naturally in French
    4. Be encouraging and praise progress

    ## Correction Format
    When correcting, ALWAYS use this exact pattern with the em dash:
    "[Correct form in French] — [Brief explanation in English]. [Continue conversation in French]"

    Remember: This is a spoken conversation, so be natural and conversational.
    """

    private let compressionPrompt = """
    You are analyzing a French tutoring session to extract learning insights. Analyze the conversation transcript and corrections to provide a structured summary.

    ## Transcript
    {transcript}

    ## Corrections Made
    {corrections}

    ## Session Duration
    {duration} minutes

    Based on this session, provide a JSON response with the following structure:
    {
      "newVocabulary": [
        {
          "word": "French word",
          "translation": "English translation",
          "context": "How it was used in the conversation"
        }
      ],
      "practicedGrammar": ["List of grammar concepts practiced"],
      "highlights": "A brief 1-2 sentence summary of what went well",
      "recommendedFocus": ["Areas to focus on in future sessions"]
    }

    Rules:
    - Only include vocabulary that was NEW or CORRECTED in this session
    - Be specific about grammar concepts (e.g., "passe compose with etre verbs" not just "past tense")
    - Keep highlights encouraging and specific
    - Limit recommendedFocus to 2-3 actionable items
    - Return ONLY valid JSON, no markdown or explanation
    """
}
