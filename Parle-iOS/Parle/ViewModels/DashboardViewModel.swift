import Foundation

/// Dashboard data management — fetches profile, sessions, derived stats.
@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var profile: Profile?
    @Published var recentSessions: [Session] = []
    @Published var allSessions: [Session] = []
    @Published var todayMinutes: Int = 0
    @Published var isLoading = true

    private let supabase = SupabaseService.shared

    // MARK: - Derived Data

    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Bonjour" }
        if hour < 18 { return "Bon apres-midi" }
        return "Bonsoir"
    }

    var displayName: String {
        profile?.displayName ?? "Learner"
    }

    var dailyGoalMinutes: Int {
        profile?.settings.dailyGoalMinutes ?? 15
    }

    var dailyProgress: Double {
        min(1.0, Double(todayMinutes) / Double(dailyGoalMinutes))
    }

    var troubleWords: [VocabularyEntry] {
        profile?.troubleWords ?? []
    }

    var topicSummaries: [TopicSummary] {
        aggregateTopics(sessions: allSessions)
    }

    var recommendedFocus: [String] {
        let recent = allSessions
            .filter { $0.summary?.recommendedFocus.isEmpty == false }
            .prefix(5)

        var focus = Set<String>()
        for session in recent {
            for item in session.summary?.recommendedFocus ?? [] {
                focus.insert(item)
            }
        }
        return Array(focus).prefix(5).map { $0 }
    }

    var recentCorrectionsCount: Int {
        recentSessions.reduce(0) { $0 + ($1.summary?.correctionsCount ?? 0) }
    }

    // MARK: - Fetch Data

    func fetchData(userId: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Fetch profile and sessions in parallel
            async let profileTask = supabase.fetchProfile(userId: userId)
            async let sessionsTask = supabase.fetchSessions(userId: userId)

            profile = try await profileTask
            let sessions = try await sessionsTask
            allSessions = sessions
            recentSessions = Array(sessions.prefix(3))

            // Calculate today's practice minutes
            let todayStr = ISO8601DateFormatter().string(from: Date()).prefix(10)
            todayMinutes = sessions
                .filter { $0.startedAt.hasPrefix(String(todayStr)) }
                .reduce(0) { $0 + ($1.summary?.durationMinutes ?? 0) }
        } catch {
            print("[DashboardVM] Failed to fetch data: \(error)")
        }
    }

    // MARK: - Topic Aggregation

    struct TopicSummary: Identifiable {
        let id = UUID()
        let topic: String
        let icon: String
        let sessionCount: Int
    }

    private func aggregateTopics(sessions: [Session]) -> [TopicSummary] {
        var counts: [String: Int] = [:]
        for session in sessions {
            let topic = session.lessonTopic ?? "Free Conversation"
            counts[topic, default: 0] += 1
        }
        return counts
            .map { TopicSummary(topic: $0.key, icon: topicIcons[$0.key] ?? "book.fill", sessionCount: $0.value) }
            .sorted { $0.sessionCount > $1.sessionCount }
    }
}
