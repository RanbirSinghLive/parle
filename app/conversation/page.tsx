"use client";

import { Suspense, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Transcript } from "@/components/Transcript";
import { PushToTalkButton } from "@/components/PushToTalkButton";
import { SessionSummary } from "@/components/SessionSummary";
import { useConversationStore } from "@/stores/conversation";
import { speakText, initVoices } from "@/lib/tts/browser";
import { createClient } from "@/lib/supabase/client";
import { TranscriptEntry } from "@/lib/session";

// Helper to get the best supported audio MIME type for the current browser
function getSupportedAudioMimeType(): string {
  // Order of preference: WebM (Chrome/Firefox), MP4 (Safari/iOS), then fallback
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log("[Audio] Supported MIME type found:", mimeType);
      return mimeType;
    }
  }

  console.warn("[Audio] No preferred MIME type supported, using browser default");
  return "";
}

function ConversationContent() {
  const searchParams = useSearchParams();
  const lessonTopic = searchParams.get("topic");
  // Session state
  const sessionId = useConversationStore((state) => state.sessionId);
  const isSessionActive = useConversationStore((state) => state.isSessionActive);
  const isEndingSession = useConversationStore((state) => state.isEndingSession);
  const sessionSummary = useConversationStore((state) => state.sessionSummary);
  const startSession = useConversationStore((state) => state.startSession);
  const endSession = useConversationStore((state) => state.endSession);
  const setEndingSession = useConversationStore((state) => state.setEndingSession);
  const clearSession = useConversationStore((state) => state.clearSession);

  // Conversation state
  const messages = useConversationStore((state) => state.messages);
  const allCorrections = useConversationStore((state) => state.allCorrections);
  const addMessage = useConversationStore((state) => state.addMessage);
  const setProcessing = useConversationStore((state) => state.setProcessing);
  const setSpeaking = useConversationStore((state) => state.setSpeaking);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioMimeTypeRef = useRef<string>(""); // Store the actual MIME type being used
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Initialize browser TTS voices
  useEffect(() => {
    initVoices();
  }, []);

  // Fix iOS viewport height issue - ensure button is always visible
  useEffect(() => {
    console.log("[Conversation] Setting up iOS viewport height fix");
    console.log("[Conversation] User agent:", navigator.userAgent);
    console.log("[Conversation] Initial window.innerHeight:", window.innerHeight, "px");
    console.log("[Conversation] Initial window.visualViewport?.height:", window.visualViewport?.height, "px");
    
    const setViewportHeight = () => {
      // Use visualViewport if available (better for iOS), otherwise fall back to innerHeight
      const vh = window.visualViewport?.height || window.innerHeight;
      console.log("[Conversation] Current viewport height:", vh, "px (visualViewport:", window.visualViewport?.height, "innerHeight:", window.innerHeight, ")");
      
      // Set CSS custom property for dynamic viewport height
      const vhValue = `${vh * 0.01}px`;
      document.documentElement.style.setProperty('--vh', vhValue);
      console.log("[Conversation] Set --vh CSS variable to:", vhValue);
      
      // Log the computed height of the main container for debugging
      const mainContainer = document.querySelector('[data-conversation-container]');
      if (mainContainer) {
        const computedHeight = window.getComputedStyle(mainContainer).height;
        console.log("[Conversation] Main container computed height:", computedHeight);
      }
    };

    // Set initial height with a small delay to ensure accurate measurement
    setTimeout(setViewportHeight, 0);

    // Update on resize (handles iOS Safari address bar show/hide)
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
      console.log("[Conversation] Orientation changed, updating viewport height");
      // Small delay to ensure accurate height after orientation change
      setTimeout(setViewportHeight, 100);
    });

    // Also listen for visual viewport changes (better for iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setViewportHeight);
      window.visualViewport.addEventListener('scroll', setViewportHeight);
      console.log("[Conversation] Added visualViewport resize and scroll listeners");
    }

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setViewportHeight);
        window.visualViewport.removeEventListener('scroll', setViewportHeight);
      }
      console.log("[Conversation] Cleaned up viewport height listeners");
    };
  }, []);

  // Request microphone permission early and keep stream alive
  // This helps iOS PWAs maintain permission between sessions
  useEffect(() => {
    console.log("[Conversation] Requesting microphone permission on page load");
    
    const requestMicrophonePermission = async () => {
      try {
        // Check if we already have a stream
        if (audioStreamRef.current) {
          console.log("[Conversation] Audio stream already exists, reusing");
          return;
        }

        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("[Conversation] getUserMedia not available in this browser");
          return;
        }

        // Request microphone permission
        console.log("[Conversation] Calling getUserMedia to request microphone permission");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        console.log("[Conversation] Microphone permission granted, stream active:", stream.active);
        console.log("[Conversation] Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

        // Monitor stream state
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            console.log("[Conversation] Audio track ended:", track.kind);
          };
          track.onmute = () => {
            console.warn("[Conversation] Audio track muted:", track.kind);
          };
          track.onunmute = () => {
            console.log("[Conversation] Audio track unmuted:", track.kind);
          };
        });
      } catch (error) {
        console.error("[Conversation] Failed to request microphone permission:", error);
        // Don't throw - user can still grant permission when they press the button
        if (error instanceof Error) {
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            console.warn("[Conversation] Microphone permission denied by user");
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            console.warn("[Conversation] No microphone found");
          } else {
            console.error("[Conversation] Unexpected error requesting microphone:", error.message);
          }
        }
      }
    };

    requestMicrophonePermission();

    // Cleanup: stop tracks when component unmounts
    return () => {
      console.log("[Conversation] Component unmounting, cleaning up audio stream");
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => {
          console.log("[Conversation] Stopping track:", track.kind);
          track.stop();
        });
        audioStreamRef.current = null;
      }
    };
  }, []);

  // Start a new session when page loads (if not already in one)
  useEffect(() => {
    if (!isSessionActive && !sessionSummary) {
      handleStartSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = async (topic?: string | null) => {
    const sessionTopic = topic ?? lessonTopic;
    const mode = sessionTopic ? "structured_lesson" : "free_conversation";

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          lessonTopic: sessionTopic || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start session");
      }

      const { sessionId: newSessionId } = await response.json();
      startSession(newSessionId);

      // If it's a structured lesson, add an initial tutor message about the topic
      if (sessionTopic) {
        const greeting = `Bonjour! Today we'll practice "${sessionTopic}". Let's start! Comment allez-vous?`;
        addMessage({ role: "tutor", content: greeting });

        // Speak the greeting
        try {
          console.log("[Conversation] Requesting TTS for greeting:", greeting);
          const ttsResponse = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: greeting }),
          });

          console.log("[Conversation] Greeting TTS response status:", ttsResponse.status);
          console.log("[Conversation] Greeting TTS response ok:", ttsResponse.ok);
          
          if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error("[Conversation] Greeting TTS API returned error:", ttsResponse.status, errorText);
            throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
          }
          
          const contentType = ttsResponse.headers.get("content-type");
          console.log("[Conversation] Greeting TTS response content-type:", contentType);
          
          if (contentType?.includes("audio/mpeg")) {
            console.log("[Conversation] Playing ElevenLabs audio for greeting");
            setSpeaking(true);
            const audioBuffer = await ttsResponse.arrayBuffer();
            console.log("[Conversation] Greeting audio buffer size:", audioBuffer.byteLength, "bytes");
            
            if (audioBuffer.byteLength === 0) {
              console.error("[Conversation] Empty audio buffer for greeting");
              throw new Error("Empty audio buffer");
            }
            
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            
            // Set up event handlers
            audio.onended = () => {
              console.log("[Conversation] Greeting audio playback ended");
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = (error) => {
              console.error("[Conversation] Greeting audio playback error:", error);
              console.error("[Conversation] Greeting audio error details:", {
                code: audio.error?.code,
                message: audio.error?.message,
              });
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audio.oncanplay = () => {
              console.log("[Conversation] Greeting audio can play");
            };
            audio.onloadeddata = () => {
              console.log("[Conversation] Greeting audio data loaded");
            };
            
            // Wait for audio to be ready
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              await playPromise;
              console.log("[Conversation] Greeting audio play() called successfully");
            } else {
              // Fallback for older browsers
              console.log("[Conversation] Greeting audio play() called (legacy)");
            }
          } else {
            console.log("[Conversation] Falling back to browser TTS for greeting");
            const responseData = await ttsResponse.json();
            console.log("[Conversation] Greeting TTS API response:", responseData);
            setSpeaking(true);
            try {
              await speakText(greeting, "fr-FR");
              console.log("[Conversation] Browser TTS for greeting completed");
            } catch (browserTTSError) {
              console.error("[Conversation] Browser TTS error for greeting:", browserTTSError);
            }
            setSpeaking(false);
          }
        } catch (error) {
          console.error("[Conversation] TTS error for greeting, falling back to browser:", error);
          console.error("[Conversation] Greeting TTS error details:", error instanceof Error ? error.message : String(error));
          // Fallback to browser TTS
          setSpeaking(true);
          try {
            await speakText(greeting, "fr-FR");
            console.log("[Conversation] Browser TTS fallback for greeting completed");
          } catch (browserTTSError) {
            console.error("[Conversation] Browser TTS fallback error for greeting:", browserTTSError);
          }
          setSpeaking(false);
        }
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      // Continue anyway - we can still have a conversation without persistence
      startSession("local-" + Date.now());
    }
  };

  const handleEndSession = async () => {
    if (!sessionId || isEndingSession) return;

    console.log("[Conversation] Ending session, cleaning up audio stream");
    // Stop audio stream when session ends
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        console.log("[Conversation] Stopping track on session end:", track.kind);
        track.stop();
      });
      audioStreamRef.current = null;
    }

    setEndingSession(true);

    try {
      // Convert messages to transcript format
      const transcript: TranscriptEntry[] = messages.map((msg) => ({
        timestamp: msg.timestamp.toISOString(),
        speaker: msg.role === "user" ? "user" : "tutor",
        text: msg.content,
      }));

      const response = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          transcript,
          corrections: allCorrections,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to end session");
      }

      const { summary } = await response.json();
      endSession(summary);
    } catch (error) {
      console.error("Failed to end session:", error);
      // Show a basic summary if API fails
      endSession({
        durationMinutes: Math.round(
          (Date.now() - (useConversationStore.getState().sessionStartTime?.getTime() || Date.now())) /
            60000
        ),
        newVocabulary: [],
        practicedGrammar: [],
        correctionsCount: allCorrections.length,
        highlights: "Session completed!",
        recommendedFocus: ["Keep practicing!"],
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.push("/login");
    router.refresh();
  };

  // Convert our messages to the format expected by the chat API
  const getApiMessages = useCallback(() => {
    return messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));
  }, [messages]);

  const handleRecordingStart = useCallback(async () => {
    try {
      console.log("[Conversation] Starting recording...");
      console.log("[Conversation] User agent:", navigator.userAgent);
      
      // Reuse existing stream if available, otherwise request new one
      let stream = audioStreamRef.current;
      
      if (!stream || stream.getTracks().every(track => track.readyState === "ended")) {
        console.log("[Conversation] No active stream, requesting new microphone access");
        // Request audio with quality constraints for better transcription
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // Request 16kHz sample rate (ideal for speech recognition)
            // Browsers may not honor this but it's a hint
            sampleRate: { ideal: 16000 },
            channelCount: { ideal: 1 }, // Mono is better for speech
          } 
        });
        audioStreamRef.current = stream;
        console.log("[Conversation] New microphone stream obtained");
        
        // Log audio track settings for debugging
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const settings = audioTrack.getSettings();
          console.log("[Conversation] Audio track settings:", JSON.stringify(settings));
        }
      } else {
        console.log("[Conversation] Reusing existing microphone stream");
        // Ensure tracks are enabled
        stream.getTracks().forEach((track) => {
          if (track.readyState === "live" && !track.enabled) {
            track.enabled = true;
            console.log("[Conversation] Re-enabled audio track");
          }
        });
      }

      // Detect the best supported MIME type for this browser/device
      const supportedMimeType = getSupportedAudioMimeType();
      console.log("[Conversation] Using MIME type:", supportedMimeType || "browser default");
      
      // Store the MIME type for later use when creating the blob
      audioMimeTypeRef.current = supportedMimeType;

      // Create MediaRecorder with the detected MIME type
      const mediaRecorderOptions: MediaRecorderOptions = {};
      if (supportedMimeType) {
        mediaRecorderOptions.mimeType = supportedMimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
      
      // Log the actual MIME type being used (may differ from requested)
      console.log("[Conversation] MediaRecorder created with mimeType:", mediaRecorder.mimeType);
      audioMimeTypeRef.current = mediaRecorder.mimeType; // Use actual mimeType from recorder
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("[Conversation] Received audio chunk:", event.data.size, "bytes, type:", event.data.type);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("[Conversation] MediaRecorder error:", event);
      };

      mediaRecorder.onstart = () => {
        console.log("[Conversation] MediaRecorder started, state:", mediaRecorder.state, "mimeType:", mediaRecorder.mimeType);
      };

      mediaRecorder.start();
      console.log("[Conversation] Recording started successfully with mimeType:", mediaRecorder.mimeType);
    } catch (error) {
      console.error("[Conversation] Failed to start recording:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          console.error("[Conversation] Microphone permission denied");
        } else if (error.name === "NotFoundError") {
          console.error("[Conversation] No microphone found");
        } else {
          console.error("[Conversation] Recording error:", error.message);
        }
      }
    }
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) {
      console.warn("[Conversation] No media recorder to stop");
      return;
    }

    console.log("[Conversation] Stopping recording, current state:", mediaRecorder.state);

    mediaRecorder.onstop = async () => {
      console.log("[Conversation] MediaRecorder stopped, processing audio");
      
      // IMPORTANT: Don't stop tracks here - keep them alive for iOS PWA permission persistence
      // iOS revokes microphone permissions if tracks are stopped immediately after recording
      // We'll keep the stream alive and only stop tracks on component unmount
      console.log("[Conversation] Keeping audio stream alive for permission persistence (iOS PWA workaround)");

      // Use the actual MIME type from the MediaRecorder, not a hardcoded value
      // This is critical for iOS which uses audio/mp4 instead of audio/webm
      const actualMimeType = audioMimeTypeRef.current || mediaRecorder.mimeType || "audio/webm";
      console.log("[Conversation] Creating audio blob with MIME type:", actualMimeType);
      
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
      console.log("[Conversation] Audio blob created, size:", audioBlob.size, "bytes, type:", audioBlob.type);

      setProcessing(true);

      try {
        // Step 1: Transcribe audio
        const formData = new FormData();
        formData.append("audio", audioBlob);

        const transcribeResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!transcribeResponse.ok) {
          throw new Error("Transcription failed");
        }

        const { transcript } = await transcribeResponse.json();

        if (!transcript || transcript.trim() === "") {
          setProcessing(false);
          return;
        }

        // Add user message to transcript
        addMessage({ role: "user", content: transcript });

        // Step 2: Get tutor response from Claude
        const chatResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: getApiMessages(),
            userMessage: transcript,
          }),
        });

        if (!chatResponse.ok) {
          throw new Error("Chat failed");
        }

        const { content: tutorResponse, corrections } = await chatResponse.json();

        // Add tutor response to transcript with any corrections
        addMessage({ role: "tutor", content: tutorResponse, corrections: corrections || [] });

        setProcessing(false);

        // Step 3: Play TTS
        try {
          console.log("[Conversation] Requesting TTS for text:", tutorResponse.substring(0, 50) + "...");
          const ttsResponse = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: tutorResponse }),
          });

          console.log("[Conversation] TTS response status:", ttsResponse.status);
          console.log("[Conversation] TTS response ok:", ttsResponse.ok);
          
          if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error("[Conversation] TTS API returned error:", ttsResponse.status, errorText);
            throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
          }
          
          const contentType = ttsResponse.headers.get("content-type");
          console.log("[Conversation] TTS response content-type:", contentType);

          if (contentType?.includes("audio/mpeg")) {
            // ElevenLabs audio returned
            console.log("[Conversation] Playing ElevenLabs audio");
            setSpeaking(true);
            const audioBuffer = await ttsResponse.arrayBuffer();
            console.log("[Conversation] Audio buffer size:", audioBuffer.byteLength, "bytes");
            
            if (audioBuffer.byteLength === 0) {
              console.error("[Conversation] Empty audio buffer received");
              throw new Error("Empty audio buffer");
            }
            
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);

            // Set up event handlers
            audio.onended = () => {
              console.log("[Conversation] Audio playback ended");
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = (error) => {
              console.error("[Conversation] Audio playback error:", error);
              console.error("[Conversation] Audio error details:", {
                code: audio.error?.code,
                message: audio.error?.message,
              });
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audio.onloadstart = () => {
              console.log("[Conversation] Audio loading started");
            };
            audio.oncanplay = () => {
              console.log("[Conversation] Audio can play");
            };
            audio.onloadeddata = () => {
              console.log("[Conversation] Audio data loaded");
            };

            // Wait for audio to be ready and play
            try {
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                await playPromise;
                console.log("[Conversation] Audio play() called successfully");
              } else {
                // Fallback for older browsers
                console.log("[Conversation] Audio play() called (legacy)");
              }
            } catch (playError) {
              console.error("[Conversation] Error calling audio.play():", playError);
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              throw playError;
            }
          } else {
            // Use browser TTS
            console.log("[Conversation] Falling back to browser TTS");
            const responseData = await ttsResponse.json();
            console.log("[Conversation] TTS API response:", responseData);
            setSpeaking(true);
            try {
              await speakText(tutorResponse, "fr-FR");
              console.log("[Conversation] Browser TTS completed");
            } catch (browserTTSError) {
              console.error("[Conversation] Browser TTS error:", browserTTSError);
            }
            setSpeaking(false);
          }
        } catch (ttsError) {
          console.error("[Conversation] TTS error, falling back to browser:", ttsError);
          console.error("[Conversation] TTS error details:", ttsError instanceof Error ? ttsError.message : String(ttsError));
          // Fallback to browser TTS
          setSpeaking(true);
          try {
            await speakText(tutorResponse, "fr-FR");
            console.log("[Conversation] Browser TTS fallback completed");
          } catch (browserTTSError) {
            console.error("[Conversation] Browser TTS fallback error:", browserTTSError);
          }
          setSpeaking(false);
        }
      } catch (error) {
        console.error("[Conversation] Conversation error:", error);
        setProcessing(false);
      }
    };

    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      console.log("[Conversation] MediaRecorder stop() called");
    } else {
      console.warn("[Conversation] MediaRecorder not in recording state:", mediaRecorder.state);
    }
  }, [addMessage, setProcessing, setSpeaking, getApiMessages]);

  // Show session summary if session ended
  if (sessionSummary) {
    return (
      <SessionSummary
        summary={sessionSummary}
        onStartNewSession={() => {
          clearSession();
          handleStartSession();
        }}
        onGoToDashboard={() => {
          clearSession();
          router.push("/dashboard");
        }}
      />
    );
  }

  return (
    <div 
      className="flex flex-col bg-slate-50 dark:bg-slate-900" 
      data-conversation-container
      style={{
        height: 'calc(var(--vh, 1vh) * 100)',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <header className="flex-shrink-0 bg-primary-800 text-white px-4 py-2 shadow-md" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <button
            onClick={handleEndSession}
            disabled={isEndingSession || messages.length === 0}
            className="text-sm text-primary-200 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEndingSession ? "Ending..." : "End"}
          </button>
          <h1 className="text-lg font-semibold">Parle</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-primary-200 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Transcript Area */}
      <Transcript />

      {/* Push-to-talk button area */}
      <footer 
        className="flex-shrink-0 px-4 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700"
        style={{ 
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
        <PushToTalkButton
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
        />
      </footer>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function ConversationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <ConversationContent />
    </Suspense>
  );
}
