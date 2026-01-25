"use client";

import { useCallback, useRef } from "react";
import { useConversationStore } from "@/stores/conversation";

interface PushToTalkButtonProps {
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  disabled?: boolean;
}

export function PushToTalkButton({
  onRecordingStart,
  onRecordingStop,
  disabled = false,
}: PushToTalkButtonProps) {
  const isRecording = useConversationStore((state) => state.isRecording);
  const isProcessing = useConversationStore((state) => state.isProcessing);
  const isSpeaking = useConversationStore((state) => state.isSpeaking);
  const setRecording = useConversationStore((state) => state.setRecording);

  const isHolding = useRef(false);

  const handleStart = useCallback(() => {
    if (disabled || isProcessing || isSpeaking) return;
    isHolding.current = true;
    setRecording(true);
    onRecordingStart();

    // Haptic feedback on supported devices
    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }
  }, [disabled, isProcessing, isSpeaking, setRecording, onRecordingStart]);

  const handleEnd = useCallback(() => {
    if (!isHolding.current) return;
    isHolding.current = false;
    setRecording(false);
    onRecordingStop();

    // Haptic feedback on supported devices
    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }
  }, [setRecording, onRecordingStop]);

  const isDisabled = disabled || isProcessing || isSpeaking;

  const getButtonText = () => {
    if (isSpeaking) return "Listening...";
    if (isProcessing) return "Thinking...";
    if (isRecording) return "Recording...";
    return "Hold to Speak";
  };

  const getButtonStyle = () => {
    if (isRecording) {
      return "bg-red-500 scale-95";
    }
    if (isDisabled) {
      return "bg-slate-400 cursor-not-allowed";
    }
    return "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 active:scale-95";
  };

  return (
    <button
      className={`w-full py-4 rounded-xl text-white font-medium text-lg transition-all duration-150 select-none touch-none ${getButtonStyle()}`}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      disabled={isDisabled}
      aria-label={getButtonText()}
    >
      <span className="flex items-center justify-center gap-2">
        {isRecording && (
          <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
        )}
        {getButtonText()}
      </span>
    </button>
  );
}
