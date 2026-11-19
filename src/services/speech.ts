import type {
  ISpeechRecognition,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
  ISpeechRecognitionConstructor,
} from '../types/speech';

// Web Speech Synthesis (Text to Speech)
export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel(); // Stop prior speech
    const cleanText = text.replace(/\b(sb|sth|somebody|something)\b|____/gi, '').trim();
    if (!cleanText) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    // Try finding an American English voice
    const voices = window.speechSynthesis.getVoices();
    const usVoice = voices.find(
      (v) => v.lang.includes('en-US') || v.name.includes('US') || v.name.includes('United States')
    );
    if (usVoice) {
      utterance.voice = usVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Web Speech Recognition (Speech to Text)
function getSpeechRecognitionConstructor(): ISpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export function createSpeechRecognizer(
  onResult: (transcript: string) => void,
  onError: (errorMessage: string) => void,
  onEnd: () => void
): ISpeechRecognition | null {
  const SpeechConstructor = getSpeechRecognitionConstructor();
  if (!SpeechConstructor) {
    onError('Trình duyệt chưa hỗ trợ nhận diện giọng nói (Khuyên dùng Chrome hoặc Edge).');
    return null;
  }

  const recognition: ISpeechRecognition = new SpeechConstructor();

  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: ISpeechRecognitionEvent) => {
    if (event.results && event.results[0] && event.results[0][0]) {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    }
  };

  recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
    onError(event.error || 'Lỗi nhận diện âm thanh micro');
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
}
