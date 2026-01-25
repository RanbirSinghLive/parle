import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SessionService } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = "free_conversation", lessonTopic } = body as {
      mode?: "free_conversation" | "structured_lesson";
      lessonTopic?: string;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionService = new SessionService(supabase, user.id);
    const sessionId = await sessionService.startSession(mode, lessonTopic);

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Failed to start session:", error);
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 }
    );
  }
}
