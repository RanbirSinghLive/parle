# Parle — Native iOS App

Voice-first French tutoring with AI, rebuilt as a native iOS app.

## Setup

1. Open `Parle.xcodeproj` in Xcode 15+
2. Copy `Config/Secrets.swift` and fill in your API keys
3. Add `Secrets.swift` to `.gitignore`
4. Create a Color Set named `PrimaryBlue` in Assets.xcassets:
   - Light: `#1D4ED8`
   - Dark: `#2563EB`
5. Build and run on iPhone (iOS 17+)

## Architecture

```
Models/          — Codable data types matching Supabase schema
Services/        — API clients (Claude, Deepgram, ElevenLabs, Supabase, Audio)
ViewModels/      — @MainActor ObservableObject state management
Views/           — SwiftUI views
  Components/    — Reusable UI components
Config/          — API keys and color definitions
```

## Key Differences from PWA

- **AudioService.swift** (~120 lines) replaces ~750 lines of iOS audio workarounds
- No gesture-context gates, AudioContext unlocking, or pre-warmed elements
- AVFoundation plays audio anytime — no workarounds needed
- Always records AAC — no MIME type detection
- Native haptics, safe areas, and background audio for free

## Backend

Uses the same Supabase backend as the PWA. No server changes required.
The app calls APIs directly (Claude, Deepgram, ElevenLabs) instead of going
through Vercel proxy routes.
