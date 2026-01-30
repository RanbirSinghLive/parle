import SwiftUI

/// Login and signup screens.
///
/// Port of app/login/page.tsx and app/signup/page.tsx.
struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel

    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Logo
            VStack(spacing: 8) {
                Image(systemName: "mic.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Color("PrimaryBlue"))
                Text("Parle")
                    .font(.largeTitle.bold())
                Text("Voice-first French tutoring")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Form
            VStack(spacing: 16) {
                if isSignUp {
                    TextField("Name", text: $name)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                }

                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(isSignUp ? .newPassword : .password)

                if let error = authVM.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Button {
                    Task {
                        if isSignUp {
                            await authVM.signUp(email: email, password: password, name: name)
                        } else {
                            await authVM.signIn(email: email, password: password)
                        }
                    }
                } label: {
                    if authVM.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(isSignUp ? "Sign Up" : "Sign In")
                    }
                }
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color("PrimaryBlue"))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(authVM.isLoading || email.isEmpty || password.isEmpty)

                Button {
                    isSignUp.toggle()
                    authVM.errorMessage = nil
                } label: {
                    Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                        .font(.subheadline)
                        .foregroundStyle(Color("PrimaryBlue"))
                }
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .background(Color(.systemGroupedBackground))
    }
}
