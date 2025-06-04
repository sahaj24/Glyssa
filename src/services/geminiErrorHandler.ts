// Helper functions for handling Gemini API errors

/**
 * Handles common Gemini API error responses
 * @param response The fetch API response
 * @param code The code that was being processed
 * @param language The programming language of the code
 * @param fallbackGenerator Function to generate fallback content
 * @returns A response object with appropriate text
 */
export const handleGeminiApiError = async (
  response: Response, 
  code: string,
  language: string,
  fallbackGenerator: (code: string, language: string) => string
): Promise<{ text: string }> => {
  const errorText = await response.text();
  console.error('Gemini API error:', errorText);
  
  // Handle both API overload (503) and authentication errors (400)
  if (response.status === 503 || response.status === 400) {
    const errorReason = response.status === 503 ? 'overloaded (503)' : 'authentication error (400)';
    console.log(`Gemini API ${errorReason}, using enhanced fallback explanation`);
    return { 
      text: fallbackGenerator(code, language)
    };
  }
  
  return { text: `AI service unavailable (${response.status}). Please try again later.` };
};
