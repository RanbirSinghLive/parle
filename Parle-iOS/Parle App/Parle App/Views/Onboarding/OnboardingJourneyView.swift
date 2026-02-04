import SwiftUI

struct OnboardingJourneyView: View {
    @ObservedObject var vm: OnboardingViewModel
    let onNext: () -> Void
    let onBack: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 20)

                VStack(spacing: 8) {
                    Text("Your French Journey")
                        .font(.title.bold())
                    Text("Tell us about your experience and goals")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                // Current level
                VStack(alignment: .leading, spacing: 12) {
                    Text("Current French level")
                        .font(.subheadline.weight(.medium))

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                        ForEach(CEFRLevel.allCases) { level in
                            Button {
                                vm.currentLevel = level
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
                                    vm.currentLevel == level
                                        ? Color.primaryBlue
                                        : Color(.systemGray5)
                                )
                                .foregroundStyle(
                                    vm.currentLevel == level ? .white : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 32)

                // Learning reason
                VStack(alignment: .leading, spacing: 8) {
                    Text("Why are you learning French?")
                        .font(.subheadline.weight(.medium))

                    TextField("e.g., Planning to visit Quebec, work, family...", text: $vm.learningReason, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3 ... 5)
                }
                .padding(.horizontal, 32)

                // Target level
                VStack(alignment: .leading, spacing: 12) {
                    Text("Target level")
                        .font(.subheadline.weight(.medium))
                    Text("Where do you want to be?")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                        ForEach(CEFRLevel.allCases) { level in
                            Button {
                                vm.targetLevel = level
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
                                    vm.targetLevel == level
                                        ? Color.primaryBlue
                                        : Color(.systemGray5)
                                )
                                .foregroundStyle(
                                    vm.targetLevel == level ? .white : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 32)

                Spacer().frame(height: 20)

                // Navigation
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

                    Button(action: onNext) {
                        Text("Continue")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.primaryBlue)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    OnboardingJourneyView(vm: OnboardingViewModel(), onNext: {}, onBack: {})
}
