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

// iOS audio unlock - create a silent audio context to enable playback after async operations
let audioContextUnlocked = false;
let silentAudioElement: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
// Pre-warmed audio element for iOS - created during user gesture, reused for playback
let preWarmedAudioElement: HTMLAudioElement | null = null;
let pendingAudioResolve: (() => void) | null = null;
// Track if the pre-warmed element was successfully primed during a user gesture
let preWarmedElementPrimed = false;

// Detect iOS PWA mode
function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIOS && isStandalone;
}

// Detect if we're on iOS (PWA or browser)
function isIOS(): boolean {
  if (typeof window === "undefined") return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function unlockAudioForIOS(): Promise<boolean> {
  console.log("[iOS Audio] unlockAudioForIOS called");
  console.log("[iOS Audio] Current state - primed:", preWarmedElementPrimed, "context:", sharedAudioContext?.state);

  const onIOS = isIOS();
  console.log("[iOS Audio] Is iOS:", onIOS);

  // CRITICAL: If the pre-warmed element was already successfully primed during a user gesture,
  // DO NOT try to play silent audio again. Playing outside a gesture will FAIL and may taint the element.
  if (preWarmedElementPrimed && preWarmedAudioElement) {
    console.log("[iOS Audio] Pre-warmed element already primed, skipping silent audio play");
    return true;
  }

  let unlocked = false;

  // Method 1: Create and prime a pre-warmed Audio element (critical for iOS)
  // This MUST happen during a user gesture (button press/release)
  try {
    if (!preWarmedAudioElement) {
      console.log("[iOS Audio] Creating new pre-warmed Audio element");
      preWarmedAudioElement = new Audio();
      preWarmedAudioElement.preload = "auto";
      preWarmedAudioElement.volume = 1.0;
      // iOS-specific attributes
      (preWarmedAudioElement as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      preWarmedAudioElement.setAttribute("playsinline", "true");
      preWarmedAudioElement.setAttribute("webkit-playsinline", "true");
    }

    // Only try to play silent audio if not already primed
    if (!preWarmedElementPrimed) {
      // Data URI for a tiny silent MP3
      preWarmedAudioElement.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAHAAGf9AAAIgAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
      preWarmedAudioElement.load();

      console.log("[iOS Audio] Attempting to play silent audio on pre-warmed element...");
      await preWarmedAudioElement.play();
      console.log("[iOS Audio] Pre-warmed element played silent audio successfully - PRIMED!");
      preWarmedAudioElement.pause();
      preWarmedAudioElement.currentTime = 0;
      preWarmedElementPrimed = true; // Mark as successfully primed
      unlocked = true;
    }
  } catch (e) {
    console.log("[iOS Audio] Pre-warmed element play failed:", e instanceof Error ? e.message : e);
    // If we're not in a user gesture, this is expected - don't mark as failed
  }

  // Method 2: Also create/resume a shared AudioContext for Web Audio API
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      // Reuse or create the shared context
      if (!sharedAudioContext || sharedAudioContext.state === "closed") {
        sharedAudioContext = new AudioContextClass();
        console.log("[iOS Audio] Created new shared AudioContext, state:", sharedAudioContext.state);
      }

      if (sharedAudioContext.state === "suspended") {
        try {
          await sharedAudioContext.resume();
          console.log("[iOS Audio] Shared AudioContext resumed, state:", sharedAudioContext.state);
        } catch (resumeErr) {
          // Resume outside user gesture will fail on iOS - this is expected
          console.log("[iOS Audio] AudioContext resume failed (expected outside gesture):", resumeErr);
        }
      } else {
        console.log("[iOS Audio] Shared AudioContext state:", sharedAudioContext.state);
      }

      // Only play silent buffer if context is running (will fail outside gesture)
      if (sharedAudioContext.state === "running") {
        const silentBuffer = sharedAudioContext.createBuffer(1, 1, 22050);
        const source = sharedAudioContext.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(sharedAudioContext.destination);
        source.start(0);
        console.log("[iOS Audio] Played silent buffer through AudioContext");
        unlocked = true;
      }
    }
  } catch (e) {
    console.log("[iOS Audio] AudioContext method failed:", e);
  }

  audioContextUnlocked = unlocked || preWarmedElementPrimed;
  console.log("[iOS Audio] Unlock complete. primed:", preWarmedElementPrimed, "unlocked:", unlocked);
  return audioContextUnlocked;
}

// Helper to play audio with iOS-friendly retry logic
async function playAudioWithRetry(audioBuffer: ArrayBuffer): Promise<void> {
  console.log("[Audio Playback] Starting playback, buffer size:", audioBuffer.byteLength);
  console.log("[Audio Playback] Is iOS:", isIOS());
  console.log("[Audio Playback] PreWarmedElement exists:", !!preWarmedAudioElement);
  console.log("[Audio Playback] SharedAudioContext exists:", !!sharedAudioContext);
  console.log("[Audio Playback] SharedAudioContext state:", sharedAudioContext?.state);

  // Validate buffer
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    console.error("[Audio Playback] Invalid or empty audio buffer");
    throw new Error("Invalid audio buffer");
  }

  // On iOS, use the pre-warmed Audio element for best compatibility
  if (isIOS()) {
    console.log("[Audio Playback] iOS detected");

    // Try using the pre-warmed Audio element first (most reliable on iOS)
    if (preWarmedAudioElement) {
      console.log("[Audio Playback] Using pre-warmed Audio element for iOS playback");
      try {
        return await playWithPreWarmedElement(audioBuffer);
      } catch (preWarmedError) {
        console.error("[Audio Playback] Pre-warmed element failed:", preWarmedError);
      }
    }

    // Try Web Audio API as second option
    if (sharedAudioContext) {
      if (sharedAudioContext.state === "suspended") {
        console.log("[Audio Playback] Attempting to resume suspended AudioContext for iOS...");
        try {
          await sharedAudioContext.resume();
          console.log("[Audio Playback] AudioContext resumed, state:", sharedAudioContext.state);
        } catch (e) {
          console.warn("[Audio Playback] Failed to resume AudioContext:", e);
        }
      }

      if (sharedAudioContext.state === "running") {
        console.log("[Audio Playback] Trying Web Audio API for iOS playback");
        try {
          return await playWithWebAudioAPI(audioBuffer);
        } catch (webAudioError) {
          console.error("[Audio Playback] Web Audio API failed on iOS:", webAudioError);
        }
      }
    }

    // Last resort: Try creating a new HTML Audio element
    console.log("[Audio Playback] Falling back to new HTML Audio element for iOS");
    return playWithHTMLAudio(audioBuffer);
  }

  // Non-iOS: Use HTML Audio element
  console.log("[Audio Playback] Using HTML Audio element for playback (non-iOS)");
  return playWithHTMLAudio(audioBuffer);
}

// Play audio using the pre-warmed Audio element (best for iOS)
async function playWithPreWarmedElement(audioBuffer: ArrayBuffer): Promise<void> {
  console.log("[PreWarmed Audio] Starting playback with pre-warmed element");
  console.log("[PreWarmed Audio] Element primed:", preWarmedElementPrimed);

  if (!preWarmedAudioElement) {
    throw new Error("No pre-warmed audio element available");
  }

  if (!preWarmedElementPrimed) {
    console.warn("[PreWarmed Audio] Element was not primed during user gesture, playback may fail");
  }

  // Create blob URL for the audio data
  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
  const audioUrl = URL.createObjectURL(blob);
  console.log("[PreWarmed Audio] Created blob URL, size:", blob.size);

  return new Promise((resolve, reject) => {
    const audio = preWarmedAudioElement!;
    let resolved = false;
    let playAttempts = 0;
    const maxAttempts = 3;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(audioUrl);
        audio.onended = null;
        audio.onerror = null;
        audio.oncanplaythrough = null;
        audio.onloadeddata = null;
      }
    };

    const attemptPlay = async () => {
      if (resolved) return;
      playAttempts++;
      console.log("[PreWarmed Audio] Play attempt", playAttempts, "of", maxAttempts);
      console.log("[PreWarmed Audio]   readyState:", audio.readyState, "paused:", audio.paused);

      try {
        await audio.play();
        console.log("[PreWarmed Audio] Play started successfully on attempt", playAttempts);
      } catch (playError) {
        console.error("[PreWarmed Audio] Play attempt", playAttempts, "failed:", playError);

        if (playAttempts < maxAttempts) {
          // Retry with delay
          setTimeout(attemptPlay, 300 * playAttempts);
        } else {
          console.error("[PreWarmed Audio] All play attempts failed");
          clearTimeout(safetyTimeout);
          cleanup();
          reject(playError);
        }
      }
    };

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      console.warn("[PreWarmed Audio] Safety timeout reached (60s)");
      cleanup();
      resolve();
    }, 60000);

    audio.onended = () => {
      console.log("[PreWarmed Audio] Playback ended successfully");
      clearTimeout(safetyTimeout);
      cleanup();
      resolve();
    };

    audio.onerror = (e) => {
      console.error("[PreWarmed Audio] Error event:", e);
      if (audio.error) {
        console.error("[PreWarmed Audio] Error code:", audio.error.code, "message:", audio.error.message);
      }
      // Don't reject immediately - let retry logic handle it
    };

    // Set the new source
    console.log("[PreWarmed Audio] Setting new src and loading...");
    audio.src = audioUrl;
    audio.load();

    audio.onloadeddata = () => {
      console.log("[PreWarmed Audio] loadeddata fired, readyState:", audio.readyState);
    };

    audio.oncanplaythrough = () => {
      if (resolved || !audio.paused) return;
      console.log("[PreWarmed Audio] canplaythrough fired, readyState:", audio.readyState);
      attemptPlay();
    };

    // Fallback: try playing after delays if events don't fire
    setTimeout(() => {
      if (resolved || !audio.paused) return;
      if (audio.readyState >= 2) {
        console.log("[PreWarmed Audio] Fallback at 300ms, readyState:", audio.readyState);
        attemptPlay();
      }
    }, 300);

    setTimeout(() => {
      if (resolved || !audio.paused) return;
      console.log("[PreWarmed Audio] Fallback at 1s, readyState:", audio.readyState);
      attemptPlay();
    }, 1000);

    setTimeout(() => {
      if (resolved || !audio.paused) return;
      console.log("[PreWarmed Audio] Last resort at 3s, readyState:", audio.readyState);
      attemptPlay();
    }, 3000);
  });
}

// Play audio using Web Audio API (better for iOS)
async function playWithWebAudioAPI(audioBuffer: ArrayBuffer): Promise<void> {
  console.log("[Audio Playback] playWithWebAudioAPI called, buffer size:", audioBuffer.byteLength);

  if (!sharedAudioContext) {
    console.error("[Audio Playback] No shared AudioContext available, falling back to HTML Audio");
    return playWithHTMLAudio(audioBuffer);
  }

  console.log("[Audio Playback] AudioContext state:", sharedAudioContext.state);

  // Ensure context is running - critical for iOS
  if (sharedAudioContext.state === "suspended") {
    console.log("[Audio Playback] Resuming suspended AudioContext...");
    try {
      await sharedAudioContext.resume();
      console.log("[Audio Playback] AudioContext resumed, new state:", sharedAudioContext.state);
    } catch (resumeError) {
      console.error("[Audio Playback] Failed to resume AudioContext:", resumeError);
      return playWithHTMLAudio(audioBuffer);
    }
  }

  // If still not running after resume attempt, fall back
  if (sharedAudioContext.state !== "running") {
    console.warn("[Audio Playback] AudioContext still not running after resume, state:", sharedAudioContext.state);
    return playWithHTMLAudio(audioBuffer);
  }

  return new Promise(async (resolve) => {
    try {
      // Decode the audio data - make a copy to avoid issues with detached buffers
      console.log("[Audio Playback] Decoding audio buffer...");
      const bufferCopy = audioBuffer.slice(0);

      let decodedAudio: AudioBuffer;
      try {
        decodedAudio = await sharedAudioContext!.decodeAudioData(bufferCopy);
      } catch (decodeError) {
        console.error("[Audio Playback] Failed to decode audio:", decodeError);
        // iOS Chrome sometimes fails to decode MP3, fall back to HTML Audio
        console.log("[Audio Playback] Falling back to HTML Audio due to decode failure");
        return resolve(await playWithHTMLAudio(audioBuffer));
      }

      console.log("[Audio Playback] Audio decoded successfully, duration:", decodedAudio.duration, "seconds");

      if (decodedAudio.duration === 0) {
        console.warn("[Audio Playback] Decoded audio has zero duration, falling back to HTML Audio");
        return resolve(await playWithHTMLAudio(audioBuffer));
      }

      // Create a buffer source and play
      const source = sharedAudioContext!.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(sharedAudioContext!.destination);

      // Safety timeout based on audio duration plus buffer
      const timeoutMs = Math.max(60000, (decodedAudio.duration * 1000) + 5000);
      const safetyTimeout = setTimeout(() => {
        console.warn("[Audio Playback] Web Audio safety timeout reached after", timeoutMs, "ms");
        resolve();
      }, timeoutMs);

      source.onended = () => {
        console.log("[Audio Playback] Web Audio playback ended successfully");
        clearTimeout(safetyTimeout);
        resolve();
      };

      source.start(0);
      console.log("[Audio Playback] Web Audio playback started successfully");
    } catch (e) {
      console.error("[Audio Playback] Web Audio API error:", e);
      // Fallback to HTML Audio - properly await it
      console.log("[Audio Playback] Falling back to HTML Audio element");
      try {
        await playWithHTMLAudio(audioBuffer);
      } catch (htmlError) {
        console.error("[Audio Playback] HTML Audio fallback also failed:", htmlError);
      }
      resolve();
    }
  });
}

// Play audio using HTML Audio element (original method)
async function playWithHTMLAudio(audioBuffer: ArrayBuffer): Promise<void> {
  console.log("[HTML Audio] Starting HTML Audio playback, buffer size:", audioBuffer.byteLength);

  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
  const audioUrl = URL.createObjectURL(blob);
  console.log("[HTML Audio] Created blob URL:", audioUrl.substring(0, 50) + "...");

  const audio = new Audio();

  // Set audio properties for better iOS compatibility
  audio.preload = "auto";
  audio.volume = 1.0;
  // iOS Chrome may need these attributes
  (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");

  // iOS needs load() to be called explicitly
  audio.src = audioUrl;
  audio.load();
  console.log("[HTML Audio] Audio element created and loading, readyState:", audio.readyState);

  return new Promise((resolve) => {
    let resolved = false;
    let playAttempts = 0;
    const maxPlayAttempts = 5; // Increased retry attempts for iOS

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(audioUrl);
      }
    };

    const attemptPlay = async () => {
      playAttempts++;
      console.log("[HTML Audio] Play attempt", playAttempts, "of", maxPlayAttempts);
      console.log("[HTML Audio]   readyState:", audio.readyState);
      console.log("[HTML Audio]   networkState:", audio.networkState);
      console.log("[HTML Audio]   paused:", audio.paused);
      console.log("[HTML Audio]   error:", audio.error);

      try {
        // On iOS, ensure the audio is loaded before playing
        if (audio.readyState < 2 && playAttempts === 1) {
          console.log("[HTML Audio] Audio not ready, waiting for loadeddata event...");
          // Give it a moment to load
          await new Promise(r => setTimeout(r, 300));
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        console.log("[HTML Audio] Play succeeded on attempt", playAttempts);
      } catch (e) {
        const error = e as Error;
        console.error("[HTML Audio] Play attempt", playAttempts, "failed:", error.name, error.message);

        if (playAttempts < maxPlayAttempts) {
          // Exponential backoff with longer delays for iOS
          const retryDelay = Math.min(playAttempts * 500, 2000);
          console.log("[HTML Audio] Retrying in", retryDelay, "ms");
          setTimeout(attemptPlay, retryDelay);
        } else {
          console.error("[HTML Audio] All", maxPlayAttempts, "play attempts failed");
          console.error("[HTML Audio] Final audio state - readyState:", audio.readyState, "networkState:", audio.networkState, "error:", audio.error);
          cleanup();
          resolve();
        }
      }
    };

    // Safety timeout - resolve after max duration to prevent hanging
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        console.warn("[HTML Audio] Safety timeout reached (60s), resolving");
        cleanup();
        resolve();
      }
    }, 60000);

    audio.onended = () => {
      console.log("[HTML Audio] Audio ended successfully");
      clearTimeout(safetyTimeout);
      cleanup();
      resolve();
    };

    audio.onerror = (e) => {
      console.error("[HTML Audio] Audio error event:", e);
      console.error("[HTML Audio] Audio.error object:", audio.error);
      if (audio.error) {
        console.error("[HTML Audio] Error code:", audio.error.code, "message:", audio.error.message);
      }
      clearTimeout(safetyTimeout);
      cleanup();
      // Resolve instead of reject to prevent cascading errors
      resolve();
    };

    // Listen for various ready events
    audio.oncanplaythrough = () => {
      console.log("[HTML Audio] canplaythrough event fired, readyState:", audio.readyState, "paused:", audio.paused);
      if (!resolved && audio.paused && playAttempts === 0) {
        console.log("[HTML Audio] Starting playback from canplaythrough event");
        attemptPlay();
      }
    };

    audio.onloadeddata = () => {
      console.log("[HTML Audio] loadeddata event fired, readyState:", audio.readyState);
      // If canplaythrough hasn't fired yet, try playing when data is loaded
      if (!resolved && audio.paused && audio.readyState >= 2 && playAttempts === 0) {
        console.log("[HTML Audio] Data loaded, attempting play");
        attemptPlay();
      }
    };

    audio.onloadstart = () => {
      console.log("[HTML Audio] loadstart event fired");
    };

    audio.onprogress = () => {
      console.log("[HTML Audio] progress event fired, buffered:", audio.buffered.length > 0 ? audio.buffered.end(0) : 0);
    };

    audio.onstalled = () => {
      console.warn("[HTML Audio] stalled event fired - media data not available");
    };

    audio.onsuspend = () => {
      console.log("[HTML Audio] suspend event fired - loading suspended");
    };

    // Fallback: try playing after a delay if no events fire
    setTimeout(() => {
      if (!resolved && audio.paused && playAttempts === 0) {
        console.log("[HTML Audio] Fallback timeout (2s) triggered, readyState:", audio.readyState, "networkState:", audio.networkState);
        if (audio.readyState >= 1) {
          attemptPlay();
        } else {
          console.warn("[HTML Audio] Audio not ready after 2s, will retry at 5s");
        }
      }
    }, 2000);

    // Last resort fallback - try playing after 5 seconds no matter what
    setTimeout(() => {
      if (!resolved && audio.paused && playAttempts === 0) {
        console.log("[HTML Audio] Last resort fallback at 5s, readyState:", audio.readyState);
        attemptPlay();
      }
    }, 5000);
  });
}

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
  const microphoneError = useConversationStore((state) => state.microphoneError);
  const setMicrophoneError = useConversationStore((state) => state.setMicrophoneError);

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
    console.log("[Conversation] Is iOS:", isIOS());
    console.log("[Conversation] Is iOS PWA:", isIOSPWA());

    const requestMicrophonePermission = async () => {
      try {
        // Check if we already have a stream
        if (audioStreamRef.current) {
          console.log("[Conversation] Audio stream already exists, reusing");
          setMicrophoneError(null);
          return;
        }

        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("[Conversation] getUserMedia not available in this browser");
          if (isIOSPWA()) {
            setMicrophoneError("Microphone not available in iOS PWA. Please open this app in Safari browser instead.");
          } else {
            setMicrophoneError("Microphone not available in this browser.");
          }
          return;
        }

        // Request microphone permission
        console.log("[Conversation] Calling getUserMedia to request microphone permission");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        setMicrophoneError(null);
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
        if (error instanceof Error) {
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            console.warn("[Conversation] Microphone permission denied by user");
            if (isIOSPWA() || isIOS()) {
              setMicrophoneError("Microphone access denied on iOS. Please check: 1) Allow microphone in iOS Settings > Safari > Microphone, 2) Enable MediaRecorder in Settings > Safari > Advanced > Experimental Features.");
            } else {
              setMicrophoneError("Microphone permission denied. Please allow microphone access in your browser settings.");
            }
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            console.warn("[Conversation] No microphone found");
            setMicrophoneError("No microphone found on this device.");
          } else {
            console.error("[Conversation] Unexpected error requesting microphone:", error.message);
            if (isIOSPWA() || isIOS()) {
              setMicrophoneError("Microphone error on iOS. Try: Settings > Safari > Advanced > Experimental Features > Enable MediaRecorder.");
            } else {
              setMicrophoneError(`Microphone error: ${error.message}`);
            }
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

        // Note: Greeting audio may not play automatically due to browser autoplay policies
        // The user will need to interact with the page first
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
            console.log("[Conversation] Received ElevenLabs audio for greeting");
            const audioBuffer = await ttsResponse.arrayBuffer();
            console.log("[Conversation] Greeting audio buffer size:", audioBuffer.byteLength, "bytes");

            if (audioBuffer.byteLength === 0) {
              console.error("[Conversation] Empty audio buffer for greeting");
              throw new Error("Empty audio buffer");
            }

            setSpeaking(true);
            try {
              await playAudioWithRetry(audioBuffer);
              console.log("[Conversation] Greeting audio playback completed");
            } catch (playError) {
              console.error("[Conversation] Greeting audio playback failed (expected on first load):", playError);
              // This is expected to fail on page load due to autoplay policy
            } finally {
              setSpeaking(false);
            }
          } else {
            console.log("[Conversation] Using browser TTS for greeting");
            setSpeaking(true);
            try {
              await speakText(greeting, "fr-FR");
              console.log("[Conversation] Browser TTS for greeting completed");
            } catch (browserTTSError) {
              console.error("[Conversation] Browser TTS error for greeting (expected on first load):", browserTTSError);
            }
            setSpeaking(false);
          }
        } catch (error) {
          console.error("[Conversation] TTS error for greeting:", error);
          // Greeting audio failure is not critical - user can still use the app
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
    // Unlock audio for iOS - must happen during user gesture
    await unlockAudioForIOS();

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

      // Start recording with timeslice for better iOS compatibility
      // This ensures we get data chunks more frequently
      mediaRecorder.start(1000); // Request data every 1 second
      console.log("[Conversation] Recording started successfully with mimeType:", mediaRecorder.mimeType, "(timeslice: 1000ms)");
    } catch (error) {
      console.error("[Conversation] Failed to start recording:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          console.error("[Conversation] Microphone permission denied");
          if (isIOS()) {
            setMicrophoneError("Microphone denied. On iOS: Settings → Safari → Advanced → Experimental Features → Enable MediaRecorder");
          } else {
            setMicrophoneError("Microphone permission denied. Please allow access in browser settings.");
          }
        } else if (error.name === "NotFoundError") {
          console.error("[Conversation] No microphone found");
          setMicrophoneError("No microphone found on this device.");
        } else {
          console.error("[Conversation] Recording error:", error.message);
          if (isIOS()) {
            setMicrophoneError(`Recording failed on iOS: ${error.message}. Try enabling MediaRecorder in Safari settings.`);
          } else {
            setMicrophoneError(`Recording error: ${error.message}`);
          }
        }
      }
    }
  }, [setMicrophoneError]);

  const handleRecordingStop = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) {
      console.warn("[Conversation] No media recorder to stop");
      return;
    }

    console.log("[Conversation] Stopping recording, current state:", mediaRecorder.state);

    mediaRecorder.onstop = async () => {
      console.log("[Conversation] MediaRecorder stopped, processing audio");
      console.log("[Conversation] Number of audio chunks:", audioChunksRef.current.length);
      console.log("[Conversation] Audio chunks sizes:", audioChunksRef.current.map(c => c.size));

      // IMPORTANT: Don't stop tracks here - keep them alive for iOS PWA permission persistence
      // iOS revokes microphone permissions if tracks are stopped immediately after recording
      // We'll keep the stream alive and only stop tracks on component unmount
      console.log("[Conversation] Keeping audio stream alive for permission persistence (iOS PWA workaround)");

      // Use the actual MIME type from the MediaRecorder, not a hardcoded value
      // This is critical for iOS which uses audio/mp4 instead of audio/webm
      const actualMimeType = audioMimeTypeRef.current || mediaRecorder.mimeType || "audio/webm";
      console.log("[Conversation] Creating audio blob with MIME type:", actualMimeType);

      // Check if we have any audio data
      if (audioChunksRef.current.length === 0) {
        console.error("[Conversation] No audio chunks recorded!");
        setProcessing(false);
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
      console.log("[Conversation] Audio blob created, size:", audioBlob.size, "bytes, type:", audioBlob.type);

      // Validate audio blob
      if (audioBlob.size === 0) {
        console.error("[Conversation] Audio blob is empty!");
        setProcessing(false);
        return;
      }

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
            console.log("[Conversation] Received ElevenLabs audio, preparing to play...");
            const audioBuffer = await ttsResponse.arrayBuffer();
            console.log("[Conversation] Audio buffer size:", audioBuffer.byteLength, "bytes");

            if (audioBuffer.byteLength === 0) {
              console.error("[Conversation] Empty audio buffer received");
              throw new Error("Empty audio buffer");
            }

            // Ensure audio is unlocked before playing
            await unlockAudioForIOS();

            setSpeaking(true);
            try {
              console.log("[Conversation] Starting ElevenLabs audio playback...");
              await playAudioWithRetry(audioBuffer);
              console.log("[Conversation] Audio playback completed successfully");
            } catch (playError) {
              console.error("[Conversation] Audio playback failed:", playError);
              // Try browser TTS as fallback
              console.log("[Conversation] Falling back to browser TTS after playback failure");
              try {
                await speakText(tutorResponse, "fr-FR");
              } catch (e) {
                console.error("[Conversation] Browser TTS fallback also failed:", e);
              }
            } finally {
              setSpeaking(false);
            }
          } else {
            // Use browser TTS
            console.log("[Conversation] ElevenLabs not configured, using browser TTS");
            const responseData = await ttsResponse.json();
            console.log("[Conversation] TTS API response:", responseData);

            // Ensure audio is unlocked before speaking
            await unlockAudioForIOS();

            setSpeaking(true);
            try {
              console.log("[Conversation] Starting browser TTS...");
              await speakText(tutorResponse, "fr-FR");
              console.log("[Conversation] Browser TTS completed");
            } catch (browserTTSError) {
              console.error("[Conversation] Browser TTS error:", browserTTSError);
              // Log a visible warning for debugging
              console.warn("[Conversation] Audio failed to play - check browser TTS support");
            }
            setSpeaking(false);
          }
        } catch (ttsError) {
          console.error("[Conversation] TTS error:", ttsError);
          console.error("[Conversation] TTS error details:", ttsError instanceof Error ? ttsError.message : String(ttsError));
          // Fallback to browser TTS
          await unlockAudioForIOS();
          setSpeaking(true);
          try {
            await speakText(tutorResponse, "fr-FR");
            console.log("[Conversation] Browser TTS fallback completed");
          } catch (browserTTSError) {
            console.error("[Conversation] All audio playback methods failed:", browserTTSError);
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
          <h1 className="text-lg font-semibold">Parlé</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-primary-200 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Microphone Error Banner */}
      {microphoneError && (
        <div className="flex-shrink-0 bg-amber-100 dark:bg-amber-900 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-amber-800 dark:text-amber-200">{microphoneError}</p>
              {isIOS() && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  iOS tip: Go to Settings → Safari → Advanced → Experimental Features → Enable &quot;MediaRecorder&quot;
                </p>
              )}
            </div>
            <button
              onClick={() => setMicrophoneError(null)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
