import SwiftUI

struct OnboardingProgressView: View {
    let currentStep: Int
    let totalSteps: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0 ..< totalSteps, id: \.self) { step in
                Capsule()
                    .fill(step <= currentStep ? Color.primaryBlue : Color(.systemGray4))
                    .frame(height: 4)
            }
        }
    }
}

#Preview {
    OnboardingProgressView(currentStep: 1, totalSteps: 4)
        .padding()
}
