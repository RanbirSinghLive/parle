import Foundation

/// Supabase REST client for auth, profile, and session management.
///
/// Uses URLSession directly to avoid external dependency issues.
/// For production, consider using the official supabase-swift SDK.
actor SupabaseService {
    static let shared = SupabaseService()

    private let baseURL: String
    private let anonKey: String
    private var accessToken: String?

    init() {
        self.baseURL = Config.supabaseURL
        self.anonKey = Config.supabaseAnonKey
    }

    // MARK: - Token Management

    func setAccessToken(_ token: String?) {
        self.accessToken = token
    }

    // MARK: - Auth

    struct AuthResponse: Codable {
        let accessToken: String
        let user: AuthUser

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case user
        }
    }

    struct AuthUser: Codable {
        let id: String
        let email: String?
        let userMetadata: UserMetadata?

        enum CodingKeys: String, CodingKey {
            case id, email
            case userMetadata = "user_metadata"
        }
    }

    struct UserMetadata: Codable {
        let fullName: String?
        let name: String?

        enum CodingKeys: String, CodingKey {
            case fullName = "full_name"
            case name
        }

        var displayName: String? {
            fullName ?? name
        }
    }

    func signUp(email: String, password: String) async throws -> AuthResponse {
        let body: [String: Any] = ["email": email, "password": password]
        let data = try await post(path: "/auth/v1/signup", body: body)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    func signIn(email: String, password: String) async throws -> AuthResponse {
        let body: [String: Any] = [
            "email": email,
            "password": password,
        ]
        let data = try await post(
            path: "/auth/v1/token?grant_type=password",
            body: body
        )
        let response = try JSONDecoder().decode(AuthResponse.self, from: data)
        self.accessToken = response.accessToken
        return response
    }

    func signOut() {
        self.accessToken = nil
    }

    // MARK: - Profile

    func fetchProfile(userId: String) async throws -> Profile {
        let data = try await get(
            path: "/rest/v1/profiles?id=eq.\(userId)&select=*"
        )
        let profiles = try JSONDecoder().decode([Profile].self, from: data)
        guard let profile = profiles.first else {
            throw ParleError.notFound("Profile not found")
        }
        return profile
    }

    func updateProfile(userId: String, updates: [String: Any]) async throws -> Profile {
        let data = try await patch(
            path: "/rest/v1/profiles?id=eq.\(userId)",
            body: updates
        )
        let profiles = try JSONDecoder().decode([Profile].self, from: data)
        guard let profile = profiles.first else {
            throw ParleError.notFound("Profile not found after update")
        }
        return profile
    }

    func createProfile(userId: String, email: String, displayName: String?) async throws {
        let defaultSettings = UserSettings.default
        let settingsData = try JSONEncoder().encode(defaultSettings)
        let settingsJSON = try JSONSerialization.jsonObject(with: settingsData)

        let body: [String: Any] = [
            "id": userId,
            "email": email,
            "display_name": displayName as Any,
            "current_level": "A1",
            "vocabulary": [] as [Any],
            "grammar": [] as [Any],
            "strengths": [] as [Any],
            "weaknesses": [] as [Any],
            "total_practice_minutes": 0,
            "streak_days": 0,
            "settings": settingsJSON,
        ]
        _ = try await post(path: "/rest/v1/profiles", body: body)
    }

    // MARK: - Sessions

    func createSession(userId: String, mode: SessionMode, topic: String?) async throws -> String {
        let body: [String: Any] = [
            "user_id": userId,
            "mode": mode.rawValue,
            "lesson_topic": topic as Any,
            "transcript": [] as [Any],
            "corrections": [] as [Any],
        ]
        let data = try await post(
            path: "/rest/v1/sessions?select=id",
            body: body,
            returnRepresentation: true
        )
        struct IDResponse: Codable { let id: String }
        let results = try JSONDecoder().decode([IDResponse].self, from: data)
        guard let id = results.first?.id else {
            throw ParleError.notFound("Session ID not returned")
        }
        return id
    }

    func endSession(
        sessionId: String,
        userId: String,
        transcript: [TranscriptEntry],
        corrections: [Correction],
        summary: SessionSummary
    ) async throws {
        let encoder = JSONEncoder()
        let transcriptData = try JSONSerialization.jsonObject(with: encoder.encode(transcript))
        let correctionsData = try JSONSerialization.jsonObject(with: encoder.encode(corrections))
        let summaryData = try JSONSerialization.jsonObject(with: encoder.encode(summary))

        let body: [String: Any] = [
            "ended_at": ISO8601DateFormatter().string(from: Date()),
            "transcript": transcriptData,
            "corrections": correctionsData,
            "summary": summaryData,
        ]
        _ = try await patch(
            path: "/rest/v1/sessions?id=eq.\(sessionId)&user_id=eq.\(userId)",
            body: body
        )
    }

    func fetchSessions(userId: String, limit: Int = 20) async throws -> [Session] {
        let data = try await get(
            path: "/rest/v1/sessions?user_id=eq.\(userId)&ended_at=not.is.null&order=started_at.desc&limit=\(limit)&select=*"
        )
        return try JSONDecoder().decode([Session].self, from: data)
    }

    func fetchSession(sessionId: String) async throws -> Session {
        let data = try await get(
            path: "/rest/v1/sessions?id=eq.\(sessionId)&select=*"
        )
        let sessions = try JSONDecoder().decode([Session].self, from: data)
        guard let session = sessions.first else {
            throw ParleError.notFound("Session not found")
        }
        return session
    }

    // MARK: - HTTP Helpers

    private func get(path: String) async throws -> Data {
        var request = makeRequest(path: path, method: "GET")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)
        return data
    }

    private func post(
        path: String,
        body: [String: Any],
        returnRepresentation: Bool = false
    ) async throws -> Data {
        var request = makeRequest(path: path, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if returnRepresentation {
            request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)
        return data
    }

    private func patch(path: String, body: [String: Any]) async throws -> Data {
        var request = makeRequest(path: path, method: "PATCH")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)
        return data
    }

    private func makeRequest(path: String, method: String) -> URLRequest {
        let url = URL(string: "\(baseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw ParleError.network("Invalid response")
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ParleError.api(http.statusCode, body)
        }
    }
}

// MARK: - Error Types

enum ParleError: LocalizedError {
    case network(String)
    case api(Int, String)
    case notFound(String)
    case audio(String)
    case encoding(String)

    var errorDescription: String? {
        switch self {
        case .network(let msg): return "Network error: \(msg)"
        case .api(let code, let msg): return "API error (\(code)): \(msg)"
        case .notFound(let msg): return msg
        case .audio(let msg): return "Audio error: \(msg)"
        case .encoding(let msg): return "Encoding error: \(msg)"
        }
    }
}
