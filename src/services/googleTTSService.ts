// Google Cloud Text-to-Speech service for Glyssa
// Uses Google Cloud TTS API via server-side API route

// Available voice types (for API compatibility with Google Cloud TTS)
export type VoiceType = 'standard' | 'wavenet' | 'neural2';

// Voice options (for API compatibility with Google Cloud TTS)
export interface VoiceOptions {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  type: VoiceType;
}

// Default voice configuration - using the highest quality neural voice
const defaultVoice: VoiceOptions = {
  languageCode: 'en-US',
  name: 'en-US-Neural2-D', // Neural voices offer high-quality with full SSML support
  ssmlGender: 'MALE',
  type: 'neural2'
};

// Speech synthesis state
interface SpeechState {
  isPlaying: boolean;
  currentUtterance: HTMLAudioElement | null;
  lineNumberCallback: ((lineNumber: number) => void) | null;
  onFinishCallback: (() => void) | null;
  quotaExceededUntil?: number; // Timestamp until which quota is exceeded
  fallbackMode: boolean; // If true, skip Google TTS API and use browser TTS directly
  fallbackReasonLog: string[]; // Log of reasons for fallback
  consecutiveErrors: number; // Count of consecutive errors
  lastErrorTime?: number; // Timestamp of the last error
  hasError?: boolean; // Flag to indicate if there was an error with the current utterance
}

// Current speech state
const speechState: SpeechState = {
  isPlaying: false,
  currentUtterance: null,
  lineNumberCallback: null,
  onFinishCallback: null,
  fallbackMode: false,
  fallbackReasonLog: [],
  consecutiveErrors: 0
};

/**
 * Determine if we should skip the Google TTS API and use fallback directly
 */
function shouldUseFallbackDirectly(): boolean {
  // Always use fallback if explicitly set
  if (speechState.fallbackMode) {
    console.log('Using browser TTS fallback (fallback mode is enabled)');
    return true;
  }
  
  // Use fallback if quota is exceeded
  if (speechState.quotaExceededUntil && speechState.quotaExceededUntil > Date.now()) {
    console.warn('Using browser TTS fallback (quota exceeded until:', new Date(speechState.quotaExceededUntil).toLocaleTimeString(), ')');
    return true;
  }
  
  // Use fallback if we've had too many consecutive errors
  if (speechState.consecutiveErrors >= 3) {
    console.warn('Using browser TTS fallback (too many consecutive errors:', speechState.consecutiveErrors, ')');
    return true;
  }
  
  // Use fallback if we've had recent errors (within last 30 seconds)
  const cooldownPeriod = 30 * 1000; // 30 seconds
  if (speechState.lastErrorTime && (Date.now() - speechState.lastErrorTime) < cooldownPeriod) {
    console.warn('Using browser TTS fallback (recent error, in cooldown period)');
    return true;
  }
  
  return false;
}

/**
 * Record a TTS API failure and update the fallback state
 */
function recordFailure(reason: string): void {
  // Update error counts and timing
  speechState.consecutiveErrors++;
  speechState.lastErrorTime = Date.now();
  speechState.fallbackReasonLog.push(`${new Date().toLocaleTimeString()}: ${reason}`);
  
  // Keep the log from growing too large
  if (speechState.fallbackReasonLog.length > 10) {
    speechState.fallbackReasonLog.shift();
  }
  
  // If we've had too many errors, switch to fallback mode automatically
  if (speechState.consecutiveErrors >= 5) {
    console.warn('Too many consecutive TTS API errors, switching to fallback mode permanently');
    speechState.fallbackMode = true;
  }
  
  console.log('TTS API error stats:', {
    consecutiveErrors: speechState.consecutiveErrors,
    reasonLog: speechState.fallbackReasonLog
  });
}

/**
 * Reset the error state after a successful API call
 */
function resetErrorState(): void {
  speechState.consecutiveErrors = 0;
  speechState.lastErrorTime = undefined;
  
  // Don't reset fallbackMode if it was explicitly set
  // This allows recovery in case the API becomes available again
  if (speechState.fallbackMode && speechState.consecutiveErrors === 0) {
    // Only try to reset fallback mode after a significant period of success
    const lastErrorAge = speechState.lastErrorTime ? Date.now() - speechState.lastErrorTime : Infinity;
    if (lastErrorAge > 5 * 60 * 1000) { // 5 minutes
      console.log('No errors for 5 minutes, resetting fallback mode');
      speechState.fallbackMode = false;
    }
  }
}

/**
 * Extract line numbers from text for highlighting during speech
 * This function looks for patterns like "Line 42:" or "[Line 42]" in the text
 */
function extractLineNumbers(text: string, codeToValidate?: string): { text: string; lineNumber: number }[] {
  const lineMarkers: { text: string; lineNumber: number }[] = [];
  console.log('Extracting line numbers from text:', text.substring(0, 100) + '...');
  
  // Match ALL patterns for line references with improved regex
  // Explicitly handle upper/lowercase 'Line' for more reliable detection
  // Handles formats like: [Line 42], Line 42, [Line42], Line42:, lines 10-15
  const lineRegex = /(?:\[\s*[Ll]ine\s*(\d+)(?:-\s*(\d+))?\s*\]|(?:^|\s)[Ll]ine\s*(\d+)(?:-\s*(\d+))?\s*(?:\]|:|\.|,|;|\s|$))/g;
  console.log('Extracting line references with pattern:', lineRegex);
  let match;
  
  // Get code lines for validation if available
  const codeLines = codeToValidate ? codeToValidate.split('\n') : null;
  console.log('Code to validate has', codeLines?.length || 0, 'lines');
  
  while ((match = lineRegex.exec(text)) !== null) {
    // Extract line number from any of the three capture groups
    const lineNumber = parseInt(match[1] || match[2] || match[3], 10);
    const fullMatch = match[0]; // The actual matched text (e.g., "[Line 5]")
    const startIndex = match.index;
    
    // Get more context around the line number mention (sentence or paragraph)
    // Find the nearest sentence boundaries
    let contextStart = Math.max(0, text.lastIndexOf('.', startIndex));
    if (contextStart === -1 || startIndex - contextStart > 100) {
      contextStart = Math.max(0, startIndex - 100);
    }
    
    let contextEnd = text.indexOf('.', startIndex + fullMatch.length);
    if (contextEnd === -1 || contextEnd - startIndex > 150) {
      contextEnd = Math.min(text.length, startIndex + fullMatch.length + 100);
    } else {
      contextEnd += 1; // Include the period
    }
    
    const contextText = text.substring(contextStart, contextEnd).trim();
    console.log(`Found line reference: ${fullMatch} (Line ${lineNumber}) with context: ${contextText.substring(0, 50)}...`);
    
    // Skip highlighting empty lines or comment-only lines if we have code to validate
    if (codeLines && lineNumber > 0 && lineNumber <= codeLines.length) {
      const codeLine = codeLines[lineNumber - 1]?.trim();
      // Skip if line is empty or just a comment
      if (!codeLine || codeLine.startsWith('//') || codeLine.startsWith('/*') || codeLine.startsWith('*')) {
        console.log(`Line ${lineNumber} is empty or comment-only, looking for next valid line`);
        // Find the next non-empty, non-comment line if possible
        let nextLineNumber = lineNumber;
        while (nextLineNumber < codeLines.length) {
          const nextLine = codeLines[nextLineNumber]?.trim();
          if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('/*') && !nextLine.startsWith('*')) {
            // Found a non-empty, non-comment line
            console.log(`Using next valid line ${nextLineNumber} instead of ${lineNumber}`);
            lineMarkers.push({
              text: contextText,
              lineNumber: nextLineNumber - 1 // Convert to 0-based index for editor
            });
            break;
          }
          nextLineNumber++;
        }
        continue; // Skip the original empty/comment line
      }
    }
    
    console.log(`Adding line marker for line ${lineNumber}`);
    lineMarkers.push({
      text: contextText,
      lineNumber: lineNumber - 1 // Convert to 0-based index for editor
    });
  }
  
  console.log('Extracted line markers:', lineMarkers.length);
  lineMarkers.forEach((marker, i) => {
    console.log(`Marker ${i+1}: Line ${marker.lineNumber + 1}, context: ${marker.text.substring(0, 30)}...`);
  });
  
  return lineMarkers;
}

/**
 * Convert plain text to SSML for better speech quality
 * @param text The text to convert to SSML
 * @param voiceOptions Voice options to use
 * @param removeLiteralLineMarkers Whether to remove line markers from spoken text
 */
function textToSSML(text: string, voiceOptions: VoiceOptions, removeLiteralLineMarkers = true): string {
  // First, escape XML special characters
  let escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  // Conditionally remove line markers if requested
  if (removeLiteralLineMarkers) {
    // Regex to find [Line X], [Line X-Y], Line X:, Line X. etc.
    // and remove them so they are not spoken literally.
    const lineMarkerRegex = /(?:\\[\\s*[Ll]ine\\s*(\\d+)(?:\\s*-\\s*\\d+)?\\s*\\]|(?:^|\\s)[Ll]ine\\s*(\\d+)(?:\\s*-\\s*\\d+)?\\s*(?:\\:|\\.|,|;|\\s|$))/g;
    escapedText = escapedText.replace(lineMarkerRegex, ' '); // Replace with a space to avoid words running together
    console.log('Removed literal line markers from text for SSML.');
  } else {
    console.log('Preserving literal line markers in text for SSML.');
  }
  
  // Start with basic SSML
  let ssml = escapedText;
  
    
    // Add general pauses and emphasis
    ssml = ssml
      // Add pauses after punctuation
      .replace(/\.\s/g, '.<break time="350ms"/> ')
      .replace(/;\s/g, ';<break time="300ms"/> ')
      .replace(/:\s/g, ':<break time="250ms"/> ')
      .replace(/\!\s/g, '!<break time="400ms"/> ')
      .replace(/\?\s/g, '?<break time="400ms"/> ')
      
      // Emphasize code keywords and important terms
      .replace(/\b(function|class|const|let|var|return|if|else|for|while|try|catch|import|from|export)\b/g, 
               (match: string) => `<emphasis level="moderate">${match}</emphasis>`)
      .replace(/\`([^\`]+)\`/g, 
               (_: string, code: string) => `<emphasis level="moderate">${code}</emphasis>`);

  // Wrap in <speak> tags with slightly slower rate for better comprehension
  return `<speak><prosody rate="0.95">${ssml}</prosody></speak>`;
}

/**
 * Synthesize speech using Google Cloud Text-to-Speech API
 * If the API endpoint is unavailable, this will return a special ID
 * that will trigger fallback to browser Web Speech API
 */
async function synthesizeSpeech(text: string, voiceOptions: VoiceOptions = defaultVoice, codeToValidate?: string): Promise<string> {
  console.log('Synthesizing speech with text length:', text.length);
  
  // Check if we have line markers in the text
  const hasLineMarkers = text.includes('[Line') || text.includes('Line ') || text.match(/\bline\s+\d+\b/i);
  console.log('Text has line markers:', hasLineMarkers);
  
  // If there are no line markers but we have code to validate, we should add them
  if (!hasLineMarkers && codeToValidate) {
    console.log('Adding line markers to text based on code content');
    // Split code into lines and generate references
    const codeLines = codeToValidate.split('\n');
    let enhancedText = '';
    
    // Add a summary introduction of the code
    enhancedText = `This code has ${codeLines.length} lines. Let's examine it line by line. <break time="1s"/>`;
    
    // Add references to each significant line
    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i].trim();
      if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
        enhancedText += `<break time="0.5s"/> [Line ${i + 1}]: ${line} <break time="0.8s"/>`;
      }
    }
    
    // Replace the text with our enhanced version
    text = enhancedText;
    console.log('Enhanced text with line markers:', text.substring(0, 200) + '...');
  }
  
  // Check if we have SSML text or need to convert it
  const isSSML = text.includes('<speak>') || text.includes('<break') || text.includes('<emphasis');
  const ssmlText = textToSSML(text, voiceOptions, false); // Pass false to keep line markers
  
  // Make sure the text is wrapped in <speak> tags
  const wrappedSSML = ssmlText.trim().startsWith('<speak>') ? ssmlText : `<speak>${ssmlText}</speak>`;
  
  console.log('Using TTS with voice:', voiceOptions.name);
  console.log('SSML length:', wrappedSSML.length);
  
  // Check if the text exceeds Google Cloud TTS API's 5000-byte limit
  const textBytes = new TextEncoder().encode(wrappedSSML).length;
  console.log('SSML size in bytes:', textBytes);
  
  // If text exceeds 5000 bytes, immediately use browser TTS instead
  if (textBytes > 5000) {
    console.warn('Text exceeds Google TTS 5000-byte limit, falling back to browser TTS');
    return `tts-fallback-${Date.now()}`;
  }
  
  // Prepare the request payload to match the API route format
  const payload = {
    text: wrappedSSML,
    isSSML: true,
    voiceOptions: {
      languageCode: voiceOptions.languageCode,
      name: voiceOptions.name,
      ssmlGender: voiceOptions.ssmlGender
    }
  };
  
  console.log('Calling Google Cloud TTS API with payload:', {
    textLength: wrappedSSML.length,
    voiceOptions: voiceOptions.name,
    endpoint: '/api/tts'
  });
  
  // Check if we should use fallback mode directly based on previous error patterns
  if (shouldUseFallbackDirectly()) {
    return `tts-fallback-${Date.now()}`;
  }

  try {
    // Get the base URL for API calls based on the current environment
    const baseURL = window.location.origin;
    const apiURL = `${baseURL}/api/tts`;
    
    console.log(`Calling TTS API at: ${apiURL} with payload:`, {
      textLength: payload.text.length, // payload is defined above
      voiceOptions: payload.voiceOptions.name
    });

    const response = await fetch(apiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload), // Use the payload defined earlier
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TTS API error (${response.status}):`, errorText);
      recordFailure(`API error (${response.status}): ${errorText.substring(0, 100)}`);
      return `tts-fallback-${Date.now()}`; // Return fallback ID
    }

    // Parse the response as JSON to get the audio data
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse TTS API response as JSON:', jsonError);
      recordFailure('Invalid JSON response from API');
      return `tts-fallback-${Date.now()}`; // Return fallback ID
    }

    if (responseData.success && responseData.audio && responseData.audio.length > 0) {
      console.log('TTS API response received successfully, audio data length:', responseData.audio.length);
      console.log('Audio data snippet (first 40 chars):', responseData.audio.substring(0, 40), '...');
      
      // Validate the base64 string
      if (responseData.audio.length % 4 !== 0) {
        console.warn('TTS API response: Base64 data length is not a multiple of 4, which may indicate corruption');
        // Try to fix padding if possible
        const paddingNeeded = 4 - (responseData.audio.length % 4);
        if (paddingNeeded < 4) {
          responseData.audio = responseData.audio + '='.repeat(paddingNeeded);
          console.log('Added padding to base64 data, new length:', responseData.audio.length);
        }
      }
      
      // Check if the base64 string contains valid characters
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (!base64Regex.test(responseData.audio)) {
        console.error('TTS API response: Base64 data contains invalid characters');
        recordFailure('Invalid base64 characters in audio data');
        return `tts-fallback-${Date.now()}`; // Return fallback ID
      }
      
      // Validate that the base64 can be decoded
      try {
        // Test decoding a small portion of the base64 string
        const testSample = responseData.audio.substring(0, 100);
        atob(testSample);
        console.log('Base64 validation successful');
      } catch (decodeError) {
        console.error('Failed to validate base64 data:', decodeError);
        recordFailure('Invalid base64 encoding');
        return `tts-fallback-${Date.now()}`; // Return fallback ID
      }
      
      // Success! Reset error counters
      resetErrorState();
      return responseData.audio; // Return the base64 audio content
    } else if (responseData.error) {
      console.error('TTS API returned an error:', responseData.error);
      recordFailure(`API returned error: ${responseData.error}`);
      return `tts-fallback-${Date.now()}`; // Return fallback ID
    } else {
      console.warn('TTS API response does not contain valid audio data');
      recordFailure('Invalid or missing audio data from API');
      return `tts-fallback-${Date.now()}`; // Return fallback ID
    }

  } catch (error) {
    console.error('Error in synthesizeSpeech during API call:', error);
    recordFailure(error instanceof Error ? error.message : 'Unknown error in synthesizeSpeech');
    return `tts-fallback-${Date.now()}`; // Return fallback ID
  }
}

/**
 * Play speech using either Google Cloud TTS audio data or Web Speech API with enhanced line highlighting
 */
function playSpeech(audioIdOrData: string | ArrayBuffer, text: string, lineMarkers: { text: string; lineNumber: number }[]): void {
  console.log('Playing speech with text length:', text.length);
  console.log('Line markers:', lineMarkers);
  
  try {
    if (typeof window === 'undefined') {
      console.error('Window is undefined, cannot play audio');
      return;
    }

    // Check if we have a base64 string or ArrayBuffer (from Google TTS) or a fallback ID
    const isGoogleTTS = typeof audioIdOrData !== 'string' || !audioIdOrData.startsWith('tts-fallback-');
    
    if (isGoogleTTS) {
      console.log('Using Google Cloud TTS audio data');
      // Handle Google Cloud TTS audio (base64 encoded MP3 or ArrayBuffer)
      let audio: HTMLAudioElement;
      
      if (typeof audioIdOrData === 'string') {
        // Handle base64 string with validation
        if (!audioIdOrData || audioIdOrData.length < 10) {
          console.error('Google TTS: Invalid or empty base64 audio data');
          useBrowserSpeechAPI(text, speechState, lineMarkers);
          return;
        }
        
        // Log the first and last few characters for debugging
        console.log('Base64 audio data preview:', 
          `Start: ${audioIdOrData.substring(0, 20)}...`, 
          `End: ...${audioIdOrData.substring(audioIdOrData.length - 20)}`);
        
        // Validate base64 format and content
        const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(audioIdOrData);
        if (!isValidBase64) {
          console.error('Google TTS: Invalid base64 characters detected in audio data');
          useBrowserSpeechAPI(text, speechState, lineMarkers);
          return;
        }
        
        if (audioIdOrData.length % 4 !== 0) {
          console.warn('Google TTS: Base64 data length is not a multiple of 4, which may indicate corruption');
          // Try to fix padding if possible
          const paddingNeeded = 4 - (audioIdOrData.length % 4);
          if (paddingNeeded < 4) {
            audioIdOrData = audioIdOrData + '='.repeat(paddingNeeded);
            console.log('Google TTS: Added padding to base64 data');
          }
        }
        
        // Use Blob and URL.createObjectURL instead of data URL for better reliability
        try {
          // Wrap in try-catch to handle potential decoding errors
          let byteCharacters;
          try {
            byteCharacters = atob(audioIdOrData);
          } catch (decodeError) {
            console.error('Google TTS: Failed to decode base64 data:', decodeError);
            useBrowserSpeechAPI(text, speechState, lineMarkers);
            return;
          }
          
          // Validate decoded data size
          if (byteCharacters.length < 100) {
            console.error('Google TTS: Decoded audio data is suspiciously small, might be invalid');
            useBrowserSpeechAPI(text, speechState, lineMarkers);
            return;
          }
          
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          
          // Use audio/mpeg MIME type instead of audio/mp3 for better browser compatibility
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          audio = new Audio(url);
          
          // Add a load event to ensure the audio is properly loaded
          audio.addEventListener('loadeddata', () => {
            console.log('Google TTS: Audio data loaded successfully');
          });
          
          // Add error event listener to catch and handle audio loading errors
          audio.addEventListener('error', (e) => {
            const errorCode = (audio as any).error?.code || 'unknown';
            console.error(`Google TTS: Audio loading error (Code ${errorCode})`, e);
            // Clean up the URL to prevent memory leaks
            URL.revokeObjectURL(url);
            // Fall back to browser TTS
            useBrowserSpeechAPI(text, speechState, lineMarkers);
          });
        } catch (error) {
          console.error('Google TTS: Error processing base64 audio data:', error);
          useBrowserSpeechAPI(text, speechState, lineMarkers);
          return;
        }
      } else {
        // Handle ArrayBuffer
        const blob = new Blob([audioIdOrData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        audio = new Audio(url);
        // We'll set up the onended event handler later and include URL cleanup
      }
      const timers: NodeJS.Timeout[] = [];
      
      // Setup audio events
      audio.onplay = () => {
        speechState.isPlaying = true;
        console.log('Google TTS: Audio playback started');
      };
      
      // Calculate estimated duration of audio more precisely
      // Average English speaking rate is about 150 words per minute or 2.5 words per second
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = wordCount / 2.5; // in seconds (2.5 words per second)
      console.log(`Estimated speech duration: ${estimatedDuration.toFixed(1)} seconds for ${wordCount} words`);
      
      // Setup line highlighting timers with progressive timing
      lineMarkers.forEach((marker, index) => {
        // Find where this marker appears in the text
        const markerPosition = text.indexOf(marker.text);
        if (markerPosition === -1) {
          console.warn(`Could not find marker text in speech: ${marker.text.substring(0, 30)}...`);
          return;
        }
        
        // Calculate what percentage through the text this marker appears
        const position = markerPosition / text.length;
        
        // Calculate time based on position in text and word count before this position
        const textBefore = text.substring(0, markerPosition);
        const wordsBefore = textBefore.split(/\s+/).length;
        const highlightTime = Math.floor((wordsBefore / wordCount) * estimatedDuration * 1000);
        
        console.log(`Line ${marker.lineNumber + 1} will highlight at ${highlightTime}ms (${(position * 100).toFixed(1)}% through speech)`);
        
        const timer = setTimeout(() => {
          console.log(`Highlighting line ${marker.lineNumber + 1} at time ${highlightTime}ms`);
          if (speechState.lineNumberCallback) {
            speechState.lineNumberCallback(marker.lineNumber);
          }
        }, highlightTime);
        
        timers.push(timer);
      });
      
      // Handle audio ending
      audio.onended = () => {
        console.log('Google TTS: Audio playback ended');
        speechState.isPlaying = false;
        // Clear all timers
        timers.forEach(timer => clearTimeout(timer));
        
        // Clean up URL if we created one for ArrayBuffer or base64
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        
        if (speechState.onFinishCallback) speechState.onFinishCallback();
      };
      
      // Add error handler for playback errors
      audio.onerror = (e) => {
        const errorCode = (audio as any).error?.code || 'unknown';
        console.error(`Google TTS: Audio playback error (Code ${errorCode})`, e);
        speechState.isPlaying = false;
        
        // Clear all timers
        timers.forEach(timer => clearTimeout(timer));
        
        // Clean up URL
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        
        // Fall back to browser TTS
        useBrowserSpeechAPI(text, speechState, lineMarkers);
      };
      
      // Handle audio errors
      audio.onerror = (event: Event | string) => {
        if (event instanceof Event) {
          const audioElement = event.target as HTMLAudioElement;
          if (audioElement.error) {
            console.error('Google TTS: Audio playback error. Code:', audioElement.error.code, 'Message:', audioElement.error.message, 'Details:', event);
          } else {
            console.error('Google TTS: Audio playback error (unknown type on Event target):', event);
          }
        } else {
          console.error('Google TTS: Audio playback error (event is a string):', event);
        }
        console.warn('Falling back to Web Speech API after Google TTS failure');
        speechState.isPlaying = false;
        // Clear all timers
        timers.forEach(timer => clearTimeout(timer));
        
        // Fall back to Web Speech API
        useBrowserSpeechAPI(text, speechState, lineMarkers);
      };
      
      // Store audio element for stopping later if needed
      speechState.currentUtterance = audio as any;
      
      // Start playback
      audio.play().catch(error => {
        console.error('Error starting Google TTS audio playback:', error);
        console.warn('Falling back to Web Speech API');
        // Clear all timers
        timers.forEach(timer => clearTimeout(timer));
        
        // Fall back to Web Speech API
        useBrowserSpeechAPI(text, speechState, lineMarkers);
      });

    }
  } catch (error) {
    console.error('Error in playSpeech:', error);
    if (speechState.onFinishCallback) {
      speechState.onFinishCallback();
    }
  }
}

/**
 * Use browser's Web Speech API as a fallback TTS
 */
// First implementation of useBrowserSpeechAPI removed to fix duplicate declaration error

// The non-async version of useBrowserSpeechAPI has been removed to fix syntax errors with await keywords.
// The async version above is now used for all browser speech API fallback functionality.

/**
 * Use browser's Web Speech API as a fallback TTS
 */
async function useBrowserSpeechAPI(
  text: string, 
  speechState: SpeechState,
  lineMarkers: { text: string; lineNumber: number }[] = []
): Promise<void> {
  // Start independent line highlighting BEFORE we even attempt speech
  // This ensures highlighting happens regardless of speech success
  const timers: NodeJS.Timeout[] = [];
  
  // Calculate and schedule all line highlights FIRST
  if (lineMarkers.length > 0 && speechState.lineNumberCallback) {
    console.log('Setting up fail-safe highlighting with', lineMarkers.length, 'markers');
    
    // Calculate timing for each marker - distribute evenly across 10 seconds
    const totalDuration = 10000; // 10 seconds for the entire highlighting sequence
    
    lineMarkers.forEach((marker, index) => {
      const delayMs = (totalDuration / lineMarkers.length) * index;
      
      // Schedule highlighting independently of speech
      const timer = setTimeout(() => {
        console.log(`Fail-safe highlight for line ${marker.lineNumber + 1} at ${delayMs}ms`);
        if (speechState.lineNumberCallback) {
          try {
            speechState.lineNumberCallback(marker.lineNumber);
          } catch (err) {
            console.error('Error in line highlighting callback:', err);
          }
        }
      }, delayMs);
      
      timers.push(timer);
    });
  } else {
    console.warn('No line markers for fail-safe highlighting');
  }
  
  // Ensure finish callback is called even if everything fails
  const safetyTimer = setTimeout(() => {
    if (speechState.onFinishCallback) {
      console.log('Safety timeout - ensuring completion callback is called');
      speechState.onFinishCallback();
    }
  }, 15000); // 15 seconds max for the entire operation
  
  timers.push(safetyTimer);
  try {
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported in this browser');
      if (speechState.onFinishCallback) speechState.onFinishCallback();
      return;
    }

    // Strip SSML tags for browser TTS with improved handling
    const cleanText = text
      .replace(/<break[^>]*>/g, ', ')
      .replace(/<emphasis[^>]*>/g, '')
      .replace(/<\/emphasis>/g, '')
      .replace(/<voice[^>]*>/g, '')
      .replace(/<\/voice>/g, '')
      .replace(/<prosody[^>]*>/g, '')
      .replace(/<\/prosody>/g, '')
      .replace(/<speak[^>]*>/g, '')
      .replace(/<\/speak>/g, '')
      .replace(/<say-as[^>]*>/g, '')
      .replace(/<\/say-as>/g, '')
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '. ')
      .replace(/<s>/g, '')
      .replace(/<\/s>/g, '. ')
      .replace(/<[^>]*>/g, '') // catch any remaining tags
      .replace(/\[Line\s*(\d+)\]/g, 'Line $1') // Convert [Line X] to Line X for clearer speech
      .replace(/\[Lines\s*(\d+)\s*-\s*(\d+)\]/g, 'Lines $1 to $2'); // Convert [Lines X-Y] format
      
    console.log('Clean text for browser speech:', cleanText.substring(0, 100) + '...');
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower for code explanation
    
    // Try to get a good voice - preferably a natural-sounding one
    const voices = window.speechSynthesis.getVoices();
    
    // Look for premium voices first
    const premiumVoices = voices.filter(voice => 
      voice.name.toLowerCase().includes('premium') || 
      voice.name.toLowerCase().includes('enhanced') || 
      voice.name.toLowerCase().includes('neural')
    );
    
    if (premiumVoices.length > 0) {
      utterance.voice = premiumVoices[0];
      console.log('Using premium voice:', premiumVoices[0].name);
    } else {
      // Otherwise, use any English voice
      const englishVoices = voices.filter(voice => voice.lang.includes('en-'));
      if (englishVoices.length > 0) {
        utterance.voice = englishVoices[0];
        console.log('Using standard voice:', englishVoices[0].name);
      }
    }

    // Set up event handlers for Web Speech API
    utterance.onstart = () => {
      speechState.isPlaying = true;
      console.log('Web Speech API: Speech started');
    };
    
    // Create direct line marker references from the text if none were found
    if (lineMarkers.length === 0) {
      console.log('No line markers provided, extracting from text directly');
      // This regex matches patterns like "Line 42" or "[Line 42]" with any capitalization and flexible formatting
      // Improved regex to be more flexible with various formats of line references
      const lineRegex = /(?:\[\s*[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*\]|(?:^|\s)[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*(?:\:|\.|,|;|\s|$))/g;
      console.log('Google TTS Browser Fallback: Looking for line markers with pattern:', lineRegex);
      let match;
      
      // Store original text for debugging
      const textForDebug = cleanText.substring(0, 200);
      console.log('First 200 chars of text being searched for line markers:', textForDebug);
      
      while ((match = lineRegex.exec(cleanText)) !== null) {
        const lineNumber = parseInt(match[1] || match[2], 10);
        if (!isNaN(lineNumber)) {
          lineMarkers.push({
            text: match[0],
            lineNumber: lineNumber - 1 // Convert to 0-based index
          });
          console.log(`Extracted line reference: ${match[0]} → line ${lineNumber}`);
        }
      }
      
      // If we still don't have markers, try a more lenient regex
      if (lineMarkers.length === 0) {
        console.log('Trying more lenient regex for line markers');
        const lenientRegex = /[Ll]ine\s*(\d+)/g;
        while ((match = lenientRegex.exec(cleanText)) !== null) {
          const lineNumber = parseInt(match[1], 10);
          if (!isNaN(lineNumber)) {
            lineMarkers.push({
              text: match[0],
              lineNumber: lineNumber - 1 // Convert to 0-based index
            });
            console.log(`Extracted line reference with lenient regex: ${match[0]} → line ${lineNumber}`);
          }
        }
      }
    }
    
    // Adjust for empty line markers that might have been stripped by SSML cleaning
    if (lineMarkers.length === 0) {
      console.warn('No line markers found in text after SSML stripping, creating synthetic markers');
      
      // Split text into sentences for synthetic line markers
      const sentences = cleanText.split(/[.!?]\s+/);
      let lineCount = 0;
      
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].trim().length > 10) { // Only consider substantial sentences
          lineMarkers.push({
            text: sentences[i],
            lineNumber: lineCount++ % 10 // Cycle through first 10 lines
          });
          if (lineMarkers.length >= 10) break; // Limit to 10 synthetic markers
        }
      }
    }
    
    console.log(`Using ${lineMarkers.length} line markers for highlighting`);
    
    // Calculate a more sophisticated adaptive timing for highlights
    const words = cleanText.split(/\s+/);
    const wordCount = words.length;
    
    // Define variables that affect speech pacing
    const baseWordsPerSecond = 2.5;  // Average reading speed
    const speechRate = utterance.rate || 1;
    const wordsPerSecond = baseWordsPerSecond / speechRate;
    
    // Estimate total duration accounting for pauses (commas, periods, etc.)
    // Count punctuation that typically causes pauses
    const pauseCount = (cleanText.match(/[,.;:?!]/g) || []).length;
    const pauseDuration = 250; // ms per pause
    
    const baseDuration = (wordCount / wordsPerSecond) * 1000; // ms
    const pauseTime = pauseCount * pauseDuration;
    const totalDurationMs = baseDuration + pauseTime;
    
    console.log(`Browser TTS: Estimated duration: ${(totalDurationMs/1000).toFixed(1)} seconds ` +
                `(${wordCount} words at ${wordsPerSecond.toFixed(1)} words/sec, ${pauseCount} pauses)`);
    
    const timers: NodeJS.Timeout[] = [];
    
    // Analyze text structure for better timing
    const calculateAdaptiveHighlightTiming = () => {
      // Function to search for approximate positions of line markers in text
      const findApproximatePositions = () => {
        return lineMarkers.map((marker, markerIndex) => {
          // For each marker, try to find its rough position in the text
          const markerPattern = marker.text.substring(0, Math.min(15, marker.text.length));
          const patternIndex = cleanText.indexOf(markerPattern);
          
          // If we found a position, use it; otherwise estimate based on marker index
          if (patternIndex > 0) {
            const relativePosition = patternIndex / cleanText.length;
            return {
              marker,
              position: relativePosition,
              textAroundMarker: cleanText.substring(
                Math.max(0, patternIndex - 10), 
                Math.min(cleanText.length, patternIndex + 30)
              )
            };
          } else {
            // Fallback - distribute markers proportionally
            const position = lineMarkers.length <= 1 ? 
              0.2 : // Single marker - place near beginning
              0.1 + (0.8 * (markerIndex / (lineMarkers.length - 1))); // Multiple markers - distribute
            return {
              marker,
              position,
              textAroundMarker: "[position estimated]"
            };
          }
        });
      };
      
      const markerPositions = findApproximatePositions();
      
      // Calculate timing for each marker
      return markerPositions.map((item, index) => {
        // Basic timing based on position in text
        let basicTiming = item.position * totalDurationMs;
        
        // Significantly reduce progressive delay for more responsive highlighting
        // Use much smaller initial delay that decreases quickly
        const initialDelay = 500; // ms - much shorter initial delay
        const progressiveFactor = Math.max(0, 1 - (index / lineMarkers.length) * 1.5); // Steeper reduction
        const progressiveDelay = initialDelay * progressiveFactor;
        
        // Much smaller spacing between highlights
        const minSpaceBetweenHighlights = 400; // ms minimum between highlights - reduced
        const spacingAdjustment = index * (minSpaceBetweenHighlights * 0.5) * (1 - item.position);
        
        // Apply content-based adjustments
        // If marker appears after a sentence break, add a small delay
        const textBeforeMarker = item.textAroundMarker.substring(0, 10);
        const sentenceBreakDelay = /[.!?]\s*$/.test(textBeforeMarker) ? 500 : 0;
        
        // Calculate final timing with all factors
        const timing = basicTiming + progressiveDelay + spacingAdjustment + sentenceBreakDelay;
        
        console.log(`Marker #${index} (line ${item.marker.lineNumber + 1}): ` + 
                    `scheduled at ${timing.toFixed(0)}ms, ` +
                    `position: ${(item.position * 100).toFixed(1)}%, ` +
                    `text near: "${item.textAroundMarker.substring(0, 20).replace(/\n/g, ' ')}..."`);
                    
        return {
          marker: item.marker,
          timing: timing
        };
      });
    };
    
    // Calculate all highlight timings
    const scheduledHighlights = calculateAdaptiveHighlightTiming();
    
    // Set up the timers for each highlight
    scheduledHighlights.forEach(({ marker, timing }) => {
      const timer = setTimeout(() => {
        console.log(`Highlighting line ${marker.lineNumber + 1} at ${timing.toFixed(0)}ms`);
        if (speechState.lineNumberCallback) {
          speechState.lineNumberCallback(marker.lineNumber);
        }
      }, timing);
      
      timers.push(timer);
    });
    
    utterance.onend = () => {
      speechState.isPlaying = false;
      console.log('Web Speech API: Speech ended');
      // Clear all timers
      timers.forEach(timer => clearTimeout(timer));
      if (speechState.onFinishCallback) speechState.onFinishCallback();
    };
    
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      // Use simplified error logging to avoid issues with circular references
      console.warn('Web Speech API error occurred - continuing with highlighting only');
      try {
        // Log only basic error information that exists on SpeechSynthesisErrorEvent
        console.warn('Error type:', event.error || 'unknown');
        console.warn('Error time:', new Date().toISOString());
      } catch (logError) {
        // Even logging the error failed - just continue silently
        console.warn('Error while logging speech error');
      }
      
      // Keep track of error in state
      speechState.hasError = true;
      
      // Don't immediately stop everything on error
      // Some errors are non-fatal and speech may continue
      console.log('Continuing with highlighting despite Web Speech API error');
      
      // IMPORTANT: Do nothing with the speech synthesis object here
      // Attempting to access it further might cause additional errors
      // Just let highlighting continue
      
      // DO NOT try to cancel or manipulate the speech synthesis here
      // Instead, just rely on our fail-safe highlighting timers
      
      // Safety measure: ensure callback is eventually called
      setTimeout(() => {
        if (speechState.onFinishCallback) {
          console.log('Ensuring finish callback is called after speech error');
          speechState.onFinishCallback();
        }
      }, 12000); // Reasonable timeout for the entire speech operation
      
      // Let the highlighting continue - do not stop anything
      // The pre-scheduled timers will continue to highlight lines
    };
    
    // Store the utterance reference and start speaking
    speechState.currentUtterance = utterance as any; // Type casting to match our interface
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Error in useBrowserSpeechAPI:', error);
    if (speechState.onFinishCallback) {
      speechState.onFinishCallback();
    }
  }
}

/**
 * Second implementation of speak function removed to fix duplicate declaration error.
 * The async implementation at line ~420 is now used for all TTS functionality.
 */

/**
 * Stop the current speech
*/
function stop(): void {
  if (speechState.currentUtterance) {
    // Check if it's an HTMLAudioElement (has pause method) or SpeechSynthesisUtterance
    if (typeof speechState.currentUtterance.pause === 'function') {
      // For HTMLAudioElement from Google Cloud TTS
      speechState.currentUtterance.pause();
      speechState.currentUtterance.currentTime = 0;
    } else if (window.speechSynthesis) {
      // For SpeechSynthesisUtterance from browser's Web Speech API
      window.speechSynthesis.cancel();
    }
    speechState.currentUtterance = null;
  }

  speechState.isPlaying = false;
}

/**
 * Check if speech is currently playing
 */
function isSpeaking(): boolean {
  return speechState.isPlaying;
}

/**
 * Initialize the TTS service
 * Just checks if Audio API is available in the browser
 */
function initVoices(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('Audio' in window)) {
      console.error('Audio playback not supported in this browser');
      resolve(false);
      return;
    }
    
    // Always resolve true since we're using server-side TTS
    resolve(true);
  });
}

/**
 * Get available voices for Google Cloud TTS
 * This is a hardcoded list of commonly available voices
 */
function getAvailableVoices(): VoiceOptions[] {
  // Hard-coded list of commonly available Google Cloud TTS voices
  // In a production app, you might want to fetch this from the API
  return [
    {
      languageCode: 'en-US',
      name: 'en-US-Neural2-A',
      ssmlGender: 'MALE',
      type: 'neural2'
    },
    {
      languageCode: 'en-US',
      name: 'en-US-Neural2-C',
      ssmlGender: 'FEMALE',
      type: 'neural2'
    },
    {
      languageCode: 'en-US',
      name: 'en-US-Neural2-D',
      ssmlGender: 'MALE',
      type: 'neural2'
    },
    {
      languageCode: 'en-US',
      name: 'en-US-Neural2-F',
      ssmlGender: 'FEMALE',
      type: 'neural2'
    },
    {
      languageCode: 'en-US',
      name: 'en-US-Wavenet-A',
      ssmlGender: 'MALE',
      type: 'wavenet'
    },
    {
      languageCode: 'en-US',
      name: 'en-US-Wavenet-C',
      ssmlGender: 'FEMALE',
      type: 'wavenet'
    },
    {
      languageCode: 'en-GB',
      name: 'en-GB-Neural2-B',
      ssmlGender: 'MALE',
      type: 'neural2'
    },
    {
      languageCode: 'en-GB',
      name: 'en-GB-Neural2-A',
      ssmlGender: 'FEMALE',
      type: 'neural2'
    }
  ];
}

/**
 * Set voice options
 */
function setVoice(options: Partial<VoiceOptions>): void {
  console.log('Setting voice with options:', JSON.stringify(options, null, 2));
  Object.assign(defaultVoice, options);
  console.log('Voice set to:', JSON.stringify(defaultVoice, null, 2));
}

/**
 * Extract line references from text for fail-safe highlighting
 * This can be used externally to set up independent highlighting
 * when speech synthesis might fail
 */
export function extractLineReferences(text: string, codeToValidate?: string): { text: string; lineNumber: number }[] {
  // First clean any SSML tags from the text
  const cleanText = text
    .replace(/<break[^>]*>/g, ', ')
    .replace(/<emphasis[^>]*>/g, '')
    .replace(/<\/emphasis>/g, '')
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '')
    .replace(/<s>/g, '')
    .replace(/<\/s>/g, '')
    .replace(/<phoneme[^>]*>/g, '')
    .replace(/<\/phoneme>/g, '')
    .replace(/<sub[^>]*>/g, '')
    .replace(/<\/sub>/g, '')
    .replace(/<say-as[^>]*>/g, '')
    .replace(/<\/say-as>/g, '');
  
  // Look for line references in the text
  const lineMarkers: { text: string; lineNumber: number }[] = [];
  
  try {
    // First pass: Extract line numbers using regex
    const lineRegex = /(?:\[\s*[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*\]|(?:^|\s)[Ll]ine\s*(\d+)(?:\s*-\s*\d+)?\s*(?:\:|\.|,|;|\s|$))/g;
    console.log('Looking for line markers with pattern:', lineRegex);
    let match;
    
    // Store original text for debugging
    const textForDebug = cleanText.substring(0, 200);
    console.log('First 200 chars of text being searched for line markers:', textForDebug);
    
    while ((match = lineRegex.exec(cleanText)) !== null) {
      const lineNum = parseInt(match[1] || match[2], 10);
      if (!isNaN(lineNum)) {
        // Line numbers in text are 1-based, but we need 0-based for the editor
        const zeroBasedLineNum = lineNum - 1;
        lineMarkers.push({
          text: match[0],
          lineNumber: zeroBasedLineNum
        });
      }
    }
    
    console.log('Extracted line markers:', lineMarkers);
    
    // If no markers were found, try a more lenient regex as fallback
    if (lineMarkers.length === 0) {
      const fallbackRegex = /[Ll]ine\s*(\d+)/g;
      console.log('No line markers found, trying fallback regex:', fallbackRegex);
      
      while ((match = fallbackRegex.exec(cleanText)) !== null) {
        const lineNum = parseInt(match[1], 10);
        if (!isNaN(lineNum)) {
          const zeroBasedLineNum = lineNum - 1;
          lineMarkers.push({
            text: match[0],
            lineNumber: zeroBasedLineNum
          });
        }
      }
      
      console.log('Fallback regex extracted line markers:', lineMarkers);
    }
    
    // If code validation is provided, ensure the line numbers are valid
    if (codeToValidate && lineMarkers.length > 0) {
      const codeLines = codeToValidate.split('\n');
      console.log(`Validating line markers against ${codeLines.length} lines of code`);
      
      // Filter and fix line markers
      const validatedMarkers = lineMarkers.map(marker => {
        let lineNumber = marker.lineNumber;
        
        // Check if the line number is valid
        if (lineNumber < 0) {
          lineNumber = 0; // First line
        } else if (lineNumber >= codeLines.length) {
          lineNumber = codeLines.length - 1; // Last line
        }
        
        // Skip empty lines or comment-only lines
        let finalLineNumber = lineNumber;
        const maxLine = codeLines.length - 1;
        
        // Try to find a meaningful line (not empty, not just a comment)
        for (let i = 0; i < 5; i++) { // Look ahead up to 5 lines
          const checkLine = lineNumber + i;
          if (checkLine > maxLine) break;
          
          const line = codeLines[checkLine].trim();
          if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('#')) {
            finalLineNumber = checkLine;
            break;
          }
        }
        
        return {
          text: marker.text,
          lineNumber: finalLineNumber
        };
      });
      
      return validatedMarkers;
    }
    
    // If we have at least one marker, return them
    if (lineMarkers.length > 0) {
      return lineMarkers;
    }
    
    // If we still have no markers and code is provided, create synthetic markers
    if (codeToValidate) {
      const codeLines = codeToValidate.split('\n');
      console.log('No line markers found. Creating synthetic markers for code of length:', codeLines.length);
      
      // Create synthetic markers at reasonable intervals
      const numMarkers = Math.min(8, Math.max(3, Math.floor(codeLines.length / 15)));
      const interval = Math.floor(codeLines.length / (numMarkers + 1));
      
      const syntheticMarkers: { text: string; lineNumber: number }[] = [];
      
      for (let i = 1; i <= numMarkers; i++) {
        const lineNumber = i * interval;
        if (lineNumber < codeLines.length) {
          syntheticMarkers.push({
            text: `Synthetic marker ${i}`,
            lineNumber: lineNumber
          });
        }
      }
      
      console.log('Created synthetic markers:', syntheticMarkers);
      return syntheticMarkers;
    }
  } catch (error) {
    console.error('Error extracting line references:', error);
  }
  
  // Return empty array if all else fails
  return [];
}

async function speak(
  text: string,
  onLineNumber?: (lineNumber: number) => void,
  onFinish?: () => void,
  voiceOptionsParam?: VoiceOptions,
  codeContent?: string
): Promise<boolean> {
  stop(); // Stop any currently playing speech

  // Initialize speech state for the new session
  speechState.isPlaying = false;
  speechState.currentUtterance = null;
  speechState.lineNumberCallback = onLineNumber || null;
  speechState.onFinishCallback = onFinish || null;
  speechState.hasError = false; // Reset error state

  if (!text || text.trim() === '') {
    console.warn('TTS Service: Empty text provided to speak.');
    if (speechState.onFinishCallback) speechState.onFinishCallback();
    return false;
  }

  console.log('TTS Service: speak called with text length:', text.length);

  // Extract line markers using the existing utility function
  const lineMarkers = extractLineReferences(text, codeContent);
  console.log('TTS Service: Extracted line markers:', lineMarkers.length);

  const voiceOptionsToUse = voiceOptionsParam || defaultVoice;

  try {
    // Check if we should immediately use the fallback (e.g., due to repeated errors)
    if (shouldUseFallbackDirectly()) {
      console.log('TTS Service: Using Web Speech API directly due to fallback conditions.');
      // Pass the original text; useBrowserSpeechAPI will handle its own SSML/marker cleaning.
      await useBrowserSpeechAPI(text, speechState, lineMarkers);
      return true;
    }

    // Attempt to get audio data (base64 string) or a fallback ID from Google TTS via our backend
    // synthesizeSpeech handles SSML creation and API call.
    const audioDataOrFallbackId = await synthesizeSpeech(text, voiceOptionsToUse);

    if (typeof audioDataOrFallbackId === 'string' && audioDataOrFallbackId.startsWith('tts-fallback-')) {
      console.log('TTS Service: Fallback ID received from synthesizeSpeech. Using Web Speech API.');
      await useBrowserSpeechAPI(text, speechState, lineMarkers);
    } else if (typeof audioDataOrFallbackId === 'string') {
      // This is the base64 audio data from Google TTS
      console.log('TTS Service: Playing Google TTS audio.');
      // playSpeech expects the original text (with markers) for timing, and the base64 audio data.
      playSpeech(audioDataOrFallbackId, text, lineMarkers);
    } else {
      // This case should ideally not be reached if synthesizeSpeech adheres to Promise<string>
      console.error('TTS Service: Unexpected data type from synthesizeSpeech. Falling back.');
      await useBrowserSpeechAPI(text, speechState, lineMarkers);
    }
    
    resetErrorState(); // Reset error counters on successful initiation path
    return true;

  } catch (error) {
    console.error('TTS Service: Error in main speak function orchestration:', error);
    recordFailure(error instanceof Error ? error.message : 'Unknown error in speak orchestration');
    
    // Attempt a final fallback in case of unexpected errors in the orchestration logic
    try {
      console.warn('TTS Service: Attempting Web Speech API fallback after error in speak orchestration.');
      await useBrowserSpeechAPI(text, speechState, lineMarkers);
    } catch (fallbackError) {
      console.error('TTS Service: Error during final fallback attempt:', fallbackError);
      // Ensure onFinish is called even if the final fallback fails
      if (speechState.onFinishCallback) {
        speechState.onFinishCallback();
      }
    }
    return false; // Indicate that the speak initiation failed
  }
}

// Export the service
const googleTTSService = {
  speak: speak,
  stop: stop,
  isSpeaking: isSpeaking,
  initVoices: initVoices,
  getAvailableVoices: getAvailableVoices,
  setVoice: setVoice,
  extractLineReferences: extractLineReferences
};

export default googleTTSService;
