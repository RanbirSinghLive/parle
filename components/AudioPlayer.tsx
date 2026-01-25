"use client";

import { useRef, useCallback } from "react";
import { useConversationStore } from "@/stores/conversation";

interface AudioPlayerProps {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export function useAudioPlayer({ onPlaybackStart, onPlaybackEnd }: AudioPlayerProps = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const setSpeaking = useConversationStore((state) => state.setSpeaking);

  const playAudio = useCallback(
    async (audioData: ArrayBuffer | string) => {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setSpeaking(true);
      onPlaybackStart?.();

      try {
        let audioUrl: string;

        if (typeof audioData === "string") {
          // It's already a URL or base64
          audioUrl = audioData;
        } else {
          // It's an ArrayBuffer, create a blob URL
          const blob = new Blob([audioData], { type: "audio/mpeg" });
          audioUrl = URL.createObjectURL(blob);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeaking(false);
          onPlaybackEnd?.();
          if (typeof audioData !== "string") {
            URL.revokeObjectURL(audioUrl);
          }
        };

        audio.onerror = () => {
          setSpeaking(false);
          onPlaybackEnd?.();
          console.error("Audio playback error");
        };

        await audio.play();
      } catch (error) {
        setSpeaking(false);
        onPlaybackEnd?.();
        console.error("Failed to play audio:", error);
      }
    },
    [setSpeaking, onPlaybackStart, onPlaybackEnd]
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setSpeaking(false);
      onPlaybackEnd?.();
    }
  }, [setSpeaking, onPlaybackEnd]);

  return { playAudio, stopAudio };
}
