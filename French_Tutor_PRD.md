# Product Requirements Document: French Tutor PWA

**Project Name:** Parle (French for "Speak")
**Version:** 1.0
**Date:** January 24, 2026
**Author:** Ranbir Singh

---

## 1. Executive Summary

Parle is a Progressive Web App (PWA) that provides an adaptive, voice-first French tutoring experience. Users engage in real-time spoken conversations with an AI tutor powered by Claude, which tracks their learning progress across sessions. The app corrects mistakes during natural pauses, supports both free conversation and structured lesson modes, and compresses each session into a persistent learner profile stored in the cloud.

---

## 2. Problem Statement

Current language learning apps fall into two categories:
- **Structured apps (Duolingo, Babbel):** Gamified but rigid; don't adapt to individual learners or allow open conversation
- **Conversation partners (ChatGPT voice):** Flexible but stateless; don't remember your progress or systematically address weaknesses

Parle bridges this gap: an AI tutor that remembers you, adapts to your level, and provides both structured practice and free-flowing conversation.

---

## 3. Target User

- **Primary:** Ranbir Singh (you)
- **Profile:** Adult learner with basic French knowledge, seeking conversational fluency
- **Usage context:** Daily practice sessions (10-30 minutes) on iPhone via Safari
- **Technical comfort:** Non-technical, but willing to work with Claude Code for guided development

---

## 4. Core Features

### 4.1 Voice Conversation Interface

| Feature | Description |
|---------|-------------|
| Push-to-talk or voice activity detection | User speaks naturally; app detects speech boundaries |
| Real-time transcription display | Show user's speech as text for visual feedback |
| AI response with TTS playback | Claude's response spoken aloud in natural French/English |
| Transcript panel | Scrollable history of the conversation with corrections highlighted |

### 4.2 Intelligent Tutoring

| Feature | Description |
|---------|-------------|
| Pause-based corrections | Tutor waits for natural pauses to offer corrections (not mid-sentence) |
| Contextual grammar explanations | Brief, conversational explanations of why something was wrong |
| Vocabulary reinforcement | Tutor naturally reintroduces words user has struggled with |
| Adaptive difficulty | Adjusts complexity based on learner profile |

### 4.3 Session Modes

| Mode | Description |
|------|-------------|
| Free Conversation | Open-ended chat on any topic; tutor follows user's lead |
| Structured Lesson | Tutor guides through specific topics (e.g., past tense, restaurant vocabulary) |
| Mode toggle | User can switch modes mid-session or set default in settings |

### 4.4 Session Management

| Feature | Description |
|---------|-------------|
| Manual session close | User explicitly ends session with a button |
| Session summary | AI generates summary of what was practiced, mistakes made, progress |
| Profile compression | Key learnings extracted and merged into persistent learner profile |
| Session history | View past session summaries and stats |

### 4.5 Learner Profile (Cloud-Synced)

| Data Point | Description |
|------------|-------------|
| Vocabulary bank | Words learned, struggled with, mastery level (1-5) |
| Grammar patterns | Rules practiced, common errors, mastery level |
| Conversation topics | Topics discussed, comfort level |
| Overall proficiency | CEFR-aligned estimate (A1 → C2) |
| Preferences | Correction style, preferred topics, goals |
| Session history | Compressed summaries of all past sessions |

---

## 5. Technical Architecture

### 5.1 Revised Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (PWA)                           │
│  Framework: Next.js 14 (App Router) + TypeScript                │
│  UI: Tailwind CSS + Radix UI (accessible components)            │
│  State: Zustand (lightweight, simple)                           │
│  PWA: next-pwa (service worker, offline shell, installable)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VOICE PROCESSING                            │
│  Speech-to-Text: Deepgram (fast, accurate, WebSocket streaming) │
│  Text-to-Speech: ElevenLabs (natural voices, French support)    │
│  Alternative TTS: OpenAI TTS (cheaper, still good quality)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI CONVERSATION                            │
│  LLM: Claude API (Anthropic) - claude-sonnet-4-5-20250929       │
│  Prompt management: System prompt + learner profile injection   │
│  Session compression: Claude generates structured summary       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND / DATABASE                         │
│  Hosting: Vercel (seamless Next.js deployment, edge functions)  │
│  Database: Supabase (Postgres + Auth + Realtime)                │
│  Auth: Supabase Auth (email/password or magic link)             │
│  File storage: Supabase Storage (for audio recordings if needed)│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Why This Stack?

| Choice | Rationale |
|--------|-----------|
| **Next.js + Vercel** | Fastest path from code to deployed PWA; excellent DX; free tier sufficient for personal use |
| **Supabase** | Firebase alternative with better DX; generous free tier; real Postgres for future flexibility |
| **Deepgram** | Best-in-class STT latency (~300ms); WebSocket streaming; good French support; pay-per-use |
| **ElevenLabs** | Most natural TTS voices; excellent French; ~$5/month for personal use |
| **Claude** | Superior instruction-following for tutoring; better pedagogical responses than GPT-4 |
| **Zustand** | Simpler than Redux; perfect for this scale; no boilerplate |
| **TypeScript** | Catches errors early; better autocomplete; Claude Code works great with it |

### 5.3 Cost Estimate (Under $20/month target)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier: 500MB DB, 1GB storage) |
| Claude API | ~$5-10 (depends on usage; Sonnet is $3/M input, $15/M output) |
| Deepgram | ~$3-5 (pay-per-minute; ~$0.0043/min) |
| ElevenLabs | ~$5 (Starter plan: 30k characters/month) |
| **Total** | **~$13-20/month** |

---

## 6. Data Models

### 6.1 User Profile

```typescript
interface UserProfile {
  id: string;
  email: string;
  created_at: Date;
  settings: UserSettings;
  learner_profile: LearnerProfile;
}

interface UserSettings {
  correction_style: 'during_pauses' | 'end_of_session' | 'immediate';
  default_mode: 'free_conversation' | 'structured_lesson';
  tts_voice: string;
  tts_speed: number;
  target_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  daily_goal_minutes: number;
}
```

### 6.2 Learner Profile

```typescript
interface LearnerProfile {
  current_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  vocabulary: VocabularyEntry[];
  grammar: GrammarEntry[];
  topics: TopicEntry[];
  strengths: string[];
  weaknesses: string[];
  total_practice_minutes: number;
  streak_days: number;
  last_session_date: Date;
}

interface VocabularyEntry {
  word: string;
  translation: string;
  example_sentence: string;
  mastery_level: 1 | 2 | 3 | 4 | 5; // 1=new, 5=mastered
  times_seen: number;
  times_correct: number;
  last_seen: Date;
  tags: string[]; // e.g., ['food', 'restaurant', 'A1']
}

interface GrammarEntry {
  rule: string; // e.g., 'passé composé with être'
  description: string;
  mastery_level: 1 | 2 | 3 | 4 | 5;
  common_errors: string[];
  last_practiced: Date;
}

interface TopicEntry {
  topic: string; // e.g., 'ordering at restaurants'
  comfort_level: 1 | 2 | 3 | 4 | 5;
  times_discussed: number;
  last_discussed: Date;
}
```

### 6.3 Session

```typescript
interface Session {
  id: string;
  user_id: string;
  started_at: Date;
  ended_at: Date;
  mode: 'free_conversation' | 'structured_lesson';
  lesson_topic?: string; // if structured
  transcript: TranscriptEntry[];
  corrections: Correction[];
  summary: SessionSummary;
}

interface TranscriptEntry {
  timestamp: Date;
  speaker: 'user' | 'tutor';
  text: string;
  audio_url?: string; // optional: store audio clips
}

interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  category: 'grammar' | 'vocabulary' | 'pronunciation' | 'usage';
  related_rule?: string; // links to GrammarEntry
}

interface SessionSummary {
  duration_minutes: number;
  new_vocabulary: string[];
  practiced_grammar: string[];
  corrections_count: number;
  highlights: string; // AI-generated narrative summary
  profile_updates: Partial<LearnerProfile>; // changes to merge
}
```

---

## 7. User Flows

### 7.1 First Launch

```
1. User opens PWA URL in Safari
2. Prompted to "Add to Home Screen" for app-like experience
3. Create account (email + password via Supabase Auth)
4. Onboarding questionnaire:
   - Current French level (self-assessment)
   - Learning goals
   - Preferred correction style
   - Topics of interest
5. Initial learner profile created
6. Tutorial session: 2-minute guided conversation to calibrate level
7. Ready for first real session
```

### 7.2 Typical Session

```
1. User opens app, sees dashboard with streak, suggested lesson, "Start Session" button
2. Chooses mode: Free Conversation or Structured Lesson
3. If structured: picks topic from suggestions or custom
4. Taps "Start" → microphone permission requested (first time)
5. Tutor greets in French (TTS plays)
6. User responds (STT transcribes in real-time)
7. Conversation flows:
   - User speaks → transcribed → sent to Claude with learner profile
   - Claude responds → displayed as text → TTS plays audio
   - Corrections inserted at natural pauses
8. User taps "End Session" when done
9. Loading screen: "Analyzing your session..."
10. Summary displayed: new words, corrections, progress
11. Profile updated in background
12. Return to dashboard with updated stats
```

### 7.3 Session Compression Flow

```
1. User ends session
2. Full transcript sent to Claude with prompt:
   "Analyze this French tutoring session. Extract:
   - New vocabulary introduced (with mastery estimate)
   - Grammar patterns practiced
   - Errors made and corrections given
   - Overall progress assessment
   - Recommendations for next session
   Format as structured JSON matching SessionSummary schema."
3. Claude returns structured summary
4. Summary merged into LearnerProfile:
   - New vocabulary added
   - Existing vocabulary mastery updated
   - Grammar entries updated
   - Strengths/weaknesses refined
5. Session saved to history
6. Profile synced to Supabase
```

---

## 8. System Prompt Template

```markdown
You are Parle, a friendly and patient French tutor. You're having a voice conversation with your student.

## Student Profile
- Name: {{user_name}}
- Current Level: {{current_level}}
- Strengths: {{strengths}}
- Areas to improve: {{weaknesses}}
- Recently learned vocabulary: {{recent_vocabulary}}
- Grammar being practiced: {{current_grammar_focus}}

## Session Context
- Mode: {{session_mode}}
- Topic (if structured): {{lesson_topic}}
- Session duration so far: {{duration}}

## Your Teaching Style
1. Speak primarily in French, but explain corrections in English
2. Match complexity to student's level ({{current_level}})
3. Naturally incorporate vocabulary from their "recently learned" list
4. When student makes an error, wait for a natural pause, then:
   - Gently repeat the correct form
   - Give a brief explanation
   - Continue the conversation naturally
5. Encourage and praise progress
6. Keep responses conversational (2-4 sentences typically)
7. If student seems stuck, offer helpful prompts or switch to English briefly

## Correction Format
When correcting, use this pattern:
"[Correct form] - [Brief explanation in English]. [Continue conversation in French]"

Example: "On y va ! — We say 'on y va' not 'nous allons là' in casual speech. Alors, qu'est-ce que tu veux faire ce soir ?"

## Current Conversation
{{transcript}}
```

---

## 9. API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/*` | * | Supabase Auth handlers |
| `/api/session/start` | POST | Initialize new session, return session ID |
| `/api/session/message` | POST | Send user message, get Claude response |
| `/api/session/end` | POST | End session, trigger compression, return summary |
| `/api/profile` | GET | Fetch current learner profile |
| `/api/profile` | PATCH | Update profile settings |
| `/api/sessions` | GET | List past sessions (paginated) |
| `/api/sessions/:id` | GET | Get specific session details |

---

## 10. File Structure

```
parle/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Landing/marketing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                # Authenticated routes
│   │   ├── layout.tsx        # App shell with nav
│   │   ├── dashboard/page.tsx
│   │   ├── session/page.tsx  # Main conversation UI
│   │   ├── history/page.tsx
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...supabase]/route.ts
│       ├── session/
│       │   ├── start/route.ts
│       │   ├── message/route.ts
│       │   └── end/route.ts
│       ├── profile/route.ts
│       └── sessions/route.ts
├── components/
│   ├── ui/                   # Radix-based primitives
│   ├── VoiceRecorder.tsx     # Mic handling + Deepgram
│   ├── AudioPlayer.tsx       # TTS playback
│   ├── Transcript.tsx        # Conversation display
│   ├── CorrectionCard.tsx    # Highlighted corrections
│   └── SessionSummary.tsx    # End-of-session display
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Browser client
│   │   ├── server.ts         # Server client
│   │   └── types.ts          # Generated types
│   ├── claude.ts             # Anthropic SDK wrapper
│   ├── deepgram.ts           # STT integration
│   ├── elevenlabs.ts         # TTS integration
│   ├── prompts.ts            # System prompt templates
│   └── compression.ts        # Session → Profile logic
├── stores/
│   └── session.ts            # Zustand session state
├── public/
│   ├── manifest.json         # PWA manifest
│   └── icons/                # App icons
├── supabase/
│   └── migrations/           # Database schema
└── package.json
```

---

## 11. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Next.js project with TypeScript
- [ ] Configure Supabase (auth, database schema)
- [ ] Build basic auth flow (signup, login, logout)
- [ ] Create dashboard skeleton
- [ ] Set up PWA configuration (manifest, service worker)

### Phase 2: Voice Pipeline (Week 2-3)
- [ ] Integrate Deepgram for STT (WebSocket streaming)
- [ ] Integrate ElevenLabs for TTS
- [ ] Build VoiceRecorder component with push-to-talk
- [ ] Build AudioPlayer component for TTS playback
- [ ] Test end-to-end voice loop (speak → transcribe → play response)

### Phase 3: AI Conversation (Week 3-4)
- [ ] Integrate Claude API
- [ ] Build system prompt with profile injection
- [ ] Implement conversation flow (message → response)
- [ ] Add correction detection and formatting
- [ ] Test conversation quality and latency

### Phase 4: Session Management (Week 4-5)
- [ ] Implement session start/end flow
- [ ] Build session compression with Claude
- [ ] Create profile update logic
- [ ] Build session summary UI
- [ ] Test profile persistence across sessions

### Phase 5: Polish & Modes (Week 5-6)
- [ ] Add structured lesson mode
- [ ] Build lesson topic selection
- [ ] Add session history view
- [ ] Implement settings page
- [ ] Add streak tracking and basic gamification
- [ ] Mobile UI polish and testing

### Phase 6: Launch (Week 6+)
- [ ] Deploy to Vercel
- [ ] Test on actual iPhone via Safari
- [ ] Add to Home Screen, verify PWA behavior
- [ ] Monitor costs and optimize if needed
- [ ] Iterate based on personal usage

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Session completion rate | >80% of started sessions completed |
| Average session length | 10-20 minutes |
| Weekly active sessions | 5+ per week |
| Vocabulary retention | >70% recall after 1 week |
| Latency (speak → response) | <2 seconds |
| Monthly cost | <$20 |

---

## 13. Future Enhancements (V2+)

- **Spaced repetition:** Integrate vocabulary review with SRS algorithm
- **Pronunciation scoring:** Use Deepgram's pronunciation assessment
- **Multiple languages:** Extend to Spanish, German, etc.
- **Offline mode:** Cache recent vocabulary for offline review
- **Social features:** Practice with other learners
- **OpenAI Realtime API:** Add pure audio mode for fluency practice
- **Native app:** If PWA limitations become frustrating, port to React Native

---

## 14. Open Questions

1. **Voice activity detection vs. push-to-talk:** Start with push-to-talk for reliability; add VAD later?
2. **Audio recording storage:** Save audio clips for pronunciation review, or transcript-only?
3. **Fallback TTS:** Use OpenAI TTS as cheaper fallback if ElevenLabs quota exceeded?
4. **Session length limits:** Cap sessions at 30 minutes to manage costs?

---

## 15. Getting Started with Claude Code

When you're ready to build, give Claude Code this PRD and say:

> "I want to build this French tutor PWA. Let's start with Phase 1: set up the Next.js project, configure Supabase, and build basic auth. Guide me step by step."

Claude Code will:
1. Create the project structure
2. Install dependencies
3. Help you set up Supabase (you'll need to create an account)
4. Build the auth flow
5. Test as you go

You'll learn the codebase as you build it, and can always ask "explain what this does" for any part you don't understand.

---

*Document generated for Ranbir Singh — January 24, 2026*
