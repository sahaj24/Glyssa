#!/bin/bash

# Update explainCode function
sed -i '' '414,430c\
    // Construct the request body for the Gemini API\
    const requestBody = {\
      contents: [\
        {\
          parts: [\
            {\
              text: prompt\
            }\
          ]\
        }\
      ]\
    };\
    \
    // Use the retry mechanism for API calls\
    const response = await callGeminiWithRetry(requestBody);' src/services/geminiService.ts

# Update readCodeAloud function
sed -i '' '436,452c\
    // Construct the request body for the Gemini API\
    const requestBody = {\
      contents: [\
        {\
          parts: [\
            {\
              text: prompt\
            }\
          ]\
        }\
      ]\
    };\
    \
    // Use the retry mechanism for API calls\
    const response = await callGeminiWithRetry(requestBody);' src/services/geminiService.ts

# Update answerCodeQuestion function
sed -i '' '503,519c\
    // Construct the request body for the Gemini API\
    const requestBody = {\
      contents: [\
        {\
          parts: [\
            {\
              text: prompt\
            }\
          ]\
        }\
      ]\
    };\
    \
    // Use the retry mechanism for API calls\
    const response = await callGeminiWithRetry(requestBody);' src/services/geminiService.ts

echo "Updated all Gemini API functions to use retry mechanism"
