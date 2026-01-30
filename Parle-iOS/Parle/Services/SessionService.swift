import Foundation

/// Manages the session lifecycle: start, end, compress, update profile.
///
/// Port of lib/session/service.ts and lib/session/compression.ts.
actor SessionService {
    static let shared = SessionService()

    private let supabase = SupabaseService.shared
    private let claude = ClaudeService.shared

    // MARK: - Start Session

    func startSession(userId: String, mode: SessionMode, topic: String?) async throws -> String {
        return try await supabase.createSession(userId: userId, mode: mode, topic: topic)
    }

    // MARK: - End Session

    func endSession(
        sessionId: String,
        userId: String,
        transcript: [TranscriptEntry],
        corrections: [Correction],
        sessionStartTime: Date
    ) async throws -> SessionSummary {
        let durationMinutes = max(1, Int(Date().timeIntervalSince(sessionStartTime) / 60))

        // Compress session with Claude
        let summary: SessionSummary
        do {
            summary = try await claude.compressSession(
                transcript: transcript,
                corrections: corrections,
                durationMinutes: durationMinutes
            )
        } catch {
            print("[SessionService] Compression failed, using basic summary: \(error)")
            summary = SessionSummary(
                durationMinutes: durationMinutes,
                newVocabulary: [],
                practicedGrammar: [],
                correctionsCount: corrections.count,
                highlights: "Completed a \(durationMinutes) minute conversation.",
                recommendedFocus: corrections.isEmpty
                    ? ["Keep practicing conversational French"]
                    : ["Review the corrections from this session"]
            )
        }

        // Save session to Supabase
        try await supabase.endSession(
            sessionId: sessionId,
            userId: userId,
            transcript: transcript,
            corrections: corrections,
            summary: summary
        )

        // Update profile with session learnings
        await updateProfileFromSession(
            userId: userId,
            summary: summary,
            corrections: corrections,
            durationMinutes: durationMinutes
        )

        return summary
    }

    // MARK: - Profile Update

    /// Updates learner profile based on session results.
    /// Port of updateProfileFromSession() from lib/session/service.ts.
    private func updateProfileFromSession(
        userId: String,
        summary: SessionSummary,
        corrections: [Correction],
        durationMinutes: Int
    ) async {
        do {
            let profile = try await supabase.fetchProfile(userId: userId)

            let now = Date()
            let today = ISO8601DateFormatter().string(from: now).prefix(10)

            // Calculate streak
            var newStreakDays = profile.streakDays

            if let lastDate = profile.lastSessionDate {
                let calendar = Calendar.current
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                if let last = formatter.date(from: lastDate) {
                    let daysDiff = calendar.dateComponents([.day], from: last, to: now).day ?? 0
                    if daysDiff == 0 {
                        // Same day, streak unchanged
                    } else if daysDiff == 1 {
                        newStreakDays += 1
                    } else {
                        newStreakDays = 1
                    }
                }
            } else {
                newStreakDays = 1
            }

            // Merge new vocabulary
            let existingWords = Set(profile.vocabulary.map { $0.word.lowercased() })
            let newVocab: [[String: Any]] = summary.newVocabulary
                .filter { !existingWords.contains($0.word.lowercased()) }
                .map { v in
                    [
                        "word": v.word,
                        "translation": v.translation,
                        "example_sentence": v.context ?? "",
                        "mastery_level": 1,
                        "times_seen": 1,
                        "times_correct": 0,
                        "last_seen": ISO8601DateFormatter().string(from: now),
                        "tags": [] as [String],
                    ] as [String: Any]
                }

            // Encode existing vocabulary as dictionaries
            let encoder = JSONEncoder()
            let existingVocabData = try encoder.encode(profile.vocabulary)
            var existingVocabDicts = (try JSONSerialization.jsonObject(with: existingVocabData) as? [[String: Any]]) ?? []
            existingVocabDicts.append(contentsOf: newVocab)

            // Extract weaknesses from corrections
            var weaknessUpdates: [String] = []
            let grammarCount = corrections.filter { $0.category == .grammar }.count
            let vocabCount = corrections.filter { $0.category == .vocabulary }.count
            if grammarCount >= 2 { weaknessUpdates.append("Grammar patterns need practice") }
            if vocabCount >= 2 { weaknessUpdates.append("Vocabulary building needed") }

            var allWeaknesses = profile.weaknesses + weaknessUpdates
            allWeaknesses = Array(Set(allWeaknesses)).prefix(5).map { $0 }

            let updates: [String: Any] = [
                "vocabulary": existingVocabDicts,
                "weaknesses": allWeaknesses,
                "total_practice_minutes": profile.totalPracticeMinutes + durationMinutes,
                "streak_days": newStreakDays,
                "last_session_date": String(today),
            ]

            _ = try await supabase.updateProfile(userId: userId, updates: updates)
        } catch {
            print("[SessionService] Failed to update profile: \(error)")
        }
    }
}
