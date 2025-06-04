// Speech service for Glyssa
// This service handles text-to-speech functionality

export interface SpeechOptions {
  rate?: number;  // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
  voice?: string; // Voice name
}

class SpeechService {
  private speechSynthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isInitialized = false;
  private defaultOptions: SpeechOptions = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: 'Google US English'
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
      this.loadVoices();
    }
  }

  private loadVoices = () => {
    if (!this.speechSynthesis) return;
    
    // Get the voices
    const loadVoicesHandler = () => {
      this.voices = this.speechSynthesis!.getVoices();
      this.isInitialized = true;
    };

    // Chrome loads voices asynchronously
    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = loadVoicesHandler;
    }

    // Try to load voices immediately (works in Firefox)
    this.voices = this.speechSynthesis.getVoices();
    if (this.voices.length > 0) {
      this.isInitialized = true;
    }
  };

  private getVoice = (voiceName?: string): SpeechSynthesisVoice | null => {
    if (!this.isInitialized || this.voices.length === 0) return null;
    
    const name = voiceName || this.defaultOptions.voice;
    
    // Try to find the requested voice
    const voice = this.voices.find(v => v.name === name);
    if (voice) return voice;
    
    // Fallback to first English voice
    const englishVoice = this.voices.find(v => v.lang.includes('en'));
    if (englishVoice) return englishVoice;
    
    // Last resort: use the first available voice
    return this.voices[0];
  };

  public speak = (text: string, options?: SpeechOptions, onEnd?: () => void, onBoundary?: (event: SpeechSynthesisEvent) => void) => {
    if (!this.speechSynthesis || !this.isInitialized) {
      console.error('Speech synthesis not available or not initialized');
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    // Merge default options with provided options
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = mergedOptions.rate!;
    utterance.pitch = mergedOptions.pitch!;
    utterance.volume = mergedOptions.volume!;
    
    // Set the voice
    const voice = this.getVoice(mergedOptions.voice);
    if (voice) {
      utterance.voice = voice;
    }

    // Set callbacks
    if (onEnd) {
      utterance.onend = onEnd;
    }
    
    if (onBoundary) {
      utterance.onboundary = onBoundary;
    }

    // Store the current utterance
    this.currentUtterance = utterance;
    
    // Start speaking
    this.speechSynthesis.speak(utterance);
  };

  public stop = () => {
    if (!this.speechSynthesis) return;
    
    this.speechSynthesis.cancel();
    this.currentUtterance = null;
  };

  public pause = () => {
    if (!this.speechSynthesis) return;
    this.speechSynthesis.pause();
  };

  public resume = () => {
    if (!this.speechSynthesis) return;
    this.speechSynthesis.resume();
  };

  public getAvailableVoices = (): string[] => {
    if (!this.isInitialized) return [];
    return this.voices.map(voice => voice.name);
  };
}

// Create a singleton instance
const speechService = new SpeechService();
export default speechService;
