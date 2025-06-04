// Updated implementation for explainCode function
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

Your task:
${userRequest}

RESTRICTIONS:
1. DO NOT MAKE UP CODE - only explain the exact code provided above
2. DO NOT provide a generic explanation - analyze this specific implementation
3. Use clear language a student can understand
4. Identify important functions, classes, variables and explain their purpose
5. For complex or important sections, explain line by line
6. Highlight any bugs, inefficiencies, or improvements

INCLUDE CODE ANNOTATIONS:
- For important lines, include a line number reference like: [Line 12]
- Follow this format for multiple line references: [Lines 5-10]

STRUCTURE YOUR EXPLANATION:
1. First, summarize what the code does overall
2. Then explain the main components/sections
3. Finally, provide additional context or best practices
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error), provide a fallback explanation with line markers for TTS
      if (response.status === 503) {
        console.log('Gemini API overloaded (503), using enhanced fallback with line markers for TTS highlighting');
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

// Updated implementation for readCodeAloud function
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error), provide a fallback explanation with line markers for TTS
      if (response.status === 503) {
        console.log('Gemini API overloaded (503), using enhanced fallback with line markers for TTS highlighting');
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

// Updated implementation for answerCodeQuestion function
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // If the model is overloaded (503 error), provide a fallback explanation with line markers for TTS
      if (response.status === 503) {
        console.log('Gemini API overloaded (503), using enhanced fallback with line markers for TTS highlighting');
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
