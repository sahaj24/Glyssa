// Direct update of the geminiService.ts file to handle API key validation errors
const fs = require('fs');

const filePath = '/Users/sahaj/Documents/glyssa-v/glyssa/src/services/geminiService.ts';
const fileContent = fs.readFileSync(filePath, 'utf8');

// Create a backup
fs.writeFileSync(`${filePath}.backup`, fileContent);

// Replace the error handling for all functions
const updated = fileContent
  .replace(
    /\/\/ If the model is overloaded \(503 error\), provide a fallback explanation with line markers for TTS\s+if \(response\.status === 503\) \{/g,
    '// If the model is overloaded (503 error) or API key is invalid (400 error), provide a fallback explanation with line markers for TTS\n      if (response.status === 503 || response.status === 400) {'
  )
  .replace(
    /console\.log\('Gemini API overloaded \(503\), using enhanced fallback with line markers for TTS highlighting'\);/g,
    'console.log(`Gemini API ${response.status === 503 ? "overloaded (503)" : "authentication error (400)"}, using enhanced fallback with line markers for TTS highlighting`);'
  );

fs.writeFileSync(filePath, updated);
console.log('Successfully updated geminiService.ts to handle both 503 and 400 errors');
