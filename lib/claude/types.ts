export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  category: "grammar" | "vocabulary" | "pronunciation" | "usage";
}

export interface TutorResponse {
  content: string;
  corrections: Correction[];
}

export interface VocabularyEntry {
  word: string;
  translation: string;
  exampleSentence?: string;
  masteryLevel: 1 | 2 | 3 | 4 | 5;
  timesSeen: number;
  timesCorrect: number;
  lastSeen: Date;
  tags: string[];
}

export interface GrammarEntry {
  rule: string;
  description: string;
  masteryLevel: 1 | 2 | 3 | 4 | 5;
  commonErrors: string[];
  lastPracticed: Date;
}

export interface LearnerProfile {
  currentLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  vocabulary: VocabularyEntry[];
  grammar: GrammarEntry[];
  strengths: string[];
  weaknesses: string[];
  totalPracticeMinutes: number;
  streakDays: number;
  lastSessionDate: Date | null;
}

export interface ClaudeService {
  chat(
    messages: ChatMessage[],
    userMessage: string,
    profile?: LearnerProfile | null,
    tutorName?: string
  ): Promise<TutorResponse>;
}
