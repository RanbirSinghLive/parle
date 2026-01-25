import { TTSService } from "./types";

export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string, voiceId: string) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(text: string): Promise<ArrayBuffer | null> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    console.log("[ElevenLabs] Synthesizing text, length:", text.length);
    console.log("[ElevenLabs] Using voice ID:", this.voiceId);
    console.log("[ElevenLabs] API endpoint:", url);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5", // Faster model with lower latency
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      console.log("[ElevenLabs] Response status:", response.status);
      console.log("[ElevenLabs] Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ElevenLabs] API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log("[ElevenLabs] Successfully received audio, size:", audioBuffer.byteLength, "bytes");
      
      if (audioBuffer.byteLength === 0) {
        console.error("[ElevenLabs] Received empty audio buffer from API");
        throw new Error("Empty audio buffer received from ElevenLabs API");
      }
      
      console.log("[ElevenLabs] Audio buffer first 20 bytes:", Array.from(new Uint8Array(audioBuffer.slice(0, 20))));
      return audioBuffer;
    } catch (error) {
      console.error("[ElevenLabs] Fetch error:", error);
      if (error instanceof Error) {
        console.error("[ElevenLabs] Error message:", error.message);
        console.error("[ElevenLabs] Error stack:", error.stack);
      }
      throw error;
    }
  }
}

export function createElevenLabsTTS(apiKey: string, voiceId: string): TTSService {
  return new ElevenLabsTTSService(apiKey, voiceId);
}
