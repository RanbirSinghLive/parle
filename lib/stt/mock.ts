import { STTResult, STTService } from "./types";

// Array of mock French phrases to simulate variety
const mockPhrases = [
  "Bonjour, comment allez-vous?",
  "Je voudrais un cafe, s'il vous plait.",
  "Ou est la gare?",
  "Je m'appelle et j'apprends le francais.",
  "Quel temps fait-il aujourd'hui?",
  "Je suis fatigue apres le travail.",
  "C'est tres interessant!",
  "Pouvez-vous repeter, s'il vous plait?",
  "J'aime beaucoup la cuisine francaise.",
  "Je ne comprends pas tres bien.",
];

let phraseIndex = 0;

export class MockSTTService implements STTService {
  async transcribe(audioBlob: Blob): Promise<STTResult> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));

    // Cycle through mock phrases
    const transcript = mockPhrases[phraseIndex % mockPhrases.length];
    phraseIndex++;

    return {
      transcript,
      confidence: 0.95,
    };
  }
}

export const mockSTT = new MockSTTService();
