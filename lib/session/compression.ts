import Anthropic from "@anthropic-ai/sdk";
import { TranscriptEntry, SessionSummary } from "./types";
import { Correction } from "@/lib/claude/types";

const COMPRESSION_PROMPT = `You are analyzing a French tutoring session to extract learning insights. Analyze the conversation transcript and corrections to provide a structured summary.

## Transcript
{transcript}

## Corrections Made
{corrections}

## Session Duration
{duration} minutes

Based on this session, provide a JSON response with the following structure:
{
  "newVocabulary": [
    {
      "word": "French word",
      "translation": "English translation",
      "context": "How it was used in the conversation"
    }
  ],
  "practicedGrammar": ["List of grammar concepts practiced"],
  "highlights": "A brief 1-2 sentence summary of what went well",
  "recommendedFocus": ["Areas to focus on in future sessions"]
}

Rules:
- Only include vocabulary that was NEW or CORRECTED in this session
- Be specific about grammar concepts (e.g., "passé composé with être verbs" not just "past tense")
- Keep highlights encouraging and specific
- Limit recommendedFocus to 2-3 actionable items
- Return ONLY valid JSON, no markdown or explanation`;

export async function compressSession(
  transcript: TranscriptEntry[],
  corrections: Correction[],
  durationMinutes: number,
  apiKey?: string
): Promise<SessionSummary> {
  // Format transcript for the prompt
  const transcriptText = transcript
    .map((entry) => `[${entry.speaker.toUpperCase()}]: ${entry.text}`)
    .join("\n");

  // Format corrections for the prompt
  const correctionsText =
    corrections.length > 0
      ? corrections
          .map(
            (c) =>
              `- Corrected: "${c.corrected}" | Explanation: ${c.explanation} | Category: ${c.category}`
          )
          .join("\n")
      : "No corrections were made in this session.";

  // Build the prompt
  const prompt = COMPRESSION_PROMPT.replace("{transcript}", transcriptText)
    .replace("{corrections}", correctionsText)
    .replace("{duration}", durationMinutes.toString());

  // If no API key, return a basic summary
  if (!apiKey) {
    return createBasicSummary(transcript, corrections, durationMinutes);
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    const content = textContent?.type === "text" ? textContent.text : "";

    // Parse the JSON response
    const parsed = JSON.parse(content);

    return {
      durationMinutes,
      newVocabulary: parsed.newVocabulary || [],
      practicedGrammar: parsed.practicedGrammar || [],
      correctionsCount: corrections.length,
      highlights: parsed.highlights || "Great practice session!",
      recommendedFocus: parsed.recommendedFocus || [],
    };
  } catch (error) {
    console.error("Session compression failed:", error);
    // Fall back to basic summary
    return createBasicSummary(transcript, corrections, durationMinutes);
  }
}

function createBasicSummary(
  transcript: TranscriptEntry[],
  corrections: Correction[],
  durationMinutes: number
): SessionSummary {
  // Extract unique grammar categories from corrections
  const grammarExplanations = corrections
    .filter((c) => c.category === "grammar")
    .map((c) => c.explanation.slice(0, 50));
  const grammarCategories = Array.from(new Set(grammarExplanations));

  return {
    durationMinutes,
    newVocabulary: [],
    practicedGrammar: grammarCategories,
    correctionsCount: corrections.length,
    highlights: `Completed a ${durationMinutes} minute conversation with ${transcript.length} exchanges.`,
    recommendedFocus:
      corrections.length > 0
        ? ["Review the corrections from this session"]
        : ["Keep practicing conversational French"],
  };
}
