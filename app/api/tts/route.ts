import { NextRequest, NextResponse } from "next/server";
import { getTTSService, hasElevenLabsTTS } from "@/lib/tts";

export async function POST(request: NextRequest) {
  let text: string | undefined;
  
  try {
    const body = await request.json();
    text = body.text as string;

    console.log("[TTS] Received request with text length:", text?.length || 0);
    console.log("[TTS] ELEVENLABS_API_KEY present:", !!process.env.ELEVENLABS_API_KEY);
    console.log("[TTS] ELEVENLABS_VOICE_ID present:", !!process.env.ELEVENLABS_VOICE_ID);

    if (!text) {
      console.error("[TTS] No text provided in request");
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Check if ElevenLabs is configured
    if (!hasElevenLabsTTS()) {
      console.warn("[TTS] ElevenLabs not configured, falling back to browser TTS");
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    const ttsService = getTTSService();
    if (!ttsService) {
      console.warn("[TTS] TTS service not available, falling back to browser TTS");
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    console.log("[TTS] Synthesizing audio with ElevenLabs...");
    const audioBuffer = await ttsService.synthesize(text);

    if (!audioBuffer) {
      console.warn("[TTS] No audio buffer returned, falling back to browser TTS");
      return NextResponse.json({
        useBrowserTTS: true,
        text,
      });
    }

    console.log("[TTS] Successfully generated audio, size:", audioBuffer.byteLength, "bytes");
    
    if (audioBuffer.byteLength === 0) {
      console.error("[TTS] Generated audio buffer is empty!");
      return NextResponse.json({
        useBrowserTTS: true,
        text: text || "",
        error: "Empty audio buffer",
      });
    }
    
    // Return audio as binary response
    console.log("[TTS] Returning audio response with Content-Type: audio/mpeg");
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[TTS] Error during synthesis:", error);
    console.error("[TTS] Error details:", error instanceof Error ? error.message : String(error));
    // Fallback to browser TTS on error - use stored text variable
    return NextResponse.json({
      useBrowserTTS: true,
      text: text || "",
    });
  }
}
