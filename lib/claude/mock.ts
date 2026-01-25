import { ChatMessage, TutorResponse, ClaudeService, LearnerProfile } from "./types";

// Mock responses that simulate a French tutor
const mockResponses = [
  {
    content: "Bonjour! Je vais tres bien, merci. Et vous, comment ca va aujourd'hui?",
  },
  {
    content: "Ah, un cafe! Excellent choix. Vous le preferez noir ou avec du lait?",
  },
  {
    content: "La gare? C'est tout droit, puis tournez a gauche apres le supermarche.",
  },
  {
    content: "Enchante! C'est formidable que vous appreniez le francais. Depuis combien de temps etudiez-vous?",
  },
  {
    content: "Aujourd'hui il fait beau! Le soleil brille. C'est parfait pour une promenade, non?",
  },
  {
    content: "Je comprends. Apres une longue journee de travail, c'est normal d'etre fatigue. Que faites-vous pour vous detendre?",
  },
  {
    content: "Merci! J'essaie de rendre les lecons interessantes. Quel sujet aimeriez-vous explorer?",
  },
  {
    content: "Bien sur! Je vais parler plus lentement. Prenez votre temps pour comprendre.",
  },
  {
    content:
      "La cuisine francaise est delicieuse! Quel est votre plat prefere? Les croissants? Le coq au vin?",
  },
  {
    content: "Pas de probleme. Voulez-vous que je repete en anglais? I can explain in English if that helps!",
  },
  // Add a mock correction response
  {
    content:
      "Je suis allé — We use 'être' with 'aller' in passé composé, not 'avoir'. C'était où, ton voyage?",
  },
];

let responseIndex = 0;

export class MockClaudeService implements ClaudeService {
  async chat(
    messages: ChatMessage[],
    userMessage: string,
    profile?: LearnerProfile | null
  ): Promise<TutorResponse> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    // Cycle through mock responses
    const response = mockResponses[responseIndex % mockResponses.length];
    responseIndex++;

    return {
      content: response.content,
      corrections: [],
    };
  }
}

export const mockClaude = new MockClaudeService();
