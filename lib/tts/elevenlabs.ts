import { TTSService } from "./types";

export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;

  constructor(apiKey: string, voiceId: string, modelId?: string) {
    // Trim whitespace from voice ID to prevent issues
    this.apiKey = apiKey.trim();
    this.voiceId = voiceId.trim();
    // Use multilingual model by default for better voice compatibility
    // eleven_multilingual_v2 supports more voices and languages
    // eleven_turbo_v2_5 is faster but may not support all voices
    this.modelId = modelId?.trim() || process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

    console.log("[ElevenLabs] Service initialized with:");
    console.log("[ElevenLabs]   Voice ID:", this.voiceId);
    console.log("[ElevenLabs]   Voice ID length:", this.voiceId.length);
    console.log("[ElevenLabs]   Model ID:", this.modelId);
  }

  async synthesize(text: string): Promise<ArrayBuffer | null> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    console.log("[ElevenLabs] Synthesizing text, length:", text.length);
    console.log("[ElevenLabs] Using voice ID:", this.voiceId, "(length:", this.voiceId.length + ")");
    console.log("[ElevenLabs] Using model ID:", this.modelId);
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
          model_id: this.modelId,
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
