import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { IWebkitSpeechRecognition } from '../interfaces/IWebkitSpeechRecognition';
import { GeminiResponse, GeminiAnnotation } from '../interfaces/GeminiResponse';
import { explainCode, readCodeAloud, answerCodeQuestion } from '../services/geminiService';
import googleTTSService from '../services/googleTTSService';
import fakeTTSService from '../services/fakeTTSService';
import { useTts } from 'tts-react';
import type * as Monaco from 'monaco-editor';

// Type definition for SpeechRecognitionEvent
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  annotations?: GeminiResponse['annotations'];
  isProcessing?: boolean;
}

interface AIAssistantProps {
  code?: string;
  language?: string;
  highlightedCode?: string;
  highlightedLines?: number[];
  editorRef?: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  onHighlight?: (lineNumber: number) => void;
}

const AIAssistant = ({
  code,
  language,
  onHighlight,
  highlightedCode,
  highlightedLines,
  editorRef
}: AIAssistantProps): ReactElement => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [currentHighlight, setCurrentHighlight] = useState<number | null>(null);
  const [activeSpeechSegment, setActiveSpeechSegment] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  // These states are not currently used but may be needed in future implementations
  const [_isLoading, _setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsText, setTtsText] = useState<string>('');

  // Speech recognition state (for future implementation) - currently unused
  // const [transcript, setTranscript] = useState<string>('');
  // const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [recognition, setRecognition] = useState<IWebkitSpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentDecorationIdsRef = useRef<string[]>([]);

  // TTS state reference to track playback status and line mappings
  interface TTSStateRef {
    active: boolean;
    completed: boolean;
    fallbackStarted: boolean;
    googleStarted: boolean;
    currentHighlightIndex: number;
    lastActivityTimestamp?: number; // Track last activity timestamp
    lineToTextMapping?: Array<{ lineNumber: number; text: string; index: number }>;
    extractedLineRefs?: Array<{ lineNumber: number; text: string; index: number }>;
  }
  const ttsStateRef = useRef<TTSStateRef>({
    active: false, 
    completed: false, 
    fallbackStarted: false, 
    googleStarted: false,
    currentHighlightIndex: -1,
    lastActivityTimestamp: 0
  });
  
  // Ref to keep track of timer IDs for cleanup
  const timerIdsRef = useRef<NodeJS.Timeout[]>([]);

  // Initialize the useTts hook from tts-react with simplified type handling
  const { ttsChildren, state: _ttsState, stop } = useTts({
    children: ttsText,
    markTextAsSpoken: true,
    onStart: () => {
      console.log('TTS started');
      ttsStateRef.current.active = true;
      ttsStateRef.current.lastActivityTimestamp = Date.now();
    },
    onBoundary: (event: any) => { // Using any temporarily to fix build issues
      // This fires on word boundaries during speech
      console.log('TTS boundary event:', event);
      ttsStateRef.current.lastActivityTimestamp = Date.now();

      // Make sure we have valid mappings
      if (!ttsStateRef.current.lineToTextMapping || ttsStateRef.current.lineToTextMapping.length === 0) {
        console.warn('No line to text mapping available for highlighting');
        return;
      }

      // Get the current word index from the boundary event, using any to bypass type checking
      const charIndex = event.charIndex || 0;
      const mappings = ttsStateRef.current.lineToTextMapping;

      // Find the line number for this word boundary
      for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        const nextMapping = mappings[i + 1];

        // Check if this is our current position
        if (!nextMapping || charIndex < nextMapping.index) {
          // Skip if we're already highlighting this line
          if (ttsStateRef.current.currentHighlightIndex === i) {
            return;
          }

          // Update current highlight index
          ttsStateRef.current.currentHighlightIndex = i;
          console.log(`Highlighting line ${mapping.lineNumber} from word boundary at index ${charIndex}`);

          // Highlight the line in Monaco editor
          highlightLine(mapping.lineNumber);
          break;
        }
      }
    },
    onEnd: () => {
      console.log('TTS ended');
      cleanupTTS();
    },
    onError: (error: string | Error) => {
      console.error('TTS error:', error);
      cleanupTTS();
    }
  });

  // Function to get the latest editor content from various sources - currently unused
  /*
  const getLatestEditorContent = (): string => {
    console.log('Attempting to get latest editor content...');

    try {
      // First priority: Try to access the global editor instance set in page.tsx
      const anyWindow = window as Window & typeof globalThis & { glyssaEditorInstance?: Monaco.editor.IStandaloneCodeEditor; monaco?: typeof Monaco };
      if (anyWindow.glyssaEditorInstance) {
        const model = anyWindow.glyssaEditorInstance.getModel();
        if (model) {
          console.log('Retrieved content from global editor instance');
          return model.getValue();
        }
      }
  */

  /*
      // Second priority: Try to use the editorRef passed as prop
      if (editorRef?.current) {
        const model = editorRef.current.getModel();
        if (model) {
          console.log('Retrieved content from passed editor ref');
          return model.getValue();
        }
      }

      // Third priority: Try to access monaco models directly
      if (typeof window !== 'undefined' && (window as Window & typeof globalThis & { monaco?: { editor?: { getModels?: () => monaco.editor.ITextModel[] } } }).monaco?.editor?.getModels) {
        const models = (window as Window & typeof globalThis & { monaco?: { editor?: { getModels?: () => monaco.editor.ITextModel[] } } }).monaco?.editor?.getModels();
        if (models.length > 0) {
          console.log('Retrieved content from Monaco editor model');
          return models[0].getValue();
        }
      }
  */

  /*
      // Last resort: Use the code prop passed to this component
      if (code) {
        console.log('Using passed code prop as content');
        return code;
      }

      console.warn('Could not retrieve editor content from any source');
      return '';
    } catch (error) {
      console.error('Error getting editor content:', error);
      return code || '';
    }
  };
  */

  // Function to handle line highlighting when called by TTS or independent timer
  const highlightLine = (lineNumber: number): void => {
    console.log(`TTS highlighting line: ${lineNumber}`);

    // Update state for component rendering
    setCurrentHighlight(lineNumber);
    
    // Find the active speech segment based on line number
    if (ttsStateRef.current?.extractedLineRefs?.length > 0) {
      const matchingSegment = ttsStateRef.current.extractedLineRefs.find(
        ref => ref.lineNumber === lineNumber
      );
      
      if (matchingSegment) {
        setActiveSpeechSegment(matchingSegment.index);
        console.log(`Set active speech segment to index ${matchingSegment.index}`);
      }
    }

    try {
      // Ensure line number is valid
      if (lineNumber < 0) {
        console.warn(`Invalid line number: ${lineNumber}`);
        return;
      }
      
      // Find the best available editor instance - try multiple sources
      let editorInstance = null;
      const anyWindow = window as any;

      // Try to get editor instance in order of reliability
      // 1. First try the global instance set in page.tsx (most reliable)
      if (anyWindow.glyssaEditorInstance) {
        editorInstance = anyWindow.glyssaEditorInstance;
        console.log('Using global editor instance for highlighting');
      } 
      // 2. Then try the passed reference
      else if (editorRef?.current) {
        editorInstance = editorRef.current;
        console.log('Using passed editor reference for highlighting');
      }
      // 3. Try to get from Monaco models as last resort
      else if (anyWindow.monaco?.editor) {
        const editors = anyWindow.monaco.editor.getEditors();
        if (editors.length > 0) {
          editorInstance = editors[0];
          console.log('Using Monaco editor instance for highlighting');
        }
      }

      // DIRECT HIGHLIGHTING: If we have an editor instance, highlight directly
      if (editorInstance) {
        try {
          // Monaco uses 1-based line numbers
          const monacoLineNumber = lineNumber + 1;

          // Reveal the line in the editor
          editorInstance.revealLineInCenter(monacoLineNumber);

          // Clear any existing decorations
          if (currentDecorationIdsRef.current.length > 0) {
            editorInstance.deltaDecorations(currentDecorationIdsRef.current, []);
            currentDecorationIdsRef.current = [];
          }

          // Create decoration for highlighted line
          const decorations = editorInstance.deltaDecorations(
            [],
            [{
              range: {
                startLineNumber: monacoLineNumber,
                endLineNumber: monacoLineNumber,
                startColumn: 1,
                endColumn: 1000
              },
              options: {
                isWholeLine: true,
                className: 'highlighted-line',
                inlineClassName: 'highlighted-text',
                stickiness: 1
              }
            }]
          );

          // Store the decoration IDs for later removal
          currentDecorationIdsRef.current = decorations;

          // Clear decoration after a delay
          const clearTimer = setTimeout(() => {
            if (editorInstance && currentDecorationIdsRef.current.length > 0) {
              editorInstance.deltaDecorations(currentDecorationIdsRef.current, []);
              currentDecorationIdsRef.current = [];
              console.log('Cleared decorations');
            }
          }, 2000);

          // Store the timer for cleanup
          timerIdsRef.current.push(clearTimer);

          console.log(`Direct highlighting applied to line ${monacoLineNumber}`);
          return; // Successfully highlighted, exit function
        } catch (directHighlightError) {
          console.error('Error in direct editor highlighting:', directHighlightError);
          // Continue to fallback below
        }
      }
      
      // Fallback: use the onHighlight callback provided by parent
      console.log('Using parent callback for highlighting');
      if (onHighlight) {
        onHighlight(lineNumber);
      } else {
        console.warn('No highlighting method available - neither direct access nor callback');
      }
    } catch (error) {
      console.error('Error in highlightLine:', error);
      // Try the fallback as last resort
      if (onHighlight) {
        onHighlight(lineNumber);
      }
    }
  };

  // Function to handle TTS completion and cleanup
  const cleanupTTS = () => {
    console.log('Cleaning up all TTS services');
    
    // Stop all TTS services
    fakeTTSService.stop();
    googleTTSService.stop();
    
    // Stop tts-react playback if function exists
    if (typeof stop === 'function') {
      stop();
    }
    
    // Reset UI state
    setIsSpeaking(false);
    setActiveSpeechSegment(null);
    setCurrentHighlight(null);
    
    // Reset TTS state with type-safe approach
    ttsStateRef.current = {
      ...ttsStateRef.current,
      active: false,
      completed: true,
      fallbackStarted: false,
      googleStarted: false,
      lastActivityTimestamp: 0,
      currentHighlightIndex: -1
    };
    
    // Reset any lingering highlight in editor
    try {
      highlightLine(-1); // Use -1 to clear highlighting
    } catch (error) {
      console.error('Error clearing highlighting:', error);
    }
    
    // Clear all active timers
    timerIdsRef.current.forEach(timerId => clearTimeout(timerId));
    timerIdsRef.current = [];
  };

  // Function to handle text-to-speech with line highlighting
  const handleReadAloud = async (messageId: string, text: string, annotations?: GeminiResponse['annotations'], codeContent?: string): Promise<void> => {
    // Reset TTS state at the start
    ttsStateRef.current = { 
      active: false, 
      completed: false, 
      fallbackStarted: false, 
      googleStarted: false,
      currentHighlightIndex: -1,
      lastActivityTimestamp: Date.now() // Initialize with current timestamp
    };

    // Stop any currently playing TTS
    googleTTSService.stop();
    fakeTTSService.stop();
    if (typeof stop === 'function') {
      stop();
    }
    
    // Short delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Update UI state
    setIsSpeaking(true);
    setActiveSpeechSegment(null);
    setCurrentHighlight(null);
    
    console.log('Starting read aloud with annotations:', annotations);
    
    // CRITICAL: Try all possible ways to get the editor content
    // First check the global window reference which is most reliable
    let actualCode = "";
    const anyWindow = window as any;
    
    try {
      // Try global editor reference first (most reliable)
      if (anyWindow.glyssaEditorInstance) {
        actualCode = anyWindow.glyssaEditorInstance.getValue();
        console.log('Retrieved code from global editor instance, length:', actualCode.length);
      } 
      // Then try the passed editor reference 
      else if (editorRef?.current) {
        actualCode = editorRef.current.getValue();
        console.log('Retrieved code from passed editor reference, length:', actualCode.length);
      }
      // Then try any available Monaco models
      else if (anyWindow.monaco?.editor) {
        const models = anyWindow.monaco.editor.getModels();
        if (models.length > 0) {
          actualCode = models[0].getValue();
          console.log('Retrieved code from Monaco editor model, length:', actualCode.length);
        }
      }
    } catch (editorError) {
      console.error('Error retrieving editor content directly:', editorError);
    }

    // If still empty, try the codeContent parameter
    if (!actualCode && codeContent) {
      actualCode = codeContent;
      console.log('Using provided codeContent, length:', actualCode.length);
    }
    
    // If still empty, try the code prop
    if (!actualCode && code) {
      actualCode = code;
      console.log('Using code prop, length:', actualCode.length);
    }

    // Check if we have valid inputs
    if (!text || text.trim() === "") {
      setIsSpeaking(false);
      console.error('No text provided for TTS');
      return;
    }

    if (!actualCode) {
      console.warn('No code content available, will proceed without code context');
    }

    // Extract line references from annotations if available
    const extractedLineRefs: Array<{ lineNumber: number; text: string; index: number }> = [];
    if (annotations && annotations.length > 0) {
      console.log('Processing annotations for highlighting:', annotations.length);
      
      annotations.forEach((annotation, idx) => {
        // Make sure we have valid line numbers
        if (typeof annotation.startLine === 'number') {
          extractedLineRefs.push({
            lineNumber: annotation.startLine,
            text: annotation.explanation || `Line ${annotation.startLine}`,
            index: idx // Store the index for later reference
          });
        }
      });

      console.log('Extracted line references:', extractedLineRefs.length);
    }

    // Prepare the line-to-text mapping for synchronized highlighting
    const lineToTextMapping: Array<{ lineNumber: number; text: string; index: number }> = [];
    let totalTextLength = 0;
    
    // Split the text into sentences and map them to line numbers if possible
    const sentences = text.split(/(?<=[.!?])\s+/);
    sentences.forEach((sentence, idx) => {
      // Default to first line or -1 if no lines
      const defaultLineNumber = extractedLineRefs.length > 0 ? extractedLineRefs[0].lineNumber : -1;
      
      // Try to map this sentence to a specific line
      // This is a simple heuristic - in a real implementation, you'd want more sophisticated mapping
      let lineForSentence = defaultLineNumber;
      
      // Use annotations to help map sentences to lines when possible
      if (extractedLineRefs.length > 0) {
        // Simplified mapping - assign lines sequentially
        // A more sophisticated implementation would match sentence content to annotation content
        const lineIdx = Math.min(idx % extractedLineRefs.length, extractedLineRefs.length - 1);
        lineForSentence = extractedLineRefs[lineIdx].lineNumber;
      }
      
      lineToTextMapping.push({
        lineNumber: lineForSentence,
        text: sentence,
        index: totalTextLength
      });
      
      totalTextLength += sentence.length + 1; // +1 for the space
    });
    
    // Store the mappings in our state ref for access in callbacks
    ttsStateRef.current.lineToTextMapping = lineToTextMapping;
    ttsStateRef.current.extractedLineRefs = extractedLineRefs;
    
    console.log('Line to text mapping created with', lineToTextMapping.length, 'entries');
    
    // Define highlight callback function once to ensure consistent signature for all TTS services
    const highlightCallback = (lineNumber: number): void => {
      console.log(`Highlighting line ${lineNumber} from TTS service callback`);
      // Use our improved highlightLine function which handles fallbacks
      highlightLine(lineNumber);
    };

    // Define completion callback function once for all TTS services
    const completionCallback = (): void => {
      console.log('TTS playback completed');
      cleanupTTS();
    };
    
    // Set the text for the TTS component to read
    setTtsText(text);
    
    // IMPORTANT: Use Google TTS directly as primary method
    console.log('Using Google TTS directly as primary method');
    ttsStateRef.current.googleStarted = true;
    ttsStateRef.current.active = true;
    ttsStateRef.current.lastActivityTimestamp = Date.now();
    
    // Start Google TTS service
    googleTTSService.speak(
      text,
      highlightCallback,
      completionCallback,
      undefined, // Voice options - update with correct type if needed
      actualCode
    );
    
    // Set a failsafe timer to ensure completion is called even if TTS fails
    const failsafeTimer = setTimeout(() => {
      if (!ttsStateRef.current.completed) {
        console.log('TTS may have failed, using fake TTS as final fallback');
        
        // Extract just the line numbers for independent highlighting
        const lineNumbers = extractedLineRefs.map(ref => ref.lineNumber);
        
        // Final fallback - fake TTS with just synchronized highlighting
        fakeTTSService.runHighlightingIndependently(
          lineNumbers.length > 0 ? lineNumbers : [1, 2, 3], // Use default if no lines
          highlightCallback,
          completionCallback
        );
      }
    }, 5000);
    
    // Store the timer for cleanup
    timerIdsRef.current.push(failsafeTimer);
  };

  // Alias for backward compatibility
  const handleCompletion = cleanupTTS;

  const prepareAnnotationsForSpeech = (annotations?: GeminiResponse['annotations']) => {
    if (!annotations || annotations.length === 0) return [];

    return [...annotations].sort((a, b) => a.startLine - b.startLine);
  };

  useEffect(() => {
    console.log('AIAssistant received props:', { 
      codeLength: code?.length,
      language,
      hasHighlightedCode: !!highlightedCode
    });
  }, [code, language, highlightedCode]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [showDebug, setShowDebug] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition as unknown as {
        new (): IWebkitSpeechRecognition;
      };
      
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      const handleRecognitionResult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        
        setInput(transcript);
        handleSendMessage(transcript);
      };

      recognitionInstance.onresult = handleRecognitionResult;
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollToBottom2();
    }, 50);
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: 'Hi! I\'m Glyssa, your AI code tutor. I can explain your code, answer questions, and read code aloud. How can I help you today?',
          timestamp: new Date(),
        }
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    googleTTSService.initVoices().then((success: boolean) => {
      if (!success) {
        console.error('Failed to initialize Google TTS voices, falling back to browser TTS');
        fakeTTSService.initVoices().catch((error) => {
          console.error('Failed to initialize fallback TTS voices', error);
        });
      }
    }).catch((error) => {
      console.error('Error initializing Google TTS voices', error);
      fakeTTSService.initVoices().catch((error) => {
        console.error('Failed to initialize fallback TTS voices', error);
      });
    });
    
    return () => {
      googleTTSService.stop();
      fakeTTSService.stop();
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.parentElement;
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  };

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    
    const processingId = Date.now().toString() + '-processing';
    const processingMessage: Message = {
      id: processingId,
      sender: 'ai',
      text: '...',
      timestamp: new Date(),
      isProcessing: true,
    };
    
    setMessages(prev => [...prev, userMessage, processingMessage]);
    setInput('');
    
    try {
      let response: GeminiResponse;
      
      const lowerText = messageText.toLowerCase();
      
      if (lowerText.includes('read') && lowerText.includes('aloud')) {
        response = await readCodeAloud({ code, language });
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
        
      } else if (lowerText.includes('explain') || 
                lowerText.includes('what') || 
                lowerText.includes('how') || 
                lowerText.includes('why')) {
        
        if (highlightedCode) {
          response = await answerCodeQuestion(highlightedCode, messageText, language, highlightedCode);
        } else {
          response = await explainCode({ code, language });
        }
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
        
      } else {
        response = await answerCodeQuestion(code, messageText, language, undefined);
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
      }
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === processingId 
            ? { 
                ...msg, 
                text: response.text, 
                annotations: response.annotations,
                isProcessing: false 
              } 
            : msg
        )
      );
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === processingId 
            ? { 
                ...msg, 
                text: 'Sorry, I encountered an error processing your request. Please try again.', 
                isProcessing: false 
              } 
            : msg
        )
      );
    }
    
    try {
      // First priority: Try to access the global editor instance set in page.tsx
      const anyWindow = window as Window & typeof globalThis & { glyssaEditorInstance?: Monaco.editor.IStandaloneCodeEditor; monaco?: typeof Monaco };
      if (anyWindow.glyssaEditorInstance) {
        try {
          const editorContent = anyWindow.glyssaEditorInstance.getValue();
          if (editorContent) {
            console.log('Successfully retrieved content from global editor instance, length:', editorContent.length);
            return editorContent;
          }
        } catch (globalEditorError) {
          console.error('Error accessing global editor instance:', globalEditorError);
        }
      }
      
      // Second priority: Use the passed editor reference
      if (editorRef?.current) {
        try {
          const editorContent = editorRef.current.getValue();
          if (editorContent) {
            console.log('Successfully retrieved content from passed editor reference, length:', editorContent.length);
            return editorContent;
          }
        } catch (editorRefError) {
          console.error('Error accessing passed editor reference:', editorRefError);
        }
      }
      
      // Third priority: Try to find editor models via Monaco API
      if (anyWindow.monaco?.editor) {
        const models = anyWindow.monaco.editor.getModels();
        if (models.length > 0) {
          // Usually the first/only model is the one we want
          const modelContent = models[0].getValue();
          if (modelContent && modelContent.length > 0) {
            console.log('Using content from Monaco editor model, length:', modelContent.length);
            return modelContent;
          }
        }
      }
    } catch (error) {
      console.error('Error in getLatestEditorContent:', error);
    }
    
    // Last resort: Fall back to the code prop if all else fails
    console.log('Falling back to code prop, length:', code?.length || 0);
    googleTTSService.stop();
    fakeTTSService.stop();
  };

  const scrollToBottom2 = () => {
    if (messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.parentElement;
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  };

  const handleSendMessage2 = async (messageText: string = input): Promise<string | void> => {
    if (!messageText.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    
    const processingId = Date.now().toString() + '-processing';
    const processingMessage: Message = {
      id: processingId,
      sender: 'ai',
      text: '...',
      timestamp: new Date(),
      isProcessing: true,
    };
    
    setMessages(prev => [...prev, userMessage, processingMessage]);
    setInput('');
    
    try {
      let response: GeminiResponse;
      
      const lowerText = messageText.toLowerCase();
      
      if (lowerText.includes('read') && lowerText.includes('aloud')) {
        response = await readCodeAloud({ code, language });
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
        
      } else if (lowerText.includes('explain') || 
                lowerText.includes('what') || 
                lowerText.includes('how') || 
                lowerText.includes('why')) {
        
        if (highlightedCode) {
          response = await answerCodeQuestion(highlightedCode, messageText, language, highlightedCode);
        } else {
          response = await explainCode({ code, language });
        }
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
        
      } else {
        response = await answerCodeQuestion(code, messageText, language, undefined);
        
        if (response && response.text) {
          handleReadAloud(
            processingId,
            response.text,
            response.annotations,
            code
          );
        }
      }
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === processingId 
            ? { 
                ...msg, 
                text: response.text, 
                annotations: response.annotations,
                isProcessing: false 
              } 
            : msg
        )
      );
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === processingId 
            ? { 
                ...msg, 
                text: 'Sorry, I encountered an error processing your request. Please try again.', 
                isProcessing: false 
              } 
            : msg
        )
      );
    }
    
    try {
      // First priority: Try to access the global editor instance set in page.tsx
      const anyWindow = window as Window & typeof globalThis & { glyssaEditorInstance?: Monaco.editor.IStandaloneCodeEditor; monaco?: typeof Monaco };
      if (anyWindow.glyssaEditorInstance) {
        try {
          const editorContent = anyWindow.glyssaEditorInstance.getValue();
          if (editorContent) {
            console.log('Successfully retrieved content from global editor instance, length:', editorContent.length);
            return editorContent;
          }
        } catch (globalEditorError) {
          console.error('Error accessing global editor instance:', globalEditorError);
        }
      }
      
      // Second priority: Use the passed editor reference
      if (editorRef?.current) {
        try {
          const editorContent = editorRef.current.getValue();
          if (editorContent) {
            console.log('Successfully retrieved content from passed editor reference, length:', editorContent.length);
            return editorContent;
          }
        } catch (editorRefError) {
          console.error('Error accessing passed editor reference:', editorRefError);
        }
      }
      
      // Third priority: Try to find editor models via Monaco API
      if (anyWindow.monaco?.editor) {
        const models = anyWindow.monaco.editor.getModels();
        if (models.length > 0) {
          // Usually the first/only model is the one we want
          const modelContent = models[0].getValue();
          if (modelContent && modelContent.length > 0) {
            console.log('Using content from Monaco editor model, length:', modelContent.length);
            return modelContent;
          }
        }
      }
    } catch (error) {
      console.error('Error in getLatestEditorContent:', error);
    }
    
    // Last resort: Fall back to the code prop if all else fails
    console.log('Falling back to code prop, length:', code?.length || 0);
    googleTTSService.stop();
    fakeTTSService.stop();
  };

  const toggleRecording = (): void => {
    console.log('Speech recognition not implemented in this version');
    return;
  };

  const renderTtsComponent = (): React.ReactNode => {
    return (
      <div style={{ display: 'none' }}>
        {/* This is where the tts-react component renders its content */}
        {ttsChildren}
      </div>
    );
  };

  return (
    <div className="ai-assistant-container" style={{ overflow: 'hidden' }}>
      {showDebug && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#2a2a2a', 
          borderRadius: '4px',
          marginBottom: '10px',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Debug Panel</strong>
            <button 
              onClick={() => setShowDebug(false)}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}
            >
              Hide
            </button>
          </div>
          <div><strong>Speaking:</strong> {isSpeaking ? 'Yes' : 'No'}</div>
          <div><strong>Current Highlight:</strong> Line {currentHighlight >= 0 ? currentHighlight + 1 : 'None'}</div>
          <div><strong>Active Segment:</strong> {activeSpeechSegment >= 0 ? activeSpeechSegment : 'None'}</div>
          
          <div className="mt-4 border-t border-zinc-700 pt-4">
            <h3 className="text-sm font-bold mb-2">TTS Status</h3>
            <div className="text-xs text-green-500">✅ Google Cloud TTS enabled</div>
          </div>
          <div>
            <button 
              onClick={() => {
                const codeLines = code.split('\n');
                const firstLine = codeLines.length > 0 ? codeLines[0].trim() : 'No code available';
                const secondLine = codeLines.length > 1 ? codeLines[1].trim() : 'No second line';
                
                handleReadAloud(
                  'test', 
                  `This is a test of the TTS system using Google Cloud. [Line 1] ${firstLine}. [Line 2] ${secondLine}.`,
                  [{
                    startLine: 1,
                    endLine: 1,
                    explanation: firstLine
                  }, {
                    startLine: 2,
                    endLine: 2,
                    explanation: secondLine
                  }],
                  code 
                );
              }}
              style={{
                background: '#4a4a4a',
                border: 'none',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '4px',
                marginTop: '5px',
                cursor: 'pointer'
              }}
            >
              Test TTS
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-zinc-900 text-zinc-300 flex flex-col h-full" style={{ overflow: 'hidden' }}>
        <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ 
          scrollbarWidth: 'thin', 
          msOverflowStyle: 'none'
        }}>
          {messages.map((message) => (
            <div key={message.id} className="mb-6">
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center mr-3 flex-shrink-0">
                  {message.sender === 'ai' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="#fff">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="#fff">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div className="font-medium text-sm text-zinc-300">{message.sender === 'ai' ? 'Glyssa' : 'You'}</div>
                    <div className="text-xs text-zinc-500">{formatTime(message.timestamp)}</div>
                  </div>
                  
                  <div className={`mt-1 text-sm ${message.sender === 'ai' ? 'text-zinc-300' : 'text-zinc-200'}`}>
                    {message.isProcessing ? (
                      <div className="flex items-center">
                        <div className="animate-pulse">Thinking...</div>
                      </div>
                    ) : (
                      message.text
                    )}
                  </div>
                  
                  {message.sender === 'ai' && message.annotations && message.annotations.length > 0 && !message.isProcessing && (
                    <div className="mt-3 pl-2 border-l-2 border-zinc-700">
                      <div className="text-xs font-semibold text-zinc-500 mb-1">Code Annotations:</div>
                      <div className="text-xs space-y-2">
                        {message.annotations.map((annotation: GeminiAnnotation, index: number) => (
                          <div 
                            key={index}
                            className="p-1.5 bg-zinc-800 rounded cursor-pointer hover:bg-zinc-700"
                            onClick={() => {
                              const lineNumber = annotation.startLine;
                              console.log('Highlighting annotation line:', lineNumber);
                              onHighlight(lineNumber);
                              setCurrentHighlight(lineNumber);
                            }}
                          >
                            Line {annotation.startLine}{annotation.endLine > annotation.startLine ? `-${annotation.endLine}` : ''}: {annotation.explanation || 'Highlighted line'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t border-zinc-800">
          <div className="mb-4">
            <div className="text-xs font-semibold text-zinc-500 mb-2">Try asking about:</div>
            <div className="flex flex-wrap gap-2">
              <button 
                className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors"
                onClick={() => handleSendMessage("Explain this code")}
              >
                Explain this code
              </button>
              <button 
                className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors"
                onClick={() => handleSendMessage("Read this code aloud")}
              >
                Read aloud
              </button>
              <button 
                className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors"
                onClick={() => handleSendMessage("What does this function do?")}
              >
                Function purpose
              </button>
            </div>
          </div>
          
          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                }
              }}
              className="flex-1 px-4 py-2 text-sm text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
            />
            
            <button 
              className={`ml-2 p-2 rounded-lg ${isRecording ? 'bg-red-600' : 'bg-zinc-700'} text-white hover:bg-zinc-600 transition-colors`}
              onClick={toggleRecording}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            
            {/* Send button */}
            <button 
              className="ml-2 p-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              onClick={() => handleSendMessage()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {renderTtsComponent()}
    </div>
  );
};

export default AIAssistant;
