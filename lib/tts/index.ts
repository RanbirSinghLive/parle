import { TTSService } from "./types";
import { createElevenLabsTTS } from "./elevenlabs";

export type { TTSService } from "./types";
export { speakText, initVoices } from "./browser";

let ttsService: TTSService | null = null;

export function getTTSService(): TTSService | null {
  if (ttsService) return ttsService;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (apiKey && voiceId) {
    console.log("Using ElevenLabs TTS service");
    ttsService = createElevenLabsTTS(apiKey, voiceId);
    return ttsService;
  }

  console.log("Using browser TTS (no ELEVENLABS_API_KEY)");
  return null; // Signal to use browser TTS on client
}

export function hasElevenLabsTTS(): boolean {
  return !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}
