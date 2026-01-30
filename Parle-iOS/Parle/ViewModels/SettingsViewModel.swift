import Foundation

/// Settings state management.
@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var profile: Profile?
    @Published var isLoading = true
    @Published var isSaving = false
    @Published var statusMessage: (type: StatusType, text: String)?

    enum StatusType { case success, error }

    private let supabase = SupabaseService.shared

    // MARK: - Fetch

    func fetchProfile(userId: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            profile = try await supabase.fetchProfile(userId: userId)
        } catch {
            statusMessage = (.error, "Failed to load settings")
            print("[SettingsVM] Fetch error: \(error)")
        }
    }

    // MARK: - Update Settings

    func updateSettings(userId: String, updates: [String: Any]) async {
        guard profile != nil else { return }
        isSaving = true
        statusMessage = nil

        do {
            profile = try await supabase.updateProfile(userId: userId, updates: updates)
            statusMessage = (.success, "Settings saved!")
            // Clear success after 2s
            Task {
                try? await Task.sleep(for: .seconds(2))
                if case .success = statusMessage?.type {
                    statusMessage = nil
                }
            }
        } catch {
            statusMessage = (.error, "Failed to save settings")
            print("[SettingsVM] Update error: \(error)")
        }

        isSaving = false
    }

    func updateLevel(userId: String, level: CEFRLevel) async {
        guard var currentProfile = profile else { return }

        var settingsDict: [String: Any] = [:]
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(currentProfile.settings),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            settingsDict = dict
        }
        settingsDict["target_level"] = level.rawValue

        await updateSettings(userId: userId, updates: [
            "current_level": level.rawValue,
            "settings": settingsDict,
        ])
    }

    func updateCorrectionStyle(userId: String, style: UserSettings.CorrectionStyle) async {
        await updateSettingsField(userId: userId, key: "correction_style", value: style.rawValue)
    }

    func updateTTSSpeed(userId: String, speed: Double) async {
        await updateSettingsField(userId: userId, key: "tts_speed", value: speed)
    }

    func updateDailyGoal(userId: String, minutes: Int) async {
        await updateSettingsField(userId: userId, key: "daily_goal_minutes", value: minutes)
    }

    func updateTutorName(userId: String, name: String) async {
        await updateSettingsField(userId: userId, key: "tutor_name", value: name.isEmpty ? NSNull() : name)
    }

    private func updateSettingsField(userId: String, key: String, value: Any) async {
        guard let currentProfile = profile else { return }

        var settingsDict: [String: Any] = [:]
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(currentProfile.settings),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            settingsDict = dict
        }
        settingsDict[key] = value

        await updateSettings(userId: userId, updates: ["settings": settingsDict])
    }
}
