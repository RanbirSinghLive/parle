import Foundation

/// API keys and configuration — this file should be added to .gitignore
enum Config {
    // MARK: - Supabase
    static let supabaseURL = "YOUR_SUPABASE_URL"
    static let supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY"

    // MARK: - Anthropic (Claude)
    static let anthropicAPIKey = "YOUR_ANTHROPIC_API_KEY"
    static let claudeModel = "claude-sonnet-4-5-20250929"

    // MARK: - Deepgram (STT)
    static let deepgramAPIKey = "YOUR_DEEPGRAM_API_KEY"

    // MARK: - ElevenLabs (TTS)
    static let elevenLabsAPIKey = "YOUR_ELEVENLABS_API_KEY"
    static let elevenLabsVoiceID = "YOUR_ELEVENLABS_VOICE_ID"
    static let elevenLabsModelID = "eleven_multilingual_v2"
}
