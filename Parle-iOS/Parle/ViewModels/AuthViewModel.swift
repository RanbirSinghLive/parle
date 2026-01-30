import Foundation
import SwiftUI

/// Authentication state management.
@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userId: String?
    @Published var userEmail: String?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let supabase = SupabaseService.shared

    // MARK: - Session Check

    func checkSession() async {
        // Check for stored credentials in Keychain
        if let token = KeychainHelper.get(key: "access_token"),
           let id = KeychainHelper.get(key: "user_id") {
            await supabase.setAccessToken(token)
            userId = id
            userEmail = KeychainHelper.get(key: "user_email")
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
            KeychainHelper.set(key: "user_id", value: response.user.id)
            KeychainHelper.set(key: "user_email", value: response.user.email ?? email)

            userId = response.user.id
            userEmail = response.user.email ?? email
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
            await supabase.setAccessToken(response.accessToken)

            // Create profile
            try await supabase.createProfile(
                userId: response.user.id,
                email: email,
                displayName: name.isEmpty ? nil : name
            )

            KeychainHelper.set(key: "access_token", value: response.accessToken)
            KeychainHelper.set(key: "user_id", value: response.user.id)
            KeychainHelper.set(key: "user_email", value: email)

            userId = response.user.id
            userEmail = email
            isAuthenticated = true
        } catch {
            errorMessage = "Sign up failed. Please try again."
            print("[Auth] Sign up error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Sign Out

    func signOut() async {
        await supabase.signOut()
        KeychainHelper.delete(key: "access_token")
        KeychainHelper.delete(key: "user_id")
        KeychainHelper.delete(key: "user_email")

        userId = nil
        userEmail = nil
        isAuthenticated = false
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
