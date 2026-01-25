import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "tutor";
  content: string;
  timestamp: Date;
  isCorrection?: boolean;
}

interface ConversationState {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;

  // Actions
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  setRecording: (isRecording: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  clearMessages: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,

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
    })),

  setRecording: (isRecording) => set({ isRecording }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  clearMessages: () => set({ messages: [] }),
}));
