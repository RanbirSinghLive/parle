import { TTSService } from "./types";
import { createElevenLabsTTS } from "./elevenlabs";

export type { TTSService } from "./types";
export { speakText, initVoices } from "./browser";

let ttsService: TTSService | null = null;

export function getTTSService(): TTSService | null {
  if (ttsService) {
    console.log("[TTS] Returning cached TTS service");
    return ttsService;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  console.log("[TTS] Initializing TTS service...");
  console.log("[TTS] ELEVENLABS_API_KEY exists:", !!apiKey);
  console.log("[TTS] ELEVENLABS_VOICE_ID exists:", !!voiceId);
  console.log("[TTS] ELEVENLABS_VOICE_ID value:", voiceId || "not set");

  if (apiKey && voiceId) {
    console.log("[TTS] Creating ElevenLabs TTS service");
    ttsService = createElevenLabsTTS(apiKey, voiceId);
    return ttsService;
  }

  console.warn("[TTS] ElevenLabs credentials not found, will use browser TTS");
  console.warn("[TTS] Missing:", {
    apiKey: !apiKey ? "ELEVENLABS_API_KEY" : null,
    voiceId: !voiceId ? "ELEVENLABS_VOICE_ID" : null,
  });
  return null; // Signal to use browser TTS on client
}

export function hasElevenLabsTTS(): boolean {
  const hasApiKey = !!process.env.ELEVENLABS_API_KEY;
  const hasVoiceId = !!process.env.ELEVENLABS_VOICE_ID;
  const result = hasApiKey && hasVoiceId;
  
  console.log("[TTS] hasElevenLabsTTS check:", {
    hasApiKey,
    hasVoiceId,
    result,
  });
  
  return result;
}
