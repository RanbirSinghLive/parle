"use client";

import { useRef, useCallback, useEffect } from "react";
import { useConversationStore } from "@/stores/conversation";

/**
 * Web Audio API-based playback hook.
 *
 * Uses AudioContext + decodeAudioData + AudioBufferSourceNode instead of
 * HTMLAudioElement. On iOS, once AudioContext.resume() is called during a
 * user gesture the context stays unlocked, so later calls to
 * bufferSource.start() work even after async operations (fetch TTS, etc.).
 */
export function useAudioPlayback() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const setSpeaking = useConversationStore((state) => state.setSpeaking);

  // Lazily create or return the shared AudioContext
  const getContext = useCallback((): AudioContext => {
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      return ctxRef.current;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    console.log("[AudioPlayback] Created AudioContext, state:", ctx.state);
    return ctx;
  }, []);

  /**
   * Call during a user gesture (e.g. button press) to unlock the
   * AudioContext on iOS. Idempotent — safe to call multiple times.
   */
  const unlockAudio = useCallback(() => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        console.log("[AudioPlayback] AudioContext resumed (unlocked)");
      });
    } else {
      console.log("[AudioPlayback] AudioContext already", ctx.state);
    }
  }, [getContext]);

  /**
   * Decode an MP3 ArrayBuffer and play it through the Web Audio API.
   * Resolves when playback finishes. Automatically sets speaking state.
   */
  const playBuffer = useCallback(
    async (arrayBuffer: ArrayBuffer): Promise<void> => {
      const ctx = getContext();

      // Ensure context is running (may still be suspended if unlockAudio
      // wasn't called or the resume hasn't completed yet)
      if (ctx.state === "suspended") {
        console.log("[AudioPlayback] Context suspended, resuming before play");
        await ctx.resume();
      }

      // Stop any currently playing source
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // ignore — already stopped
        }
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      console.log("[AudioPlayback] Decoding audio buffer, size:", arrayBuffer.byteLength);

      // decodeAudioData needs its own copy — some browsers detach the buffer
      const bufferCopy = arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(bufferCopy);

      console.log(
        "[AudioPlayback] Decoded: duration",
        audioBuffer.duration.toFixed(2) + "s,",
        "sampleRate", audioBuffer.sampleRate
      );

      return new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        sourceRef.current = source;

        setSpeaking(true);

        source.onended = () => {
          console.log("[AudioPlayback] Playback ended");
          setSpeaking(false);
          sourceRef.current = null;
          resolve();
        };

        source.start(0);
        console.log("[AudioPlayback] Playback started");
      });
    },
    [getContext, setSpeaking]
  );

  /**
   * Stop any currently playing audio immediately.
   */
  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
      setSpeaking(false);
      console.log("[AudioPlayback] Stopped");
    }
  }, [setSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // ignore
        }
        sourceRef.current.disconnect();
      }
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
        console.log("[AudioPlayback] AudioContext closed on unmount");
      }
    };
  }, []);

  return { unlockAudio, playBuffer, stop };
}
