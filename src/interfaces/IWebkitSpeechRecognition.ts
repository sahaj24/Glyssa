// Type definition for WebkitSpeechRecognition

// Define SpeechRecognitionEvent interface
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface IWebkitSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: ErrorEvent) => void;
}

// Note: Window interface with webkitSpeechRecognition is already declared in global.d.ts
