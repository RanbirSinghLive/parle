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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Initialize browser TTS voices
  useEffect(() => {
    initVoices();
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
          const ttsResponse = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: greeting }),
          });

          const contentType = ttsResponse.headers.get("content-type");
          if (contentType?.includes("audio/mpeg")) {
            setSpeaking(true);
            const audioBuffer = await ttsResponse.arrayBuffer();
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.onended = () => {
              setSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            await audio.play();
          } else {
            setSpeaking(true);
            await speakText(greeting, "fr-FR");
            setSpeaking(false);
          }
        } catch {
          // Fallback to browser TTS
          setSpeaking(true);
          await speakText(greeting, "fr-FR");
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

        const { content: tutorResponse, corrections } = await chatResponse.json();

        // Add tutor response to transcript with any corrections
        addMessage({ role: "tutor", content: tutorResponse, corrections: corrections || [] });

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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-primary-800 text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={handleEndSession}
            disabled={isEndingSession || messages.length === 0}
            className="text-sm text-primary-200 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEndingSession ? "Ending..." : "End Session"}
          </button>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Parle</h1>
            <p className="text-sm text-primary-200">French Tutor</p>
          </div>
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
      <footer className="flex-shrink-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
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
