import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    // Step 1: Tutor
    @Published var tutorName: String = "Marie"

    // Step 2: About You
    @Published var displayName: String = ""
    @Published var nativeLanguage: NativeLanguage = .english
    @Published var selectedTopics: Set<InterestTopic> = []

    // Step 3: Journey
    @Published var currentLevel: CEFRLevel = .a1
    @Published var learningReason: String = ""
    @Published var targetLevel: CEFRLevel = .b1

    // Step 4: Preferences
    @Published var correctionStyle: UserSettings.CorrectionStyle = .duringPauses
    @Published var dailyGoalMinutes: Int = 15
    @Published var ttsSpeed: Double = 1.0

    // State
    @Published var isSaving = false
    @Published var isCompleted = false
    @Published var errorMessage: String?

    private let supabase = SupabaseService.shared

    func toggleTopic(_ topic: InterestTopic) {
        if selectedTopics.contains(topic) {
            selectedTopics.remove(topic)
        } else {
            selectedTopics.insert(topic)
        }
    }

    func saveOnboarding(userId: String, completion: @escaping () -> Void) async {
        isSaving = true
        defer { isSaving = false }

        let settings: [String: Any] = [
            "correction_style": correctionStyle.rawValue,
            "default_mode": "free_conversation",
            "tts_speed": ttsSpeed,
            "target_level": targetLevel.rawValue,
            "daily_goal_minutes": dailyGoalMinutes,
            "tutor_name": tutorName.isEmpty ? "Marie" : tutorName,
            "onboarding_completed": true,
            "native_language": nativeLanguage.rawValue,
            "learning_reason": learningReason.isEmpty ? NSNull() : learningReason,
            "preferred_topics": selectedTopics.map { $0.rawValue },
        ]

        var updates: [String: Any] = [
            "current_level": currentLevel.rawValue,
            "settings": settings,
        ]

        if !displayName.isEmpty {
            updates["display_name"] = displayName
        }

        do {
            _ = try await supabase.updateProfile(userId: userId, updates: updates)
            isCompleted = true
            completion()
        } catch {
            print("[OnboardingVM] Failed to save onboarding: \(error)")
            errorMessage = "Failed to save. Please try again."
            // Still complete to avoid blocking user
            isCompleted = true
            completion()
        }
    }
}
