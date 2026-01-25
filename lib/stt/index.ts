import { STTService } from "./types";
import { mockSTT } from "./mock";
import { createDeepgramSTT } from "./deepgram";

export type { STTResult, STTService } from "./types";

let sttService: STTService | null = null;

export function getSTTService(): STTService {
  if (sttService) return sttService;

  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (apiKey) {
    console.log("Using Deepgram STT service");
    sttService = createDeepgramSTT(apiKey);
  } else {
    console.log("Using mock STT service (no DEEPGRAM_API_KEY)");
    sttService = mockSTT;
  }

  return sttService;
}

// For client-side use, we'll call an API route
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Transcription failed");
  }

  const data = await response.json();
  return data.transcript;
}
