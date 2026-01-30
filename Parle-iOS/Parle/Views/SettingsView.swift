import SwiftUI

/// User settings screen.
///
/// Port of app/settings/page.tsx.
struct SettingsView: View {
    @StateObject private var vm = SettingsViewModel()
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let profile = vm.profile {
                    settingsContent(profile)
                } else {
                    Text("Failed to load settings")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
        }
        .task {
            if let userId = authVM.userId {
                await vm.fetchProfile(userId: userId)
            }
        }
    }

    // MARK: - Content

    private func settingsContent(_ profile: Profile) -> some View {
        Form {
            // Status Message
            if let msg = vm.statusMessage {
                Section {
                    Text(msg.text)
                        .foregroundStyle(msg.type == .success ? .green : .red)
                }
            }

            // Profile
            Section("Profile") {
                LabeledContent("Email", value: profile.email ?? "")
                LabeledContent("Total Practice", value: "\(profile.totalPracticeMinutes) min (\(profile.streakDays) day streak)")
            }

            // Tutor Name
            Section {
                TextField("Tutor Name", text: Binding(
                    get: { profile.settings.tutorName ?? "" },
                    set: { name in
                        guard let userId = authVM.userId else { return }
                        Task { await vm.updateTutorName(userId: userId, name: name) }
                    }
                ))
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
                                    ? Color("PrimaryBlue")
                                    : Color(.systemGray5)
                            )
                            .foregroundStyle(
                                profile.currentLevel == level.rawValue ? .white : .primary
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .disabled(vm.isSaving)
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
                                    .foregroundStyle(Color("PrimaryBlue"))
                            }
                        }
                    }
                    .disabled(vm.isSaving)
                }
            }

            // Speech Speed
            Section("Speech Speed") {
                VStack {
                    Slider(
                        value: Binding(
                            get: { profile.settings.ttsSpeed },
                            set: { speed in
                                guard let userId = authVM.userId else { return }
                                Task { await vm.updateTTSSpeed(userId: userId, speed: speed) }
                            }
                        ),
                        in: 0.5...1.5,
                        step: 0.1
                    )
                    .tint(Color("PrimaryBlue"))

                    HStack {
                        Text("Slower")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(String(format: "%.1fx", profile.settings.ttsSpeed))
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
                                        ? Color("PrimaryBlue")
                                        : Color(.systemGray5)
                                )
                                .foregroundStyle(
                                    profile.settings.dailyGoalMinutes == minutes ? .white : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .disabled(vm.isSaving)
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
