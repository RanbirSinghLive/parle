import SwiftUI

struct OnboardingAboutYouView: View {
    @ObservedObject var vm: OnboardingViewModel
    let onNext: () -> Void
    let onBack: () -> Void

    private let columns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 20)

                VStack(spacing: 8) {
                    Text("About You")
                        .font(.title.bold())
                    Text("Help us personalize your learning experience")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                // Display name
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your name")
                        .font(.subheadline.weight(.medium))
                    TextField("How should we address you?", text: $vm.displayName)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(.horizontal, 32)

                // Native language
                VStack(alignment: .leading, spacing: 8) {
                    Text("Native language")
                        .font(.subheadline.weight(.medium))

                    Menu {
                        ForEach(NativeLanguage.allCases) { lang in
                            Button(lang.rawValue) {
                                vm.nativeLanguage = lang
                            }
                        }
                    } label: {
                        HStack {
                            Text(vm.nativeLanguage.rawValue)
                                .foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.horizontal, 32)

                // Interests/topics
                VStack(alignment: .leading, spacing: 12) {
                    Text("Topics you enjoy")
                        .font(.subheadline.weight(.medium))
                    Text("Select all that interest you")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(InterestTopic.allCases) { topic in
                            TopicChip(
                                topic: topic,
                                isSelected: vm.selectedTopics.contains(topic),
                                onTap: { vm.toggleTopic(topic) }
                            )
                        }
                    }
                }
                .padding(.horizontal, 32)

                Spacer().frame(height: 20)

                // Navigation buttons
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

struct TopicChip: View {
    let topic: InterestTopic
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: topic.icon)
                    .font(.system(size: 14))
                Text(topic.displayName)
                    .font(.subheadline)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(isSelected ? Color.primaryBlue : Color(.systemGray6))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    OnboardingAboutYouView(vm: OnboardingViewModel(), onNext: {}, onBack: {})
}
