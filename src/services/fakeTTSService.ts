// Simple TTS service that uses the browser's Web Speech API
// This bypasses the need for Google Cloud credentials

import { VoiceOptions } from './googleTTSService';

// Speech synthesis state
interface SpeechState {
  isPlaying: boolean;
  currentUtterance: SpeechSynthesisUtterance | null;
  lineNumberCallback: ((lineNumber: number) => void) | null;
  onFinishCallback: (() => void) | null;
  activeTimers: NodeJS.Timeout[];
}

// Current speech state
const state: SpeechState = {
  isPlaying: false,
  currentUtterance: null,
  lineNumberCallback: null,
  onFinishCallback: null,
  activeTimers: []
};

/**
 * Stop any currently playing speech
 */
function stop(): void {
  if (typeof window === 'undefined') return;
  
  if (state.isPlaying && window.speechSynthesis) {
    console.log('Stopping browser speech synthesis');
    window.speechSynthesis.cancel();
  }
  
  // Clear all active timers
  state.activeTimers.forEach(timer => clearTimeout(timer));
  state.activeTimers = [];
  
  state.isPlaying = false;
  state.currentUtterance = null;
  state.lineNumberCallback = null;
  state.onFinishCallback = null;
}

/**
 * Check if speech is currently playing
 */
function isSpeaking(): boolean {
  return state.isPlaying;
}

/**
 * Strip SSML tags from text for browser speech synthesis
 * This is needed because browser TTS doesn't support SSML tags
 */
function stripSSMLTags(text: string): string {
  console.log('Stripping SSML tags from text for browser speech');
  
  // First replace line references to make them more speech-friendly
  let cleanText = text
    // Handle line references like [Line 42] or [Lines 5-10]
    .replace(/\[Line\s*(\d+)(?:-\s*(\d+))?\]/gi, 'Line $1$2')
    .replace(/\[Lines\s*(\d+)\s*-\s*(\d+)\]/gi, 'Lines $1 to $2')
    // Handle tags with spaces or without spaces
    .replace(/Line(\d+)\b/gi, 'Line $1')
    // Handle punctuation after line references
    .replace(/Line\s*(\d+)(:)/gi, 'Line $1$2');
  
  // Now handle all SSML tags with appropriate substitutions
  cleanText = cleanText
    // Handle breaks with pauses
    .replace(/<break\s+time="(\d+)(?:ms|s)"\/?>/g, ', ')
    .replace(/<break[^>]*>/g, ', ')
    // Remove emphasis tags but keep their content
    .replace(/<emphasis[^>]*>/g, '')
    .replace(/<\/emphasis>/g, '')
    // Handle speak tags
    .replace(/<\/?speak>/g, '')
    // Handle prosody tags
    .replace(/<prosody[^>]*>/g, '')
    .replace(/<\/prosody>/g, '')
    // Handle voice tags
    .replace(/<voice[^>]*>/g, '')
    .replace(/<\/voice>/g, '')
    // Handle say-as tags
    .replace(/<say-as[^>]*>/g, '')
    .replace(/<\/say-as>/g, '')
    // Handle paragraph and sentence tags
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '. ')
    .replace(/<s>/g, '')
    .replace(/<\/s>/g, '. ')
    // Catch any remaining XML tags
    .replace(/<[^>]*>/g, '');
    
  console.log('Cleaned text sample:', cleanText.substring(0, 100) + '...');
  return cleanText;
}

/**
 * Extract line numbers from text for highlighting during speech
 */
function extractLineNumbers(text: string, codeToValidate?: string): { text: string; lineNumber: number }[] {
  const lineMarkers: { text: string; lineNumber: number }[] = [];
  
  // Safety check for empty input
  if (!text || text.trim() === '') {
    console.warn('Empty text provided to extractLineNumbers');
    return lineMarkers;
  }
  
  // Log a preview of the text we're analyzing
  console.log('Extracting line references from text:', 
             text.substring(0, Math.min(200, text.length)) + 
             (text.length > 200 ? '...' : ''));
  
  // Primary regex - Match patterns like "Line 42:" or "[Line 42]" or "[LineX]" or "line 42"
  // Case insensitive to catch any variation, with more flexible spacing
  // Also handle line ranges like "Line 10-15" 
  const lineRegex = /(?:\[\s*[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*\]|(?:^|\s)[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*(?:\]|:|\.|,|;|\s|$))/g;
  console.log('Extracting with primary regex pattern');
  let match;
  
  // Get code lines for validation if available
  const codeLines = codeToValidate ? codeToValidate.split('\n') : null;
  console.log('Code to validate has', codeLines?.length || 0, 'lines');
  
  while ((match = lineRegex.exec(text)) !== null) {
    const lineNumber = parseInt(match[1] || match[2] || match[3] || match[4], 10);
    if (!isNaN(lineNumber)) {
      // Skip highlighting empty lines or comment-only lines if we have code to validate
      if (codeLines && lineNumber > 0 && lineNumber <= codeLines.length) {
        const codeLine = codeLines[lineNumber - 1]?.trim();
        // Skip if line is empty or just a comment
        if (!codeLine || codeLine.startsWith('//') || codeLine.startsWith('/*') || codeLine.startsWith('*')) {
          // Find the next non-empty, non-comment line if possible
          let nextLineNumber = lineNumber;
          while (nextLineNumber < codeLines.length) {
            const nextLine = codeLines[nextLineNumber]?.trim();
            if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('/*') && !nextLine.startsWith('*')) {
              // Found a non-empty, non-comment line
              lineMarkers.push({
                text: match[0],
                lineNumber: nextLineNumber // Already 0-based for editor
              });
              break;
            }
            nextLineNumber++;
          }
          continue; // Skip the original empty/comment line
        }
      }
      
      // Store the starting position of this line marker in the text
      lineMarkers.push({
        text: match[0],
        lineNumber: lineNumber - 1 // Convert to 0-based index
      });
    }
  }
  
  // If primary regex failed to find any markers, try a more lenient approach
  if (lineMarkers.length === 0) {
    console.log('Primary regex found no line markers, trying more lenient regex');
    // More lenient regex that just looks for numbers that might be line references
    const lenientRegex = /[Ll]ine\s*(\d+)/g;
    
    while ((match = lenientRegex.exec(text)) !== null) {
      const lineNumber = parseInt(match[1], 10);
      if (!isNaN(lineNumber)) {
        lineMarkers.push({
          text: match[0],
          lineNumber: lineNumber - 1 // Convert to 0-based index
        });
        console.log(`Found line reference with lenient regex: ${match[0]} → line ${lineNumber}`);
      }
    }
  }
  
  // Last resort - if we still don't have line markers and have code to validate,
  // generate synthetic markers at reasonable intervals in the text
  if (lineMarkers.length === 0 && codeToValidate) {
    console.log('No line markers found, generating synthetic markers');
    const codeLines = codeToValidate.split('\n');
    
    // Get non-empty, non-comment lines
    const validLineNumbers = [];
    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i].trim();
      if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
        validLineNumbers.push(i); // 0-based line numbers
      }
    }
    
    if (validLineNumbers.length > 0) {
      // Create synthetic markers at beginning, middle, and near end of valid lines
      const positions = [0, Math.floor(validLineNumbers.length / 2), Math.min(validLineNumbers.length - 1, 8)];
      positions.forEach(pos => {
        if (pos >= 0 && pos < validLineNumbers.length) {
          lineMarkers.push({
            text: `Synthetic marker for line ${validLineNumbers[pos] + 1}`,
            lineNumber: validLineNumbers[pos]
          });
          console.log(`Created synthetic marker for line ${validLineNumbers[pos] + 1}`);
        }
      });
    }
  }
  
  console.log(`Found ${lineMarkers.length} line markers for highlighting`);
  return lineMarkers;
}

/**
 * Prepare text for highlighting by extracting line references and their positions
 */
function prepareTextForHighlighting(text: string, actualCode?: string): {
  cleanText: string;
  highlights: {lineNumber: number, wordIndex: number}[];
} {
  // Strip SSML first
  let cleanText = stripSSMLTags(text);
  
  // This regex matches line references like [Line 42] or Line 42: with any capitalization
  const regex = /(?:\[\s*[Ll]ine\s*(\d+)\s*\]|(?:^|\s)[Ll]ine\s*(\d+)\s*(?:\:|\.|,|;|\s|$))/g;
  console.log('Browser TTS: Preparing text with improved line reference pattern:', regex);
  console.log('Looking for line references with pattern:', regex);
  const highlights: {lineNumber: number, wordIndex: number}[] = [];
  
  // Create a map of positions to adjust after replacements
  const replacements: {start: number, end: number, replacement: string}[] = [];
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lineNumber = parseInt(match[1] || match[2], 10);
    if (!isNaN(lineNumber)) {
      // Store the match position and line number
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: `Line ${lineNumber}` // Simplified text
      });
      
      // Store the original index before clean text replacements
      highlights.push({
        lineNumber: lineNumber - 1, // Convert to 0-based
        wordIndex: match.index
      });
    }
  }
  
  // Sort replacements in reverse order to avoid messing up indices
  replacements.sort((a, b) => b.start - a.start);
  
  // Apply replacements to the clean text
  for (const r of replacements) {
    cleanText = cleanText.substring(0, r.start) + 
               r.replacement + 
               cleanText.substring(r.end);
  }
  
  return { cleanText, highlights };
}

/**
 * Speak text using browser's Web Speech API with line highlighting
 */
/**
 * Run line highlighting independently of speech synthesis
 * This function ensures highlighting continues even if speech fails
 */
function runHighlightingIndependently(
  lineMarkers: { text: string; lineNumber: number }[],
  lineNumberCallback: (lineNumber: number) => void,
  activeFlag: { value: boolean }
): void {
  if (!activeFlag.value || lineMarkers.length === 0) return;
  
  // Calculate reasonable timing for each highlight
  // We'll distribute highlights across about 10 seconds
  const totalDuration = 10000; // 10 seconds
  const intervalBase = totalDuration / (lineMarkers.length + 1);
  
  // Schedule each highlight with progressive timing
  lineMarkers.forEach((marker, index) => {
    // Add some randomness to make it feel more natural
    const jitter = Math.random() * 200 - 100; // +/- 100ms
    const delay = intervalBase * (index + 1) + jitter;
    
    setTimeout(() => {
      if (activeFlag.value) {
        console.log(`Independent highlight: line ${marker.lineNumber + 1}`);
        lineNumberCallback(marker.lineNumber);
      }
    }, delay);
  });
}

export async function speak(
  text: string,
  lineNumberCallback?: (lineNumber: number) => void,
  onFinishCallback?: () => void,
  onStartCallback?: () => void,
  codeToValidate?: string
): Promise<boolean> {
  // Set up independent highlighting that will continue even if speech fails
  const lineMarkers = extractLineNumbers(text, codeToValidate);
  const highlightingActive = { value: true }; // Object to track if highlighting should continue
  
  // Start the highlighting in a separate process that won't be affected by speech errors
  if (lineMarkers.length > 0 && lineNumberCallback) {
    console.log('Setting up independent highlighting with', lineMarkers.length, 'markers');
    
    // Start highlighting immediately with a small delay
    setTimeout(() => {
      if (highlightingActive.value) {
        runHighlightingIndependently(lineMarkers, lineNumberCallback, highlightingActive);
      }
    }, 500);
  }
  
  // Check if speech synthesis is available
  if (!window.speechSynthesis) {
    console.error('Speech synthesis not supported');
    // We'll still continue with highlighting even if speech fails
    if (onFinishCallback) {
      // Delay finish callback to allow highlighting to work for a while
      setTimeout(onFinishCallback, 5000);
    }
    return false;
  }
  
  console.log('Browser TTS speak called with text length:', text.length);
  
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported in this browser');
        if (onFinishCallback) onFinishCallback();
        resolve(false);
        return;
      }
      
      // Stop any currently playing speech
      if (state.isPlaying) {
        stop();
      }
      
      // Update callbacks
      state.lineNumberCallback = lineNumberCallback || null;
      state.onFinishCallback = onFinishCallback || null;
      
      // Process the text - remove SSML and extract line highlights
      const { cleanText, highlights } = prepareTextForHighlighting(text, codeToValidate);
      console.log('Clean text prepared for speech:', cleanText.substring(0, 100) + '...');
      console.log('Extracted line highlights:', highlights);
      
      // Create utterance with clean text (no SSML tags)
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Slightly slower for code explanation
      
      // Set available voice if possible
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(voice => voice.lang.includes('en-'));
      if (englishVoices.length > 0) {
        utterance.voice = englishVoices[0];
      }
      
      // Set up highlighting based on word boundaries
      const words = text.split(' ');
      const wordTimestamps = words.map((_, index) => {
        return (index / words.length) * (text.length / 10); // Estimate time for each word
      });
      
      // Set up highlighting timers
      const highlightTimers: NodeJS.Timeout[] = [];
      
      // Calculate a more adaptive timing for highlights based on text structure and position
      const calculateHighlightTiming = () => {
        // Get total estimated duration in milliseconds
        const estimatedSpeechRate = utterance.rate || 1;
        // Average reading speed (chars per second) adjusted by speech rate
        // Base: ~15 chars/second for normal speech
        const baseCharsPerSecond = 15;
        const charsPerSecond = baseCharsPerSecond / (utterance.rate || 1);
        const totalDuration = (cleanText.length / charsPerSecond) * 1000;
        
        console.log(`Estimated total speech duration: ${totalDuration}ms`);  
        
        // Rather than using a fixed buffer, calculate more proportional timing
        return highlights.map((marker, index) => {
          // Find relative position of this marker in the text
          const charPosition = words.slice(0, marker.wordIndex).join(' ').length;
          const relativePosition = charPosition / cleanText.length;
          
          // Basic linear timing (% of the way through speech)
          const basicTiming = relativePosition * totalDuration;
          
          // Significantly reduce initial delay and make it more responsive
          // Use a much smaller initial delay that decreases quickly
          const initialDelay = 750; // ms - much shorter initial delay
          const progressiveFactor = Math.max(0, 1 - (index / highlights.length) * 1.5); // Steeper reduction
          const progressiveDelay = initialDelay * progressiveFactor;
          
          // Smaller spacing between highlights
          const spacingFactor = 400; // ms minimum between highlights - reduced
          const spacingDelay = index * spacingFactor * (1 - relativePosition);
          
          // Calculate final timing with all factors
          const timing = basicTiming + progressiveDelay + spacingDelay;
          
          console.log(`Highlight #${index} for line ${marker.lineNumber} scheduled at ${timing}ms, ` + 
                      `relative position: ${(relativePosition*100).toFixed(1)}%`);
          
          return { marker, timing };
        });
      };
      
      // Calculate all the highlight timings
      const scheduledHighlights = calculateHighlightTiming();
      
      // Set up the timers for each highlight
      scheduledHighlights.forEach(({ marker, timing }) => {
        const timer = setTimeout(() => {
          console.log(`Executing highlight for line ${marker.lineNumber} at ${timing}ms`);
          if (state.lineNumberCallback) {
            state.lineNumberCallback(marker.lineNumber);
          }
        }, timing);
        
        highlightTimers.push(timer);
      });
      
      // Store timers for potential cancellation
      state.activeTimers = highlightTimers;
      
      // Set up event handlers
      utterance.onstart = () => {
        console.log('Speech started');
        state.isPlaying = true;
      };
      
      utterance.onend = () => {
        console.log('Speech ended');
        state.isPlaying = false;
        
        // Clear any remaining timers
        highlightTimers.forEach(timer => clearTimeout(timer));
        
        if (state.onFinishCallback) {
          state.onFinishCallback();
        }
        
        resolve(true);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        state.isPlaying = false;
        
        // Clear timers on error
        highlightTimers.forEach(timer => clearTimeout(timer));
        
        if (state.onFinishCallback) {
          state.onFinishCallback();
        }
        
        resolve(false);
      };
      
      // Store the utterance for potential cancellation
      state.currentUtterance = utterance;
      
      // Start speaking
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Error in speak function:', error);
      state.isPlaying = false;
      if (onFinishCallback) onFinishCallback();
      resolve(false);
    }
  });
}

/**
 * Get a list of available voices (placeholder for API compatibility)
 */
function getAvailableVoices(): Promise<VoiceOptions[]> {
  return Promise.resolve([{
    languageCode: 'en-US',
    name: 'browser-default',
    ssmlGender: 'NEUTRAL',
    type: 'standard'
  }]);
}

/**
 * Set voice (placeholder for API compatibility)
 */
function setVoice(voice: VoiceOptions): void {
  // No-op in this implementation
  console.log('setVoice called (not implemented in browser fallback)');
}

/**
 * Initialize voices (always succeeds with browser API)
 */
function initVoices(): Promise<boolean> {
  return Promise.resolve(true);
}

/**
 * Run line highlighting independently of speech synthesis with precise timing
 * Uses a more accurate approach with RAF for smoother timing
 * @param lineNumbers Array of line numbers to highlight in sequence
 * @param highlightCallback Callback to call for each highlighted line
 * @param completionCallback Callback to call when highlighting is complete
 */
function runIndependentHighlighting(
  lineNumbers: number[],
  highlightCallback?: (lineNumber: number) => void,
  completionCallback?: () => void
): void {
  console.log('Running precise independent highlighting for lines:', lineNumbers);
  
  // Safety check
  if (!lineNumbers || lineNumbers.length === 0) {
    console.warn('No line numbers provided for independent highlighting');
    if (completionCallback) completionCallback();
    return;
  }
  
  // Highlight state
  let currentIndex = 0;
  let lastHighlightTime = 0;
  const startTime = performance.now();
  
  // Calculate exact timings based on estimated reading speed
  // Average reading speed is ~200 words per minute, or ~3.33 words per second
  // We'll estimate 1 line every 1.5-2.5 seconds depending on line complexity
  
  // Create a highlight schedule with timestamps for each line
  const highlightSchedule = lineNumbers.map((line, index) => {
    // Estimate line complexity based on position (later lines often more complex)
    const lineComplexity = Math.min(1 + (index * 0.1), 2.0);
    // Base time between 1.5 and 2.5 seconds per line based on complexity
    const timeForLine = 1500 + (lineComplexity * 500);
    // Calculate absolute time from start for this highlight
    const timeFromStart = index === 0 ? 100 : // First line almost immediately
      lineNumbers.slice(0, index).reduce((sum, _, i) => {
        const prevComplexity = Math.min(1 + (i * 0.1), 2.0);
        return sum + 1500 + (prevComplexity * 500);
      }, 100);
    
    return {
      lineNumber: line,
      timeFromStart,
      highlighted: false
    };
  });
  
  console.log('Precise highlight schedule created:', 
    highlightSchedule.map(h => `Line ${h.lineNumber} at ${h.timeFromStart}ms`).join(', '));
  
  // Animation frame loop for precise timing
  function highlightLoop(timestamp: number) {
    const elapsedTime = timestamp - startTime;
    
    // Process all highlights that should have happened by now
    for (let i = 0; i < highlightSchedule.length; i++) {
      const highlight = highlightSchedule[i];
      
      if (!highlight.highlighted && elapsedTime >= highlight.timeFromStart) {
        // Time to highlight this line
        console.log(`Precise highlighting line ${highlight.lineNumber} at ${elapsedTime}ms`);
        
        if (highlightCallback) {
          try {
            highlightCallback(highlight.lineNumber);
          } catch (error) {
            console.error('Error in highlight callback:', error);
          }
        }
        
        highlight.highlighted = true;
        lastHighlightTime = elapsedTime;
        currentIndex = i + 1;
      }
    }
    
    // Continue loop if we haven't highlighted all lines
    if (currentIndex < highlightSchedule.length) {
      requestAnimationFrame(highlightLoop);
    } else {
      // All lines highlighted - schedule completion
      console.log('All lines highlighted, scheduling completion');
      setTimeout(() => {
        console.log('Highlighting complete after', performance.now() - startTime, 'ms');
        if (completionCallback) {
          try {
            completionCallback();
          } catch (error) {
            console.error('Error in completion callback:', error);
          }
        }
      }, 1000); // Small delay after last highlight before completion
    }
  }
  
  // Start the highlight loop
  requestAnimationFrame(highlightLoop);
  
  // Add safety timeout to ensure completion is called even if RAF fails
  const maxTotalDuration = 30000; // Max 30 seconds
  const safetyTimer = setTimeout(() => {
    console.log('Safety timer triggered for highlighting');
    if (completionCallback) {
      try {
        completionCallback();
      } catch (error) {
        console.error('Error in safety completion callback:', error);
      }
    }
  }, maxTotalDuration);
}

// Export the service
const fakeTTSService = {
  speak,
  stop,
  isSpeaking,
  initVoices,
  getAvailableVoices,
  setVoice,
  runHighlightingIndependently: runIndependentHighlighting
};

export default fakeTTSService;
