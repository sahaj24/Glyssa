// Script to fix the Gemini API error handling in geminiService.ts
// Run this script with: node fix-gemini-error.js

const fs = require('fs');
const path = require('path');

// Path to the original geminiService.ts file
const servicePath = path.join(__dirname, 'geminiService.ts');

// Read the file content
let fileContent = fs.readFileSync(servicePath, 'utf8');

// Define the pattern to search for
const pattern = `// If the model is overloaded (503 error), provide a fallback explanation with line markers for TTS
      if (response.status === 503) {`;

// Define the replacement text
const replacement = `// If the model is overloaded (503 error) or API key is invalid (400 error), provide a fallback explanation with line markers for TTS
      if (response.status === 503 || response.status === 400) {`;

// Replace all occurrences
let updatedContent = fileContent.replace(new RegExp(pattern, 'g'), replacement);

// Add a message to the console.log when using the fallback
const logPattern = `console.log('Gemini API overloaded (503), using enhanced fallback with line markers for TTS highlighting');`;
const logReplacement = `console.log('Gemini API error: ' + (response.status === 503 ? 'overloaded (503)' : 'authentication error (400)') + ', using enhanced fallback with line markers for TTS highlighting');`;

updatedContent = updatedContent.replace(new RegExp(logPattern, 'g'), logReplacement);

// Write the updated content back to a new file
const backupPath = servicePath + '.bak';
fs.writeFileSync(backupPath, fileContent, 'utf8');
fs.writeFileSync(servicePath, updatedContent, 'utf8');

console.log('geminiService.ts has been updated to handle 400 errors.');
console.log('A backup of the original file has been saved as geminiService.ts.bak');
