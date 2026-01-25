import { NextRequest, NextResponse } from "next/server";
import { getSTTService } from "@/lib/stt";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const sttService = getSTTService();
    const result = await sttService.transcribe(audioFile);

    return NextResponse.json({
      transcript: result.transcript,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
