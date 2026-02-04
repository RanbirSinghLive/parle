import SwiftUI

/// User settings screen.
///
/// Port of app/settings/page.tsx.
struct SettingsView: View {
    @StateObject private var vm = SettingsViewModel()
    @EnvironmentObject var authVM: AuthViewModel

    // Local state to prevent flickering from immediate API calls
    @State private var localTutorName: String = ""
    @State private var localTTSSpeed: Double = 1.0
    @State private var isSliderEditing = false

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let profile = vm.profile {
                    settingsContent(profile)
                } else {
                    VStack(spacing: 20) {
                        Spacer()
                        Text("Failed to load settings")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Log Out", role: .destructive) {
                            Task { await authVM.signOut() }
                        }
                        .padding(.bottom, 40)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
        }
        .task(id: authVM.userId) {
            if let userId = authVM.userId {
                await vm.fetchProfile(userId: userId)
                // Sync local state after profile loads
                if let profile = vm.profile {
                    localTutorName = profile.settings.tutorName ?? ""
                    localTTSSpeed = profile.settings.ttsSpeed
                }
            }
        }
    }

    // MARK: - Content

    private func settingsContent(_ profile: Profile) -> some View {
        Form {
            // Profile
            Section("Profile") {
                LabeledContent("Email", value: profile.email ?? "")
                LabeledContent("Total Practice", value: "\(profile.totalPracticeMinutes) min (\(profile.streakDays) day streak)")
            }

            // Tutor Name
            Section {
                TextField("Tutor Name", text: $localTutorName)
                    .onSubmit {
                        guard let userId = authVM.userId else { return }
                        Task { await vm.updateTutorName(userId: userId, name: localTutorName) }
                    }
            } header: {
                Text("Your Tutor")
            } footer: {
                Text("Your tutor will introduce themselves with this name")
            }

            // French Level
            Section("French Level") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                    ForEach(CEFRLevel.allCases) { level in
                        Button {
                            guard let userId = authVM.userId else { return }
                            Task { await vm.updateLevel(userId: userId, level: level) }
                        } label: {
                            VStack(spacing: 2) {
                                Text(level.rawValue)
                                    .font(.headline)
                                Text(level.description)
                                    .font(.caption2)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                profile.currentLevel == level.rawValue
                                    ? Color.primaryBlue
                                    : Color(.systemGray5)
                            )
                            .foregroundStyle(
                                profile.currentLevel == level.rawValue ? .white : .primary
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // Correction Style
            Section("Correction Style") {
                ForEach([
                    ("during_pauses", "During conversation", "Get corrections naturally during pauses"),
                    ("after_message", "After each message", "Corrections immediately after you speak"),
                    ("never", "Never", "No corrections, just practice"),
                ], id: \.0) { value, title, desc in
                    Button {
                        guard let userId = authVM.userId,
                              let style = UserSettings.CorrectionStyle(rawValue: value) else { return }
                        Task { await vm.updateCorrectionStyle(userId: userId, style: style) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(title)
                                    .foregroundStyle(.primary)
                                Text(desc)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if profile.settings.correctionStyle.rawValue == value {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.primaryBlue)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            // Speech Speed
            Section("Speech Speed") {
                VStack {
                    Slider(
                        value: $localTTSSpeed,
                        in: 0.5...2.0,
                        step: 0.25
                    ) {
                        Text("Speed")
                    } onEditingChanged: { editing in
                        isSliderEditing = editing
                        if !editing {
                            // Save when user finishes dragging
                            guard let userId = authVM.userId else { return }
                            Task { await vm.updateTTSSpeed(userId: userId, speed: localTTSSpeed) }
                        }
                    }
                    .tint(Color.primaryBlue)

                    HStack {
                        Text("Slower")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(String(format: "%.1fx", localTTSSpeed))
                            .font(.headline)
                        Spacer()
                        Text("Faster")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Daily Goal
            Section("Daily Goal") {
                HStack(spacing: 8) {
                    ForEach([5, 10, 15, 20, 30], id: \.self) { minutes in
                        Button {
                            guard let userId = authVM.userId else { return }
                            Task { await vm.updateDailyGoal(userId: userId, minutes: minutes) }
                        } label: {
                            Text("\(minutes)m")
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(
                                    profile.settings.dailyGoalMinutes == minutes
                                        ? Color.primaryBlue
                                        : Color(.systemGray5)
                                )
                                .foregroundStyle(
                                    profile.settings.dailyGoalMinutes == minutes ? .white : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // Logout
            Section {
                Button("Log Out", role: .destructive) {
                    Task { await authVM.signOut() }
                }
            }
        }
    }
}
