// Browser-based TTS using Web Speech API
// This is a client-side only implementation

export function speakText(text: string, lang: string = "fr-FR"): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("[Browser TTS] speakText called with text length:", text.length, "lang:", lang);
    
    if (!("speechSynthesis" in window)) {
      console.error("[Browser TTS] Speech synthesis not supported");
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for learners

    // Try to find a French voice
    const voices = speechSynthesis.getVoices();
    console.log("[Browser TTS] Available voices:", voices.length);
    const frenchVoice = voices.find(
      (voice) => voice.lang.startsWith("fr") && voice.localService
    );
    if (frenchVoice) {
      console.log("[Browser TTS] Using French voice:", frenchVoice.name);
      utterance.voice = frenchVoice;
    } else {
      console.warn("[Browser TTS] No French voice found, using default");
    }

    utterance.onstart = () => {
      console.log("[Browser TTS] Speech started");
    };
    utterance.onend = () => {
      console.log("[Browser TTS] Speech ended");
      resolve();
    };
    utterance.onerror = (event) => {
      console.error("[Browser TTS] Speech error:", event.error);
      reject(new Error(event.error));
    };

    console.log("[Browser TTS] Starting speech synthesis");
    speechSynthesis.speak(utterance);
  });
}

// Initialize voices (some browsers need this)
export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });
}
