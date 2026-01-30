import Foundation

// MARK: - Session Mode

enum SessionMode: String, Codable {
    case freeConversation = "free_conversation"
    case structuredLesson = "structured_lesson"
}

// MARK: - Transcript Entry

struct TranscriptEntry: Codable {
    let timestamp: String
    let speaker: String  // "user" or "tutor"
    let text: String
}

// MARK: - Session Summary

struct SessionSummary: Codable {
    let durationMinutes: Int
    let newVocabulary: [NewVocabularyItem]
    let practicedGrammar: [String]
    let correctionsCount: Int
    let highlights: String
    let recommendedFocus: [String]
}

struct NewVocabularyItem: Codable, Identifiable {
    var id: UUID { UUID() }
    let word: String
    let translation: String
    var context: String?

    enum CodingKeys: String, CodingKey {
        case word, translation, context
    }
}

// MARK: - Session (Supabase row)

struct Session: Codable, Identifiable {
    let id: String
    let userId: String
    let startedAt: String
    var endedAt: String?
    let mode: String
    var lessonTopic: String?
    var transcript: [TranscriptEntry]
    var corrections: [Correction]
    var summary: SessionSummary?

    enum CodingKeys: String, CodingKey {
        case id, mode, transcript, corrections, summary
        case userId = "user_id"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case lessonTopic = "lesson_topic"
    }

    var durationMinutes: Int {
        guard let end = endedAt else { return 0 }
        let formatter = ISO8601DateFormatter()
        guard let start = formatter.date(from: startedAt),
              let endDate = formatter.date(from: end) else { return 0 }
        return Int(endDate.timeIntervalSince(start) / 60)
    }

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: startedAt) else { return startedAt }
        let display = DateFormatter()
        display.dateFormat = "EEE, MMM d"
        return display.string(from: date)
    }

    var formattedTime: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: startedAt) else { return "" }
        let display = DateFormatter()
        display.dateFormat = "h:mm a"
        return display.string(from: date)
    }
}
