import SwiftUI

struct OnboardingContainerView: View {
    @StateObject private var vm = OnboardingViewModel()
    @EnvironmentObject var authVM: AuthViewModel

    @State private var currentStep = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress indicator
                OnboardingProgressView(currentStep: currentStep, totalSteps: 4)
                    .padding()

                // Step content
                TabView(selection: $currentStep) {
                    OnboardingTutorView(vm: vm, onNext: { withAnimation { currentStep = 1 } })
                        .tag(0)

                    OnboardingAboutYouView(
                        vm: vm,
                        onNext: { withAnimation { currentStep = 2 } },
                        onBack: { withAnimation { currentStep = 0 } }
                    )
                    .tag(1)

                    OnboardingJourneyView(
                        vm: vm,
                        onNext: { withAnimation { currentStep = 3 } },
                        onBack: { withAnimation { currentStep = 1 } }
                    )
                    .tag(2)

                    OnboardingPreferencesView(
                        vm: vm,
                        onComplete: { completeOnboarding() },
                        onBack: { withAnimation { currentStep = 2 } }
                    )
                    .tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentStep)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Welcome")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Skip") {
                        completeOnboarding()
                    }
                    .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func completeOnboarding() {
        guard let userId = authVM.userId else { return }
        Task {
            await vm.saveOnboarding(userId: userId) {
                authVM.completeOnboarding()
            }
        }
    }
}

#Preview {
    OnboardingContainerView()
        .environmentObject(AuthViewModel())
}
