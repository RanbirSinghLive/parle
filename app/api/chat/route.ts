import { NextRequest, NextResponse } from "next/server";
import { getClaudeService, ChatMessage, LearnerProfile, VocabularyEntry, GrammarEntry } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import { Json } from "@/lib/supabase/types";

/**
 * Converts database profile to LearnerProfile format
 */
function convertToLearnerProfile(dbProfile: {
  current_level: string;
  vocabulary: Json;
  grammar: Json;
  strengths: string[];
  weaknesses: string[];
  total_practice_minutes: number;
  streak_days: number;
  last_session_date: string | null;
}): LearnerProfile {
  // Parse vocabulary from JSON
  const rawVocabulary = (dbProfile.vocabulary as unknown[]) || [];
  const vocabulary: VocabularyEntry[] = rawVocabulary.map((v: unknown) => {
    const entry = v as Record<string, unknown>;
    return {
      word: (entry.word as string) || "",
      translation: (entry.translation as string) || "",
      exampleSentence: entry.example_sentence as string | undefined,
      masteryLevel: ((entry.mastery_level as number) || 1) as 1 | 2 | 3 | 4 | 5,
      timesSeen: (entry.times_seen as number) || 0,
      timesCorrect: (entry.times_correct as number) || 0,
      lastSeen: entry.last_seen ? new Date(entry.last_seen as string) : new Date(),
      tags: (entry.tags as string[]) || [],
    };
  });

  // Parse grammar from JSON
  const rawGrammar = (dbProfile.grammar as unknown[]) || [];
  const grammar: GrammarEntry[] = rawGrammar.map((g: unknown) => {
    const entry = g as Record<string, unknown>;
    return {
      rule: (entry.rule as string) || "",
      description: (entry.description as string) || "",
      masteryLevel: ((entry.mastery_level as number) || 1) as 1 | 2 | 3 | 4 | 5,
      commonErrors: (entry.common_errors as string[]) || [],
      lastPracticed: entry.last_practiced ? new Date(entry.last_practiced as string) : new Date(),
    };
  });

  return {
    currentLevel: (dbProfile.current_level as LearnerProfile["currentLevel"]) || "A1",
    vocabulary,
    grammar,
    strengths: dbProfile.strengths || [],
    weaknesses: dbProfile.weaknesses || [],
    totalPracticeMinutes: dbProfile.total_practice_minutes || 0,
    streakDays: dbProfile.streak_days || 0,
    lastSessionDate: dbProfile.last_session_date ? new Date(dbProfile.last_session_date) : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userMessage } = body as {
      messages: ChatMessage[];
      userMessage: string;
    };

    if (!userMessage) {
      return NextResponse.json(
        { error: "No user message provided" },
        { status: 400 }
      );
    }

    // Fetch user profile from Supabase
    let learnerProfile: LearnerProfile | null = null;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_level, vocabulary, grammar, strengths, weaknesses, total_practice_minutes, streak_days, last_session_date")
          .eq("id", user.id)
          .single();

        if (profile) {
          learnerProfile = convertToLearnerProfile(profile);
        }
      }
    } catch (profileError) {
      // Log but don't fail - continue without profile
      console.warn("Could not fetch user profile:", profileError);
    }

    const claudeService = getClaudeService();
    const response = await claudeService.chat(messages || [], userMessage, learnerProfile);

    return NextResponse.json({
      content: response.content,
      corrections: response.corrections,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Chat failed" },
      { status: 500 }
    );
  }
}
