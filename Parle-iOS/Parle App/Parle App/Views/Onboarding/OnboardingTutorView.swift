import SwiftUI

struct OnboardingTutorView: View {
    @ObservedObject var vm: OnboardingViewModel
    let onNext: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer().frame(height: 40)

                // Tutor avatar
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 100))
                    .foregroundStyle(Color.primaryBlue)

                VStack(spacing: 12) {
                    Text("Meet Your Tutor")
                        .font(.title.bold())

                    Text("Your personal Quebec French tutor will guide you through conversations and help you improve.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 32)

                // Tutor name input
                VStack(alignment: .leading, spacing: 8) {
                    Text("What would you like to call your tutor?")
                        .font(.subheadline.weight(.medium))

                    TextField("Tutor name", text: $vm.tutorName)
                        .textFieldStyle(.roundedBorder)
                        .font(.body)

                    Text("Default: Marie")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 32)

                Spacer()

                // Continue button
                Button(action: onNext) {
                    Text("Continue")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.primaryBlue)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    OnboardingTutorView(vm: OnboardingViewModel(), onNext: {})
}
