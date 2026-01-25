"use client";

import { useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Transcript } from "@/components/Transcript";
import { PushToTalkButton } from "@/components/PushToTalkButton";
import { useConversationStore } from "@/stores/conversation";
import { speakText, initVoices } from "@/lib/tts/browser";
import { createClient } from "@/lib/supabase/client";

export default function ConversationPage() {
  const messages = useConversationStore((state) => state.messages);
  const addMessage = useConversationStore((state) => state.addMessage);
  const setProcessing = useConversationStore((state) => state.setProcessing);
  const setSpeaking = useConversationStore((state) => state.setSpeaking);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Initialize browser TTS voices
  useEffect(() => {
    initVoices();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    mediaRecorder.onstop = async () => {
      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

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

        const { content: tutorResponse } = await chatResponse.json();

        // Add tutor response to transcript
        addMessage({ role: "tutor", content: tutorResponse });

        setProcessing(false);

        // Step 3: Play TTS
        try {
          const ttsResponse = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: tutorResponse }),
          });

          const contentType = ttsResponse.headers.get("content-type");

          if (contentType?.includes("audio/mpeg")) {
            // ElevenLabs audio returned
            setSpeaking(true);
            const audioBuffer = await ttsResponse.arrayBuffer();
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);

            audio.onended = () => {
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };

            await audio.play();
          } else {
            // Use browser TTS
            setSpeaking(true);
            await speakText(tutorResponse, "fr-FR");
            setSpeaking(false);
          }
        } catch (ttsError) {
          console.error("TTS error, falling back to browser:", ttsError);
          // Fallback to browser TTS
          setSpeaking(true);
          await speakText(tutorResponse, "fr-FR");
          setSpeaking(false);
        }
      } catch (error) {
        console.error("Conversation error:", error);
        setProcessing(false);
      }
    };

    mediaRecorder.stop();
  }, [addMessage, setProcessing, setSpeaking, getApiMessages]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-primary-800 text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="w-16" /> {/* Spacer for centering */}
          <div className="text-center">
            <h1 className="text-xl font-semibold">Parle</h1>
            <p className="text-sm text-primary-200">French Tutor</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-16 text-sm text-primary-200 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Transcript Area */}
      <Transcript />

      {/* Push-to-talk button area */}
      <footer className="flex-shrink-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <PushToTalkButton
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
        />
      </footer>
    </div>
  );
}
