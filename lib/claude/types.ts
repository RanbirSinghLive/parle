export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TutorResponse {
  content: string;
  correction?: {
    original: string;
    corrected: string;
    explanation: string;
  };
}

export interface ClaudeService {
  chat(messages: ChatMessage[], userMessage: string): Promise<TutorResponse>;
}
