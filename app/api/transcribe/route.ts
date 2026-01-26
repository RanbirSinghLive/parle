import { NextRequest, NextResponse } from "next/server";
import { getSTTService } from "@/lib/stt";

export async function POST(request: NextRequest) {
  console.log("[Transcribe API] Received transcription request");
  
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      console.error("[Transcribe API] No audio file in request");
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    console.log("[Transcribe API] Audio file received:");
    console.log("[Transcribe API]   - Size:", audioFile.size, "bytes");
    console.log("[Transcribe API]   - Type:", audioFile.type);
    
    if (audioFile.size === 0) {
      console.error("[Transcribe API] Empty audio file received");
      return NextResponse.json(
        { error: "Empty audio file" },
        { status: 400 }
      );
    }

    const sttService = getSTTService();
    console.log("[Transcribe API] Calling STT service...");
    
    const result = await sttService.transcribe(audioFile);
    
    console.log("[Transcribe API] Transcription complete:");
    console.log("[Transcribe API]   - Transcript:", result.transcript || "(empty)");
    console.log("[Transcribe API]   - Confidence:", result.confidence);

    return NextResponse.json({
      transcript: result.transcript,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("[Transcribe API] Transcription error:", error);
    console.error("[Transcribe API] Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Transcription failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
