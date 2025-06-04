// Gemini API service for Glyssa
// This service handles communication with Google's Gemini API

// Configuration
// Using the latest v1 API instead of v1beta
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';

// Get API key from environment variable
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Log API key details for debugging (safely - never log the full key)
console.log('Gemini API Key:', {
  exists: Boolean(GEMINI_API_KEY),
  length: GEMINI_API_KEY.length,
  prefix: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 4) + '...' : 'not set'
});

// Get the API URL with the key in the query parameter
function getApiUrl(): string {
  return `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Makes a Gemini API call with retry mechanism for handling overloaded models
 * @param requestBody The request body to send to the Gemini API
 * @param retryCount Current retry attempt (internal use)
 * @returns The API response
 */
async function callGeminiWithRetry(requestBody: any, retryCount: number = 0): Promise<Response> {
  try {
    console.log('Making API call to Gemini...');
    
    // Use the API key in the URL instead of as a header
    const apiUrl = getApiUrl();
    console.log('Calling Gemini API with URL:', apiUrl.replace(GEMINI_API_KEY, '[REDACTED]'));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    // If we get a 503 error and haven't exceeded max retries, try again
    if (!response.ok && response.status === 503 && retryCount < MAX_RETRIES) {
      console.log(`Gemini API returned 503, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      
      // Retry the API call
      return callGeminiWithRetry(requestBody, retryCount + 1);
    }
    
    return response;
  } catch (error) {
    console.error('Error making Gemini API call:', error);
    
    // If we haven't exceeded max retries, try again
    if (retryCount < MAX_RETRIES) {
      console.log(`Network error with Gemini API, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      
      // Retry the API call
      return callGeminiWithRetry(requestBody, retryCount + 1);
    }
    
    // Create a mock response to indicate the API call failed
    const mockResponse = new Response(
      JSON.stringify({ error: { message: 'API call failed after retries' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    
    return mockResponse;
  }
}

export interface GeminiResponse {
  text: string;
  annotations?: {
    startLine: number;
    endLine: number;
    explanation: string;
  }[];
}

export interface CodeExplanationRequest {
  code: string;
  language?: string;
  request?: string;
}

/**
 * Parse Gemini API response
 */
function parseResponse(data: any): GeminiResponse {
  try {
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      return { text: "Invalid response from AI service." };
    }
    
    const candidate = data.candidates[0];
    const part = candidate.content.parts[0];
    
    return {
      text: part.text,
      annotations: extractAnnotations(part.text)
    };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return { text: "Error processing AI response." };
  }
}

/**
 * Extract line annotations from the AI response
 */
function extractAnnotations(text: string): { startLine: number; endLine: number; explanation: string; }[] {
  const annotations: { startLine: number; endLine: number; explanation: string; }[] = [];
  
  // Regular expression to match line references like [Line 5] or [Lines 10-15]
  const lineRegex = /\[Line(?:s)?\s+(\d+)(?:\s*-\s*(\d+))?\]/gi;
  
  let match;
  let lastEndIndex = 0;
  
  while ((match = lineRegex.exec(text)) !== null) {
    const startLine = parseInt(match[1], 10);
    const endLine = match[2] ? parseInt(match[2], 10) : startLine;
    
    // Find the end of this explanation (next line reference or end of text)
    const nextMatch = lineRegex.exec(text);
    const endIndex = nextMatch ? nextMatch.index : text.length;
    
    // Extract the explanation text for this line reference
    const explanationText = text.substring(match.index + match[0].length, endIndex).trim();
    
    annotations.push({
      startLine,
      endLine,
      explanation: explanationText
    });
    
    // Reset lastEndIndex and the regex's lastIndex
    lastEndIndex = endIndex;
    lineRegex.lastIndex = endIndex;
  }
  
  return annotations;
}

/**
 * Analyze code to extract key information
 */
function analyzeCode(code: string): any {
  // Split the code into lines
  const lines = code.split('\n');
  
  // Detect language
  let language = 'javascript';
  if (code.includes('func ') && code.includes('package ')) {
    language = 'go';
  } else if (code.includes('def ') && code.includes('self')) {
    language = 'python';
  } else if (code.includes('#include') && (code.includes('<iostream>') || code.includes('<stdio.h>'))) {
    language = 'c++';
  } else if (code.includes('public class') || code.includes('private class')) {
    language = 'java';
  } else if (code.includes('use strict') || code.includes('function')) {
    language = 'javascript';
  } else if (code.includes('<?php')) {
    language = 'php';
  }
  
  // Count lines
  const lineCount = lines.length;
  
  // Extract functions (simple heuristic)
  const functions: string[] = [];
  const functionRegex = /function\s+(\w+)/g;
  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    functions.push(match[1]);
  }
  
  // Check for classes
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)/g;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  
  // Check for imports
  const imports: string[] = [];
  const importRegex = /import\s+.*?['"](.*?)['"]/g;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  
  // Identify key features
  const keyFeatures: string[] = [];
  
  if (code.includes('async') || code.includes('await')) {
    keyFeatures.push('asynchronous programming');
  }
  
  if (code.includes('try') && code.includes('catch')) {
    keyFeatures.push('error handling');
  }
  
  if (code.includes('fetch(') || code.includes('axios.')) {
    keyFeatures.push('API calls');
  }
  
  if (code.includes('useState') || code.includes('useEffect')) {
    keyFeatures.push('React hooks');
  }
  
  if (code.includes('map(') || code.includes('filter(') || code.includes('reduce(')) {
    keyFeatures.push('array methods');
  }
  
  if (code.includes('test(') || code.includes('describe(') || code.includes('it(')) {
    keyFeatures.push('testing');
  }
  
  return {
    language,
    lineCount,
    functions,
    classes,
    imports,
    keyFeatures
  };
}

/**
 * Generate a fallback explanation when the Gemini API is unavailable
 */
function generateFallbackExplanation(code: string, language?: string): string {
  // Perform code analysis
  const analysis = analyzeCode(code);
  
  // Build a more detailed explanation
  let explanation = `Sorry, the AI service is currently experiencing high demand. Here's an automated explanation instead:\n\n`;
  
  // Use provided language if available, otherwise use the detected one
  const codeLanguage = language || analysis.language;
  explanation += `This is a ${codeLanguage} snippet with ${analysis.lineCount} lines.\n\n`;
  
  // Add function information if available
  if (analysis.functions.length > 0) {
    explanation += `Functions identified: ${analysis.functions.join(', ')}\n\n`;
  }
  
  // Add class information if available
  if (analysis.classes.length > 0) {
    explanation += `Classes identified: ${analysis.classes.join(', ')}\n\n`;
  }
  
  // Add import information if available
  if (analysis.imports.length > 0) {
    explanation += `Dependencies: ${analysis.imports.join(', ')}\n\n`;
  }
  
  // Add key features if identified
  if (analysis.keyFeatures.length > 0) {
    explanation += `Key features: ${analysis.keyFeatures.join(', ')}\n\n`;
  }
  
  // Analyze specific code context based on the current code snippet
  if (code.includes('console.error') && code.includes('Gemini API error')) {
    explanation += `This code appears to be handling an error from the Gemini API. It logs the error details to the console and returns an error message to the user.\n\n`;
  }
  
  if (code.includes('response.status === 503')) {
    explanation += `The code includes specific handling for HTTP 503 errors (Service Unavailable), which typically occur when a service is temporarily overloaded or undergoing maintenance.\n\n`;
  }
  
  explanation += `This is an automated explanation generated when the AI service is unavailable.`;
  
  return explanation;
}

/**
 * Generate a fallback explanation with line markers for TTS highlighting
 * This ensures that even when using a fallback, the UI can still highlight lines as they're explained
 */
function generateFallbackExplanationWithLineMarkers(code: string, language?: string): string {
  // Perform code analysis
  const analysis = analyzeCode(code);
  
  // Build a more detailed explanation with line markers
  let explanation = `Let me walk you through this code...\n\n`;
  
  // Split the code into lines for line-by-line analysis
  const lines = code.split('\n');
  
  // Identify imports and setup
  const importLines = lines.filter(line => line.includes('import') || line.includes('require'));
  if (importLines.length > 0) {
    const firstImportIndex = lines.findIndex(line => line.includes('import') || line.includes('require'));
    explanation += `[Line ${firstImportIndex + 1}] This code starts with importing necessary dependencies or modules.\n\n`;
  }
  
  // Identify functions
  if (analysis.functions.length > 0) {
    const functionLineIndices = analysis.functions.map((func: string) => {
      return {
        name: func,
        line: lines.findIndex(line => line.includes(`function ${func}`)) + 1
      };
    });
    
    functionLineIndices.forEach((func: { name: string; line: number }) => {
      if (func.line > 0) {
        explanation += `[Line ${func.line}] Here we have the function '${func.name}' which `;
        
        // Add some basic function description based on the name
        if (func.name.startsWith('get')) {
          explanation += `retrieves or calculates a value.\n\n`;
        } else if (func.name.startsWith('set')) {
          explanation += `sets or updates a value.\n\n`;
        } else if (func.name.startsWith('handle')) {
          explanation += `handles a specific event or condition.\n\n`;
        } else if (func.name.includes('parse')) {
          explanation += `parses or transforms data.\n\n`;
        } else {
          explanation += `performs a specific operation.\n\n`;
        }
      }
    });
  }
  
  // Look for conditional logic
  const ifStatements = lines.map((line, index) => {
    if (line.includes('if ')) {
      return { line: index + 1, content: line.trim() };
    }
    return null;
  }).filter(item => item !== null);
  
  if (ifStatements.length > 0) {
    const firstIf = ifStatements[0];
    if (firstIf) {
      explanation += `[Line ${firstIf.line}] This conditional statement checks for a specific condition and executes code based on whether that condition is true.\n\n`;
    }
  }
  
  // Check for error handling
  if (lines.some(line => line.includes('try') || line.includes('catch'))) {
    const tryLineIndex = lines.findIndex(line => line.includes('try'));
    if (tryLineIndex !== -1) {
      explanation += `[Line ${tryLineIndex + 1}] This begins a try-catch block for error handling. If an error occurs in the try block, it will be caught and handled in the catch block.\n\n`;
    }
  }
  
  // Add final summary with line markers
  const lastLineIndex = analysis.lineCount - 1;
  explanation += `[Line ${lastLineIndex + 1}] This is the final line of the code snippet. `;
  
  if (analysis.keyFeatures.length > 0) {
    explanation += `Overall, this code demonstrates ${analysis.keyFeatures.join(', ')}.\n\n`;
  }
  
  explanation += `This automated explanation with line references was generated to maintain highlighting functionality.`;
  
  return explanation;
}

/**
 * Explains code using Gemini API
 */
export const explainCode = async (
  request: CodeExplanationRequest
): Promise<GeminiResponse> => {
  try {
    const { code, language = 'javascript', request: userRequest = 'Explain this code' } = request;
    
    console.log('Explaining code with content:', { codeLength: code?.length, language });
    
    const prompt = `
You are an AI code tutor. Explain the EXACT code below in detail. DO NOT explain a generic example - only explain THIS specific code:

\`\`\`${language}
${code}
\`\`\`

RESTRICTIONS:
1. DO NOT MAKE UP CODE - only explain the exact code provided above
2. DO NOT provide a generic explanation - analyze this specific implementation
3. Reference specific line numbers when explaining the code
4. Provide a detailed breakdown of what each important part of the code does

Your analysis should include:
1. What the code does overall
2. Key functions and their purpose
3. Any important patterns or techniques used

FOLLOW THESE INSTRUCTIONS PRECISELY. The user depends on accurate explanation of their actual code.
`;

    // Construct the request body for the Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    // Use the retry mechanism for API calls
    const response = await callGeminiWithRetry(requestBody);

    // Handle API errors - both overloaded API (503) and invalid API key (400)
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error) or API key is invalid (400 error), provide a fallback explanation
      if (response.status === 503 || response.status === 400) {
        const errorType = response.status === 503 ? 'overloaded (503)' : 'authentication error (400)';
        console.log(`Gemini API ${errorType}, using enhanced fallback with line markers for TTS highlighting`);
        return { 
          text: generateFallbackExplanationWithLineMarkers(code, language)
        };
      }
      
      return { text: `AI service unavailable (${response.status}). Please try again later.` };
    }

    const data = await response.json();
    return parseResponse(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return { text: "Error connecting to the AI service." };
  }
};

/**
 * Reads code aloud using Gemini API
 * This generates a narrative explanation suitable for text-to-speech
 */
export const readCodeAloud = async (
  request: CodeExplanationRequest
): Promise<GeminiResponse> => {
  try {
    const { code, language = 'javascript' } = request;
    console.log('Reading code aloud with content:', { codeLength: code?.length, language });
    
    const prompt = `
You are an AI code tutor. Generate a narrative explanation of the EXACT code below. DO NOT explain a generic example - only explain THIS specific code:

\`\`\`${language}
${code}
\`\`\`

RESTRICTIONS:
1. DO NOT MAKE UP CODE - only explain the exact code provided above
2. DO NOT provide a generic explanation - analyze this specific implementation
3. For each section you explain, first say "[Line X]" where X is the line number you're referring to
4. Use natural, conversational language as if you're tutoring someone verbally
5. Pause between explanations of different sections with "..." to create natural breaks
6. Use a friendly, engaging tone suitable for a tutor
7. Break complex explanations into shorter, clearer segments
8. Your explanation will be read aloud, so structure it to be easy to follow when spoken

FORMAT YOUR EXPLANATION LIKE THIS:
"Let me walk you through this code...

[Line 1] This line does X... It's important because...

[Line 3] Next, we see Y... This connects to the previous part by..."

FOLLOW THESE INSTRUCTIONS PRECISELY. The user depends on accurate explanation of their actual code that is properly highlighted as you speak.
`;

    // Construct the request body for the Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    // Use the retry mechanism for API calls
    const response = await callGeminiWithRetry(requestBody);

    // Handle API errors - both overloaded API (503) and invalid API key (400)
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error) or API key is invalid (400 error), provide a fallback explanation
      if (response.status === 503 || response.status === 400) {
        const errorType = response.status === 503 ? 'overloaded (503)' : 'authentication error (400)';
        console.log(`Gemini API ${errorType}, using enhanced fallback with line markers for TTS highlighting`);
        return { 
          text: generateFallbackExplanationWithLineMarkers(code, language)
        };
      }
      
      return { text: `AI service unavailable (${response.status}). Please try again later.` };
    }

    const data = await response.json();
    return parseResponse(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return { text: "Error connecting to the AI service." };
  }
};

/**
 * Answers a question about specific code
 */
export const answerCodeQuestion = async (
  code: string,
  question: string,
  language: string = 'javascript',
  highlightedCode?: string
): Promise<GeminiResponse> => {
  try {
    console.log('Answering question about code:', { codeLength: code?.length, language, question });
    
    let prompt = `
I have a question about this code:

\`\`\`${language}
${code}
\`\`\`

My question is: ${question}
`;

    if (highlightedCode) {
      prompt += `\nSpecifically, I'm asking about this part:\n\`\`\`${language}\n${highlightedCode}\n\`\`\``;
    }
    
    prompt += `\n\nPlease answer my specific question in detail, referring to line numbers where appropriate. If you need to explain a concept, include short examples.`;

    // Construct the request body for the Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    // Use the retry mechanism for API calls
    const response = await callGeminiWithRetry(requestBody);

    // Handle API errors - both overloaded API (503) and invalid API key (400)
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error) or API key is invalid (400 error), provide a fallback explanation
      if (response.status === 503 || response.status === 400) {
        const errorType = response.status === 503 ? 'overloaded (503)' : 'authentication error (400)';
        console.log(`Gemini API ${errorType}, using enhanced fallback with line markers for TTS highlighting`);
        return { 
          text: generateFallbackExplanationWithLineMarkers(code, language)
        };
      }
      
      return { text: `AI service unavailable (${response.status}). Please try again later.` };
    }

    const data = await response.json();
    return parseResponse(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return { text: "Error connecting to the AI service." };
  }
};
