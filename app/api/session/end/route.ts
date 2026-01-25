import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SessionService, TranscriptEntry } from "@/lib/session";
import { Correction } from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, transcript, corrections } = body as {
      sessionId: string;
      transcript: TranscriptEntry[];
      corrections: Correction[];
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionService = new SessionService(supabase, user.id);

    // End the session and get the summary
    const summary = await sessionService.endSession(
      sessionId,
      transcript || [],
      corrections || [],
      process.env.ANTHROPIC_API_KEY
    );

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to end session:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }
}
