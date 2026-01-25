import { NextRequest, NextResponse } from "next/server";
import { getClaudeService, ChatMessage } from "@/lib/claude";

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

    const claudeService = getClaudeService();
    const response = await claudeService.chat(messages || [], userMessage);

    return NextResponse.json({
      content: response.content,
      correction: response.correction,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Chat failed" },
      { status: 500 }
    );
  }
}
