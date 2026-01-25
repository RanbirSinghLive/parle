import { Correction } from "@/lib/claude/types";

export interface TranscriptEntry {
  timestamp: string;
  speaker: "user" | "tutor";
  text: string;
}

export interface SessionSummary {
  durationMinutes: number;
  newVocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }>;
  practicedGrammar: string[];
  correctionsCount: number;
  highlights: string;
  recommendedFocus: string[];
}

export interface Session {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  mode: "free_conversation" | "structured_lesson";
  lessonTopic: string | null;
  transcript: TranscriptEntry[];
  corrections: Correction[];
  summary: SessionSummary | null;
}

export interface ProfileUpdate {
  vocabulary?: Array<{
    word: string;
    translation: string;
    example_sentence?: string;
    mastery_level: number;
    times_seen: number;
    times_correct: number;
    last_seen: string;
    tags: string[];
  }>;
  grammar?: Array<{
    rule: string;
    description: string;
    mastery_level: number;
    common_errors: string[];
    last_practiced: string;
  }>;
  strengths?: string[];
  weaknesses?: string[];
  total_practice_minutes?: number;
  streak_days?: number;
  last_session_date?: string;
}
