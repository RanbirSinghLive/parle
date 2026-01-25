import Anthropic from "@anthropic-ai/sdk";
import {
  ChatMessage,
  TutorResponse,
  ClaudeService,
  LearnerProfile,
  Correction,
} from "./types";
import { buildSystemPrompt } from "./prompts";

/**
 * Parses Claude's response to extract corrections.
 * Looks for the pattern: "[French correction] — [English explanation]."
 */
function parseCorrections(content: string): Correction[] {
  const corrections: Correction[] = [];

  // Match pattern: "French text — English explanation."
  // The em dash (—) is the delimiter between correction and explanation
  const correctionPattern = /([^.!?]+)\s*—\s*([^.]+(?:\.|!))/g;
  let match;

  while ((match = correctionPattern.exec(content)) !== null) {
    const correctedForm = match[1].trim();
    const explanation = match[2].trim();

    // Skip if it looks like a normal sentence rather than a correction
    // Corrections typically have short French phrases followed by English explanations
    if (explanation.length > 10 && /[a-zA-Z]/.test(explanation)) {
      corrections.push({
        original: "", // Will be inferred from context later
        corrected: correctedForm,
        explanation: explanation,
        category: categorizeCorrection(explanation),
      });
    }
  }

  return corrections;
}

/**
 * Categorizes a correction based on the explanation text
 */
function categorizeCorrection(
  explanation: string
): "grammar" | "vocabulary" | "pronunciation" | "usage" {
  const lowerExplanation = explanation.toLowerCase();

  if (
    lowerExplanation.includes("verb") ||
    lowerExplanation.includes("tense") ||
    lowerExplanation.includes("conjugat") ||
    lowerExplanation.includes("agreement") ||
    lowerExplanation.includes("gender") ||
    lowerExplanation.includes("plural") ||
    lowerExplanation.includes("article")
  ) {
    return "grammar";
  }

  if (
    lowerExplanation.includes("word") ||
    lowerExplanation.includes("mean") ||
    lowerExplanation.includes("say") ||
    lowerExplanation.includes("term") ||
    lowerExplanation.includes("expression")
  ) {
    return "vocabulary";
  }

  if (
    lowerExplanation.includes("pronounc") ||
    lowerExplanation.includes("sound") ||
    lowerExplanation.includes("accent")
  ) {
    return "pronunciation";
  }

  return "usage";
}

export class AnthropicClaudeService implements ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    messages: ChatMessage[],
    userMessage: string,
    profile?: LearnerProfile | null
  ): Promise<TutorResponse> {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Add the new user message
    anthropicMessages.push({
      role: "user",
      content: userMessage,
    });

    // Build personalized system prompt
    const systemPrompt = buildSystemPrompt(profile);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 256,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const textContent = response.content.find((block) => block.type === "text");
    const content = textContent?.type === "text" ? textContent.text : "";

    // Parse corrections from the response
    const corrections = parseCorrections(content);

    return {
      content,
      corrections,
    };
  }
}

export function createClaudeService(apiKey: string): ClaudeService {
  return new AnthropicClaudeService(apiKey);
}
