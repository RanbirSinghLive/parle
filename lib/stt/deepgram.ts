import { STTResult, STTService } from "./types";

export class DeepgramSTTService implements STTService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audioBlob: Blob): Promise<STTResult> {
    // Convert blob to base64 for API
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&language=fr&punctuate=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": audioBlob.type || "audio/webm",
        },
        body: buffer,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const result = data.results?.channels?.[0]?.alternatives?.[0];

    return {
      transcript: result?.transcript || "",
      confidence: result?.confidence,
    };
  }
}

export function createDeepgramSTT(apiKey: string): STTService {
  return new DeepgramSTTService(apiKey);
}
