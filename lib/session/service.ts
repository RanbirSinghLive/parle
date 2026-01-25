import { Session, TranscriptEntry, SessionSummary } from "./types";
import { Correction } from "@/lib/claude/types";
import { compressSession } from "./compression";

// Use any for Supabase client to avoid complex generic type issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientType = any;

export class SessionService {
  private supabase: SupabaseClientType;
  private userId: string;

  constructor(supabase: SupabaseClientType, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Creates a new session and returns the session ID
   */
  async startSession(
    mode: "free_conversation" | "structured_lesson" = "free_conversation",
    lessonTopic?: string
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("sessions")
      .insert({
        user_id: this.userId,
        mode,
        lesson_topic: lessonTopic || null,
        transcript: [],
        corrections: [],
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to start session: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Updates the session with new transcript entries and corrections
   */
  async updateSession(
    sessionId: string,
    transcript: TranscriptEntry[],
    corrections: Correction[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from("sessions")
      .update({
        transcript,
        corrections,
      })
      .eq("id", sessionId)
      .eq("user_id", this.userId);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Ends a session, compresses it, updates the profile, and returns the summary
   */
  async endSession(
    sessionId: string,
    transcript: TranscriptEntry[],
    corrections: Correction[],
    apiKey?: string
  ): Promise<SessionSummary> {
    // Get session start time to calculate duration
    const { data: session, error: fetchError } = await this.supabase
      .from("sessions")
      .select("started_at")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      throw new Error("Session not found");
    }

    const startTime = new Date(session.started_at);
    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60000
    );

    // Compress the session with Claude
    const summary = await compressSession(
      transcript,
      corrections,
      durationMinutes,
      apiKey
    );

    // Update the session with final data
    const { error: updateError } = await this.supabase
      .from("sessions")
      .update({
        ended_at: endTime.toISOString(),
        transcript,
        corrections,
        summary,
      })
      .eq("id", sessionId)
      .eq("user_id", this.userId);

    if (updateError) {
      throw new Error(`Failed to end session: ${updateError.message}`);
    }

    // Update the user's profile with session learnings
    await this.updateProfileFromSession(summary, corrections, durationMinutes);

    return summary;
  }

  /**
   * Updates the user's profile based on session learnings
   */
  private async updateProfileFromSession(
    summary: SessionSummary,
    corrections: Correction[],
    durationMinutes: number
  ): Promise<void> {
    // Fetch current profile
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("vocabulary, grammar, weaknesses, total_practice_minutes, streak_days, last_session_date")
      .eq("id", this.userId)
      .single();

    if (profileError || !profile) {
      console.error("Could not fetch profile for update");
      return;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Calculate streak
    const lastSessionDate = profile.last_session_date;
    let newStreakDays = profile.streak_days || 0;

    if (lastSessionDate) {
      const lastDate = new Date(lastSessionDate);
      const daysDiff = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // Same day, streak unchanged
      } else if (daysDiff === 1) {
        // Consecutive day, increment streak
        newStreakDays += 1;
      } else {
        // Streak broken, reset to 1
        newStreakDays = 1;
      }
    } else {
      // First session ever
      newStreakDays = 1;
    }

    // Merge new vocabulary
    const existingVocab = (profile.vocabulary || []) as Array<{ word: string }>;
    const newVocab = summary.newVocabulary.map((v) => ({
      word: v.word,
      translation: v.translation,
      example_sentence: v.context,
      mastery_level: 1,
      times_seen: 1,
      times_correct: 0,
      last_seen: now.toISOString(),
      tags: [],
    }));

    // Add new vocab items that don't already exist
    const existingWords = new Set(
      existingVocab.map((v) => v.word.toLowerCase())
    );
    const vocabToAdd = newVocab.filter(
      (v) => !existingWords.has(v.word.toLowerCase())
    );
    const updatedVocabulary = [...existingVocab, ...vocabToAdd];

    // Extract weaknesses from corrections
    const correctionCategories = corrections.map((c) => c.category);
    const weaknessUpdates: string[] = [];
    if (correctionCategories.filter((c) => c === "grammar").length >= 2) {
      weaknessUpdates.push("Grammar patterns need practice");
    }
    if (correctionCategories.filter((c) => c === "vocabulary").length >= 2) {
      weaknessUpdates.push("Vocabulary building needed");
    }

    // Merge weaknesses (keep unique)
    const existingWeaknesses = (profile.weaknesses || []) as string[];
    const allWeaknesses = [...existingWeaknesses, ...weaknessUpdates];
    const updatedWeaknesses = Array.from(new Set(allWeaknesses)).slice(0, 5);

    // Update profile
    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({
        vocabulary: updatedVocabulary,
        weaknesses: updatedWeaknesses,
        total_practice_minutes: (profile.total_practice_minutes || 0) + durationMinutes,
        streak_days: newStreakDays,
        last_session_date: today,
      })
      .eq("id", this.userId);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
    }
  }

  /**
   * Gets a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", this.userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      mode: data.mode as "free_conversation" | "structured_lesson",
      lessonTopic: data.lesson_topic,
      transcript: (data.transcript || []) as TranscriptEntry[],
      corrections: (data.corrections || []) as Correction[],
      summary: data.summary as SessionSummary | null,
    };
  }

  /**
   * Gets recent sessions for history view
   */
  async getRecentSessions(limit: number = 10): Promise<Session[]> {
    const { data, error } = await this.supabase
      .from("sessions")
      .select("*")
      .eq("user_id", this.userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((s: Record<string, unknown>) => ({
      id: s.id as string,
      userId: s.user_id as string,
      startedAt: s.started_at as string,
      endedAt: s.ended_at as string | null,
      mode: s.mode as "free_conversation" | "structured_lesson",
      lessonTopic: s.lesson_topic as string | null,
      transcript: (s.transcript || []) as TranscriptEntry[],
      corrections: (s.corrections || []) as Correction[],
      summary: s.summary as SessionSummary | null,
    }));
  }
}
