/**
 * Utility functions for deriving progress insights from user data
 */

export interface VocabularyEntry {
  word: string;
  translation: string;
  example_sentence?: string;
  mastery_level: number;
  times_seen: number;
  times_correct: number;
  last_seen: string;
  tags: string[];
}

export interface GrammarEntry {
  rule: string;
  description: string;
  mastery_level: number;
  common_errors: string[];
  last_practiced: string;
}

export interface TroubleWord {
  word: string;
  translation: string;
  timesCorrect: number;
  timesSeen: number;
  correctRatio: number;
  masteryLevel: number;
}

export interface TopicSummary {
  topic: string;
  icon: string;
  sessionCount: number;
  lastPracticed: string;
}

export interface SessionWithSummary {
  id: string;
  started_at: string;
  lesson_topic: string | null;
  summary: {
    durationMinutes: number;
    correctionsCount: number;
    recommendedFocus?: string[];
  } | null;
}

/**
 * Finds words the user struggles with based on low mastery or poor correct/seen ratio
 */
export function getTroubleWords(vocabulary: VocabularyEntry[]): TroubleWord[] {
  return vocabulary
    .filter((v) => {
      // Must have been seen at least 3 times to be meaningful
      if (v.times_seen < 3) return false;

      // Trouble if: low mastery OR low correct ratio
      const correctRatio = v.times_correct / v.times_seen;
      return v.mastery_level <= 2 || correctRatio < 0.5;
    })
    .map((v) => ({
      word: v.word,
      translation: v.translation,
      timesCorrect: v.times_correct,
      timesSeen: v.times_seen,
      correctRatio: v.times_correct / v.times_seen,
      masteryLevel: v.mastery_level,
    }))
    .sort((a, b) => a.correctRatio - b.correctRatio) // Worst first
    .slice(0, 10);
}

// Topic name to icon mapping (derived from LessonPicker)
const TOPIC_ICONS: Record<string, string> = {
  "Free Conversation": "💬",
  "Greetings & Introductions": "👋",
  "Numbers & Time": "🔢",
  "Weather & Seasons": "☀️",
  "At the Restaurant": "🍽️",
  "Shopping & Prices": "🛍️",
  "Asking for Directions": "🗺️",
  "Passé Composé": "📝",
  "Imparfait": "📖",
  "Subjunctive Mood": "🎯",
  "Hobbies & Interests": "🎨",
  "Travel & Vacation": "✈️",
  "Work & Career": "💼",
};

function getTopicIcon(topic: string): string {
  return TOPIC_ICONS[topic] || "📚";
}

/**
 * Aggregates topics practiced from session data
 */
export function aggregateTopics(sessions: SessionWithSummary[]): TopicSummary[] {
  const topicCounts = new Map<string, { count: number; lastDate: string }>();

  for (const session of sessions) {
    const topic = session.lesson_topic || "Free Conversation";
    const existing = topicCounts.get(topic);
    if (existing) {
      existing.count++;
      if (session.started_at > existing.lastDate) {
        existing.lastDate = session.started_at;
      }
    } else {
      topicCounts.set(topic, { count: 1, lastDate: session.started_at });
    }
  }

  return Array.from(topicCounts.entries())
    .map(([topic, data]) => ({
      topic,
      icon: getTopicIcon(topic),
      sessionCount: data.count,
      lastPracticed: data.lastDate,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

/**
 * Extracts and deduplicates recommended focus areas from recent sessions
 */
export function getRecommendedFocus(sessions: SessionWithSummary[]): string[] {
  const focusAreas = new Set<string>();

  // Get recommendations from recent sessions (most recent first)
  const recentSessions = sessions
    .filter((s) => s.summary?.recommendedFocus?.length)
    .slice(0, 5);

  for (const session of recentSessions) {
    for (const focus of session.summary?.recommendedFocus || []) {
      focusAreas.add(focus);
    }
  }

  return Array.from(focusAreas).slice(0, 5);
}
