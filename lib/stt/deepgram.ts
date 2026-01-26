import { STTResult, STTService } from "./types";

// Map of MIME types to Deepgram-compatible content types
// Deepgram supports: audio/wav, audio/mpeg, audio/mp3, audio/mp4, audio/webm, audio/ogg, audio/flac
function getDeepgramContentType(blobType: string): string {
  console.log("[Deepgram] Original blob type:", blobType);
  
  // Normalize the MIME type (remove codecs info)
  const baseType = blobType.split(";")[0].toLowerCase().trim();
  console.log("[Deepgram] Base MIME type:", baseType);
  
  // Map common types to Deepgram-supported types
  const typeMap: Record<string, string> = {
    "audio/webm": "audio/webm",
    "audio/mp4": "audio/mp4",
    "audio/aac": "audio/mp4", // AAC is typically in MP4 container on iOS
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/mpeg": "audio/mpeg",
    "audio/mp3": "audio/mp3",
    "audio/ogg": "audio/ogg",
    "audio/wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/flac": "audio/flac",
  };
  
  const mappedType = typeMap[baseType] || "audio/webm";
  console.log("[Deepgram] Mapped content type:", mappedType);
  
  return mappedType;
}

export class DeepgramSTTService implements STTService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audioBlob: Blob): Promise<STTResult> {
    console.log("[Deepgram] Starting transcription");
    console.log("[Deepgram] Audio blob size:", audioBlob.size, "bytes");
    console.log("[Deepgram] Audio blob type:", audioBlob.type);
    
    if (audioBlob.size === 0) {
      console.error("[Deepgram] Empty audio blob received");
      throw new Error("Empty audio blob");
    }
    
    // Convert blob to buffer for API
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[Deepgram] Buffer created, size:", buffer.length, "bytes");
    
    // Get the correct content type for Deepgram
    const contentType = getDeepgramContentType(audioBlob.type);
    
    // Build Deepgram URL with parameters
    // - model=nova-2: Latest and most accurate model
    // - language=fr: French transcription
    // - punctuate=true: Add punctuation
    // - detect_language=false: We know it's French, don't auto-detect
    // - smart_format=true: Better formatting for readability
    const deepgramUrl = new URL("https://api.deepgram.com/v1/listen");
    deepgramUrl.searchParams.set("model", "nova-2");
    deepgramUrl.searchParams.set("language", "fr");
    deepgramUrl.searchParams.set("punctuate", "true");
    deepgramUrl.searchParams.set("smart_format", "true");
    
    console.log("[Deepgram] API URL:", deepgramUrl.toString());
    console.log("[Deepgram] Content-Type header:", contentType);

    const response = await fetch(deepgramUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": contentType,
      },
      body: buffer,
    });

    console.log("[Deepgram] Response status:", response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error("[Deepgram] API error:", response.status, error);
      throw new Error(`Deepgram API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log("[Deepgram] Response received, metadata:", JSON.stringify(data.metadata || {}));
    
    const result = data.results?.channels?.[0]?.alternatives?.[0];
    
    console.log("[Deepgram] Transcript:", result?.transcript || "(empty)");
    console.log("[Deepgram] Confidence:", result?.confidence);

    return {
      transcript: result?.transcript || "",
      confidence: result?.confidence,
    };
  }
}

export function createDeepgramSTT(apiKey: string): STTService {
  return new DeepgramSTTService(apiKey);
}
