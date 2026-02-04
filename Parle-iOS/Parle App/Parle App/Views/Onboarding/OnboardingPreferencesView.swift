import SwiftUI

struct OnboardingPreferencesView: View {
    @ObservedObject var vm: OnboardingViewModel
    let onComplete: () -> Void
    let onBack: () -> Void

    private let correctionOptions: [(UserSettings.CorrectionStyle, String, String)] = [
        (.duringPauses, "During conversation", "Get corrections naturally during pauses"),
        (.afterMessage, "After each message", "Corrections immediately after you speak"),
        (.never, "Never", "No corrections, just practice"),
    ]

    private let dailyGoalOptions = [5, 10, 15, 30, 60]

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 20)

                VStack(spacing: 8) {
                    Text("Your Preferences")
                        .font(.title.bold())
                    Text("Customize your learning experience")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                // Correction style
                VStack(alignment: .leading, spacing: 12) {
                    Text("When should I correct you?")
                        .font(.subheadline.weight(.medium))

                    ForEach(correctionOptions, id: \.0) { style, title, desc in
                        Button {
                            vm.correctionStyle = style
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(title)
                                        .foregroundStyle(.primary)
                                    Text(desc)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if vm.correctionStyle == style {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Color.primaryBlue)
                                } else {
                                    Image(systemName: "circle")
                                        .foregroundStyle(Color(.systemGray4))
                                }
                            }
                            .padding(12)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 32)

                // Daily goal
                VStack(alignment: .leading, spacing: 12) {
                    Text("Daily practice goal")
                        .font(.subheadline.weight(.medium))

                    HStack(spacing: 8) {
                        ForEach(dailyGoalOptions, id: \.self) { minutes in
                            Button {
                                vm.dailyGoalMinutes = minutes
                            } label: {
                                Text("\(minutes)m")
                                    .font(.subheadline.weight(.medium))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(
                                        vm.dailyGoalMinutes == minutes
                                            ? Color.primaryBlue
                                            : Color(.systemGray5)
                                    )
                                    .foregroundStyle(
                                        vm.dailyGoalMinutes == minutes ? .white : .primary
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 32)

                // TTS speed
                VStack(alignment: .leading, spacing: 12) {
                    Text("Speech speed")
                        .font(.subheadline.weight(.medium))

                    VStack {
                        Slider(value: $vm.ttsSpeed, in: 0.5 ... 2.0, step: 0.25)
                            .tint(Color.primaryBlue)

                        HStack {
                            Text("Slower")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(String(format: "%.1fx", vm.ttsSpeed))
                                .font(.headline)
                            Spacer()
                            Text("Faster")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.horizontal, 32)

                Spacer().frame(height: 20)

                // Complete button
                HStack(spacing: 16) {
                    Button(action: onBack) {
                        Text("Back")
                            .font(.headline)
                            .foregroundStyle(Color.primaryBlue)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button {
                        onComplete()
                    } label: {
                        if vm.isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Start Learning!")
                        }
                    }
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.primaryBlue)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .disabled(vm.isSaving)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    OnboardingPreferencesView(vm: OnboardingViewModel(), onComplete: {}, onBack: {})
}
