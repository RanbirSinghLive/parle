import Foundation
import SwiftUI
import Combine
import AuthenticationServices

/// Authentication state management.
@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userId: String?
    @Published var userEmail: String?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var needsOnboarding = false

    private let supabase = SupabaseService.shared
    private static let redirectScheme = "com.ranbir.parle-app"
    private static let redirectURL = "\(redirectScheme)://callback"

    // MARK: - Session Check

    func checkSession() async {
        // Set up callback so refreshed tokens get persisted to Keychain
        await supabase.setOnTokenRefreshed { accessToken, refreshToken in
            KeychainHelper.set(key: "access_token", value: accessToken)
            KeychainHelper.set(key: "refresh_token", value: refreshToken)
        }

        // Check for stored credentials in Keychain
        if let token = KeychainHelper.get(key: "access_token"),
           let id = KeychainHelper.get(key: "user_id") {
            await supabase.setAccessToken(token)
            if let refreshToken = KeychainHelper.get(key: "refresh_token") {
                await supabase.setRefreshToken(refreshToken)
            }
            userId = id
            userEmail = KeychainHelper.get(key: "user_email")
            await checkOnboardingStatus(userId: id)
            isAuthenticated = true
        }
    }

    // MARK: - Sign In

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await supabase.signIn(email: email, password: password)
            KeychainHelper.set(key: "access_token", value: response.accessToken)
            if let rt = response.refreshToken {
                KeychainHelper.set(key: "refresh_token", value: rt)
                await supabase.setRefreshToken(rt)
            }
            KeychainHelper.set(key: "user_id", value: response.user.id)
            KeychainHelper.set(key: "user_email", value: response.user.email ?? email)

            // Set up callback so refreshed tokens get persisted to Keychain
            await supabase.setOnTokenRefreshed { accessToken, refreshToken in
                KeychainHelper.set(key: "access_token", value: accessToken)
                KeychainHelper.set(key: "refresh_token", value: refreshToken)
            }

            userId = response.user.id
            userEmail = response.user.email ?? email
            await checkOnboardingStatus(userId: response.user.id)
            isAuthenticated = true
        } catch {
            errorMessage = "Sign in failed. Please check your credentials."
            print("[Auth] Sign in error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Sign Up

    func signUp(email: String, password: String, name: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await supabase.signUp(email: email, password: password)

            // Create profile
            try await supabase.createProfile(
                userId: response.user.id,
                email: email,
                displayName: name.isEmpty ? nil : name
            )

            KeychainHelper.set(key: "access_token", value: response.accessToken)
            if let rt = response.refreshToken {
                KeychainHelper.set(key: "refresh_token", value: rt)
            }
            KeychainHelper.set(key: "user_id", value: response.user.id)
            KeychainHelper.set(key: "user_email", value: email)

            userId = response.user.id
            userEmail = email
            needsOnboarding = true  // New user always needs onboarding
            isAuthenticated = true
        } catch {
            errorMessage = "Sign up failed. Please try again."
            print("[Auth] Sign up error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Google OAuth

    func signInWithGoogle() {
        isLoading = true
        errorMessage = nil

        Task {
            let url = await supabase.oauthURL(
                provider: "google",
                redirectTo: Self.redirectURL
            )

            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: Self.redirectScheme
            ) { [weak self] callbackURL, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let error {
                        if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                            self.isLoading = false
                            return
                        }
                        self.errorMessage = "Google sign in failed."
                        print("[Auth] OAuth error: \(error)")
                        self.isLoading = false
                        return
                    }

                    guard let callbackURL,
                          let fragment = callbackURL.fragment else {
                        self.errorMessage = "Google sign in failed."
                        self.isLoading = false
                        return
                    }

                    await self.handleOAuthCallback(fragment: fragment)
                }
            }

            session.presentationContextProvider = OAuthPresentationContext.shared
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    private func handleOAuthCallback(fragment: String) async {
        // Parse tokens from URL fragment: access_token=...&refresh_token=...&...
        let params = fragment.split(separator: "&").reduce(into: [String: String]()) { result, pair in
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2 {
                result[String(parts[0])] = String(parts[1])
            }
        }

        guard let accessToken = params["access_token"] else {
            errorMessage = "Google sign in failed. No token received."
            isLoading = false
            return
        }

        let refreshToken = params["refresh_token"] ?? ""

        do {
            let response = try await supabase.setSession(
                accessToken: accessToken,
                refreshToken: refreshToken
            )

            KeychainHelper.set(key: "access_token", value: accessToken)
            KeychainHelper.set(key: "refresh_token", value: refreshToken)
            KeychainHelper.set(key: "user_id", value: response.user.id)
            KeychainHelper.set(key: "user_email", value: response.user.email ?? "")

            // Ensure profile exists (first-time Google sign-in)
            var isNewUser = false
            do {
                _ = try await supabase.fetchProfile(userId: response.user.id)
            } catch {
                let displayName = response.user.userMetadata?.displayName
                try await supabase.createProfile(
                    userId: response.user.id,
                    email: response.user.email ?? "",
                    displayName: displayName
                )
                isNewUser = true
            }

            userId = response.user.id
            userEmail = response.user.email
            if isNewUser {
                needsOnboarding = true
            } else {
                await checkOnboardingStatus(userId: response.user.id)
            }
            isAuthenticated = true
        } catch {
            errorMessage = "Google sign in failed."
            print("[Auth] OAuth token error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Sign Out

    func signOut() async {
        await supabase.signOut()
        KeychainHelper.delete(key: "access_token")
        KeychainHelper.delete(key: "refresh_token")
        KeychainHelper.delete(key: "user_id")
        KeychainHelper.delete(key: "user_email")

        userId = nil
        userEmail = nil
        isAuthenticated = false
        needsOnboarding = false
    }

    // MARK: - Onboarding

    func checkOnboardingStatus(userId: String) async {
        do {
            let profile = try await supabase.fetchProfile(userId: userId)
            needsOnboarding = !profile.settings.onboardingCompleted
        } catch {
            // If we can't fetch profile, assume new user needs onboarding
            needsOnboarding = true
            print("[Auth] Could not fetch profile for onboarding check: \(error)")
        }
    }

    func completeOnboarding() {
        needsOnboarding = false
    }
}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func set(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - OAuth Presentation Context

final class OAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = OAuthPresentationContext()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
