import { NextRequest, NextResponse } from "next/server";
import { getTTSService, hasElevenLabsTTS } from "@/lib/tts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Check if ElevenLabs is configured
    if (!hasElevenLabsTTS()) {
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    const ttsService = getTTSService();
    if (!ttsService) {
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    const audioBuffer = await ttsService.synthesize(text);

    if (!audioBuffer) {
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    // Return audio as binary response
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    // Fallback to browser TTS on error
    return NextResponse.json({
      useBrowserTTS: true,
      text: (await request.json()).text,
    });
  }
}
