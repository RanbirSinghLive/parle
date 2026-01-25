import { create } from "zustand";
import { SessionSummary } from "@/lib/session";

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  category: "grammar" | "vocabulary" | "pronunciation" | "usage";
}

export interface Message {
  id: string;
  role: "user" | "tutor";
  content: string;
  timestamp: Date;
  corrections?: Correction[];
}

interface ConversationState {
  // Session state
  sessionId: string | null;
  sessionStartTime: Date | null;
  isSessionActive: boolean;
  isEndingSession: boolean;
  sessionSummary: SessionSummary | null;

  // Conversation state
  messages: Message[];
  allCorrections: Correction[];
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;

  // Session actions
  startSession: (sessionId: string) => void;
  endSession: (summary: SessionSummary) => void;
  setEndingSession: (isEnding: boolean) => void;
  clearSession: () => void;

  // Message actions
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  setRecording: (isRecording: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  clearMessages: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  // Session state
  sessionId: null,
  sessionStartTime: null,
  isSessionActive: false,
  isEndingSession: false,
  sessionSummary: null,

  // Conversation state
  messages: [],
  allCorrections: [],
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,

  // Session actions
  startSession: (sessionId) =>
    set({
      sessionId,
      sessionStartTime: new Date(),
      isSessionActive: true,
      sessionSummary: null,
      messages: [],
      allCorrections: [],
    }),

  endSession: (summary) =>
    set({
      isSessionActive: false,
      isEndingSession: false,
      sessionSummary: summary,
    }),

  setEndingSession: (isEnding) => set({ isEndingSession: isEnding }),

  clearSession: () =>
    set({
      sessionId: null,
      sessionStartTime: null,
      isSessionActive: false,
      isEndingSession: false,
      sessionSummary: null,
      messages: [],
      allCorrections: [],
    }),

  // Message actions
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
      // Accumulate corrections from tutor messages
      allCorrections: message.corrections
        ? [...state.allCorrections, ...message.corrections]
        : state.allCorrections,
    })),

  setRecording: (isRecording) => set({ isRecording }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  clearMessages: () => set({ messages: [], allCorrections: [] }),
}));
