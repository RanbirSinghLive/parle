import { NextRequest, NextResponse } from "next/server";

// Diagnostic endpoint to verify ElevenLabs configuration
export async function GET(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  const diagnostics: {
    configured: boolean;
    apiKeyPresent: boolean;
    apiKeyLength: number;
    voiceIdPresent: boolean;
    voiceId: string | null;
    voiceIdLength: number;
    modelId: string;
    voiceDetails: unknown;
    voiceValidation: {
      valid: boolean;
      error?: string;
      availableModels?: string[];
    };
    recommendations: string[];
  } = {
    configured: !!(apiKey && voiceId),
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    voiceIdPresent: !!voiceId,
    voiceId: voiceId || null,
    voiceIdLength: voiceId?.length || 0,
    modelId: modelId,
    voiceDetails: null,
    voiceValidation: {
      valid: false,
    },
    recommendations: [],
  };

  // Add recommendations based on configuration
  if (!apiKey) {
    diagnostics.recommendations.push("Set ELEVENLABS_API_KEY in your environment variables");
  }

  if (!voiceId) {
    diagnostics.recommendations.push("Set ELEVENLABS_VOICE_ID in your environment variables");
    diagnostics.recommendations.push("You can find voice IDs at: https://elevenlabs.io/app/voice-lab");
  }

  // If we have credentials, try to validate the voice
  if (apiKey && voiceId) {
    try {
      // Fetch voice details from ElevenLabs API
      const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        headers: {
          "xi-api-key": apiKey,
        },
      });

      if (voiceResponse.ok) {
        const voiceData = await voiceResponse.json();
        diagnostics.voiceDetails = {
          name: voiceData.name,
          category: voiceData.category,
          description: voiceData.description,
          labels: voiceData.labels,
          preview_url: voiceData.preview_url,
          available_for_tiers: voiceData.available_for_tiers,
          high_quality_base_model_ids: voiceData.high_quality_base_model_ids,
        };
        diagnostics.voiceValidation.valid = true;
        diagnostics.voiceValidation.availableModels = voiceData.high_quality_base_model_ids || [];

        // Check if the current model is compatible with this voice
        const availableModels = voiceData.high_quality_base_model_ids || [];
        if (availableModels.length > 0 && !availableModels.includes(modelId)) {
          diagnostics.recommendations.push(
            `Your voice "${voiceData.name}" may not be fully compatible with model "${modelId}". ` +
            `Compatible models: ${availableModels.join(", ")}`
          );
          diagnostics.recommendations.push(
            `Consider setting ELEVENLABS_MODEL_ID to "${availableModels[0]}" for best results`
          );
        }
      } else {
        const errorText = await voiceResponse.text();
        diagnostics.voiceValidation.valid = false;
        diagnostics.voiceValidation.error = `Voice validation failed: ${voiceResponse.status} - ${errorText}`;

        if (voiceResponse.status === 401) {
          diagnostics.recommendations.push("API key appears to be invalid. Check your ELEVENLABS_API_KEY");
        } else if (voiceResponse.status === 404) {
          diagnostics.recommendations.push(
            `Voice ID "${voiceId}" not found. Verify it exists in your ElevenLabs account.`
          );
          diagnostics.recommendations.push(
            "Go to https://elevenlabs.io/app/voice-lab and copy the correct voice ID"
          );
        }
      }
    } catch (error) {
      diagnostics.voiceValidation.valid = false;
      diagnostics.voiceValidation.error = `Failed to validate voice: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Also list available voices for comparison
    try {
      const voicesResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": apiKey,
        },
      });

      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json();
        const voices = voicesData.voices || [];

        // If the configured voice wasn't found, suggest available voices
        if (!diagnostics.voiceValidation.valid) {
          const voiceList = voices.slice(0, 5).map((v: { voice_id: string; name: string }) =>
            `${v.name}: ${v.voice_id}`
          );
          diagnostics.recommendations.push(
            `Available voices in your account: ${voiceList.join(", ")}${voices.length > 5 ? ` (and ${voices.length - 5} more)` : ""}`
          );
        }
      }
    } catch {
      // Ignore errors fetching voice list
    }
  }

  return NextResponse.json(diagnostics, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Test synthesis with a short phrase
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "ElevenLabs not configured", configured: false },
      { status: 400 }
    );
  }

  const testText = "Bonjour, ceci est un test de la voix ElevenLabs.";

  try {
    console.log("[TTS Diagnose] Testing synthesis with voice:", voiceId, "model:", modelId);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: testText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TTS Diagnose] Synthesis failed:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Synthesis failed",
          status: response.status,
          details: errorText,
          voiceId,
          modelId,
        },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("[TTS Diagnose] Synthesis successful, audio size:", audioBuffer.byteLength, "bytes");

    // Return the audio for testing
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "X-Voice-Id": voiceId,
        "X-Model-Id": modelId,
      },
    });
  } catch (error) {
    console.error("[TTS Diagnose] Error:", error);
    return NextResponse.json(
      {
        error: "Synthesis error",
        details: error instanceof Error ? error.message : String(error),
        voiceId,
        modelId,
      },
      { status: 500 }
    );
  }
}
