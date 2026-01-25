import { ClaudeService } from "./types";
import { mockClaude } from "./mock";
import { createClaudeService } from "./client";

export type {
  ChatMessage,
  TutorResponse,
  ClaudeService,
  LearnerProfile,
  Correction,
  VocabularyEntry,
  GrammarEntry,
} from "./types";
export { FRENCH_TUTOR_SYSTEM_PROMPT, buildSystemPrompt } from "./prompts";

let claudeService: ClaudeService | null = null;

export function getClaudeService(): ClaudeService {
  if (claudeService) return claudeService;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    console.log("Using Anthropic Claude service");
    claudeService = createClaudeService(apiKey);
  } else {
    console.log("Using mock Claude service (no ANTHROPIC_API_KEY)");
    claudeService = mockClaude;
  }

  return claudeService;
}
