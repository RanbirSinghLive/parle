import Foundation

// MARK: - CEFR Level

enum CEFRLevel: String, Codable, CaseIterable, Identifiable {
    case a1 = "A1"
    case a2 = "A2"
    case b1 = "B1"
    case b2 = "B2"
    case c1 = "C1"
    case c2 = "C2"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .a1: return "Beginner"
        case .a2: return "Elementary"
        case .b1: return "Intermediate"
        case .b2: return "Upper Intermediate"
        case .c1: return "Advanced"
        case .c2: return "Mastery"
        }
    }

    var longDescription: String {
        switch self {
        case .a1: return "Beginner - knows basic phrases and expressions"
        case .a2: return "Elementary - can handle simple, routine tasks"
        case .b1: return "Intermediate - can deal with most situations while traveling"
        case .b2: return "Upper Intermediate - can interact with fluency and spontaneity"
        case .c1: return "Advanced - can express ideas fluently and spontaneously"
        case .c2: return "Mastery - can understand virtually everything heard or read"
        }
    }
}

// MARK: - Native Language

enum NativeLanguage: String, Codable, CaseIterable, Identifiable {
    case english = "English"
    case spanish = "Spanish"
    case portuguese = "Portuguese"
    case german = "German"
    case italian = "Italian"
    case mandarin = "Mandarin"
    case japanese = "Japanese"
    case korean = "Korean"
    case arabic = "Arabic"
    case other = "Other"

    var id: String { rawValue }
}

// MARK: - Interest Topic

enum InterestTopic: String, Codable, CaseIterable, Identifiable {
    case travel
    case food
    case culture
    case business
    case dailyLife = "daily_life"
    case movies
    case music
    case sports
    case technology
    case history

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .travel: return "Travel"
        case .food: return "Food & Cooking"
        case .culture: return "Quebec Culture"
        case .business: return "Business"
        case .dailyLife: return "Daily Life"
        case .movies: return "Movies & TV"
        case .music: return "Music"
        case .sports: return "Sports"
        case .technology: return "Technology"
        case .history: return "History"
        }
    }

    var icon: String {
        switch self {
        case .travel: return "airplane"
        case .food: return "fork.knife"
        case .culture: return "theatermasks.fill"
        case .business: return "briefcase.fill"
        case .dailyLife: return "house.fill"
        case .movies: return "film.fill"
        case .music: return "music.note"
        case .sports: return "sportscourt.fill"
        case .technology: return "desktopcomputer"
        case .history: return "books.vertical.fill"
        }
    }
}

// MARK: - User Settings

struct UserSettings: Codable {
    var correctionStyle: CorrectionStyle
    var defaultMode: SessionMode
    var ttsSpeed: Double
    var targetLevel: CEFRLevel
    var dailyGoalMinutes: Int
    var tutorName: String?

    // Onboarding fields
    var onboardingCompleted: Bool
    var nativeLanguage: String?
    var learningReason: String?
    var preferredTopics: [String]?

    enum CorrectionStyle: String, Codable {
        case duringPauses = "during_pauses"
        case afterMessage = "after_message"
        case never
    }

    enum CodingKeys: String, CodingKey {
        case correctionStyle = "correction_style"
        case defaultMode = "default_mode"
        case ttsSpeed = "tts_speed"
        case targetLevel = "target_level"
        case dailyGoalMinutes = "daily_goal_minutes"
        case tutorName = "tutor_name"
        case onboardingCompleted = "onboarding_completed"
        case nativeLanguage = "native_language"
        case learningReason = "learning_reason"
        case preferredTopics = "preferred_topics"
    }

    static let `default` = UserSettings(
        correctionStyle: .duringPauses,
        defaultMode: .freeConversation,
        ttsSpeed: 1.0,
        targetLevel: .a1,
        dailyGoalMinutes: 15,
        tutorName: nil,
        onboardingCompleted: false,
        nativeLanguage: nil,
        learningReason: nil,
        preferredTopics: nil
    )
}

// MARK: - Vocabulary Entry

struct VocabularyEntry: Codable, Identifiable {
    var id: UUID { UUID() }
    var word: String
    var translation: String
    var exampleSentence: String?
    var masteryLevel: Int
    var timesSeen: Int
    var timesCorrect: Int
    var lastSeen: String
    var tags: [String]

    enum CodingKeys: String, CodingKey {
        case word, translation, tags
        case exampleSentence = "example_sentence"
        case masteryLevel = "mastery_level"
        case timesSeen = "times_seen"
        case timesCorrect = "times_correct"
        case lastSeen = "last_seen"
    }

    var correctRatio: Double {
        timesSeen > 0 ? Double(timesCorrect) / Double(timesSeen) : 0
    }

    var isTroubleWord: Bool {
        timesSeen >= 3 && (masteryLevel <= 2 || correctRatio < 0.5)
    }
}

// MARK: - Grammar Entry

struct GrammarEntry: Codable, Identifiable {
    var id: UUID { UUID() }
    var rule: String
    var description: String
    var masteryLevel: Int
    var commonErrors: [String]
    var lastPracticed: String

    enum CodingKeys: String, CodingKey {
        case rule, description
        case masteryLevel = "mastery_level"
        case commonErrors = "common_errors"
        case lastPracticed = "last_practiced"
    }
}

// MARK: - Profile (Supabase row)

struct Profile: Codable {
    let id: String
    var email: String?
    var displayName: String?
    var currentLevel: String
    var vocabulary: [VocabularyEntry]
    var grammar: [GrammarEntry]
    var topics: [TopicEntry]?
    var strengths: [String]
    var weaknesses: [String]
    var totalPracticeMinutes: Int
    var streakDays: Int
    var lastSessionDate: String?
    var settings: UserSettings

    enum CodingKeys: String, CodingKey {
        case id, email, vocabulary, grammar, topics, strengths, weaknesses, settings
        case displayName = "display_name"
        case currentLevel = "current_level"
        case totalPracticeMinutes = "total_practice_minutes"
        case streakDays = "streak_days"
        case lastSessionDate = "last_session_date"
    }

    var cefrLevel: CEFRLevel {
        CEFRLevel(rawValue: currentLevel) ?? .a1
    }

    var troubleWords: [VocabularyEntry] {
        vocabulary
            .filter { $0.isTroubleWord }
            .sorted { $0.correctRatio < $1.correctRatio }
            .prefix(10)
            .map { $0 }
    }
}

// MARK: - Topic Entry

struct TopicEntry: Codable {
    var topic: String
    var sessionCount: Int

    enum CodingKeys: String, CodingKey {
        case topic
        case sessionCount = "session_count"
    }
}
