import Foundation

// MARK: - Message Role

enum MessageRole: String, Codable {
    case user
    case tutor
}

// MARK: - Message

struct Message: Identifiable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    var corrections: [Correction]?

    init(role: MessageRole, content: String, corrections: [Correction]? = nil) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.timestamp = Date()
        self.corrections = corrections
    }

    var correctionCount: Int {
        corrections?.count ?? 0
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: timestamp)
    }
}

// MARK: - Correction

struct Correction: Codable, Identifiable {
    var id: UUID { UUID() }
    let original: String
    let corrected: String
    let explanation: String
    let category: CorrectionCategory

    enum CodingKeys: String, CodingKey {
        case original, corrected, explanation, category
    }
}

enum CorrectionCategory: String, Codable {
    case grammar
    case vocabulary
    case pronunciation
    case usage
}

// MARK: - Chat Message (API format)

struct ChatMessage: Codable {
    let role: String  // "user" or "assistant"
    let content: String
}
