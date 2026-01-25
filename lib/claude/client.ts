import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, TutorResponse, ClaudeService } from "./types";
import { FRENCH_TUTOR_SYSTEM_PROMPT } from "./prompts";

export class AnthropicClaudeService implements ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: ChatMessage[], userMessage: string): Promise<TutorResponse> {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Add the new user message
    anthropicMessages.push({
      role: "user",
      content: userMessage,
    });

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 256,
      system: FRENCH_TUTOR_SYSTEM_PROMPT,
      messages: anthropicMessages,
    });

    const textContent = response.content.find((block) => block.type === "text");
    const content = textContent?.type === "text" ? textContent.text : "";

    return {
      content,
    };
  }
}

export function createClaudeService(apiKey: string): ClaudeService {
  return new AnthropicClaudeService(apiKey);
}
