// Script to fix the fallback explanation formatting
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'geminiService.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Create a simple fallback explanation function that uses proper string formatting
const fixedFallbackFunction = `
/**
 * Generate a simple, reliable fallback explanation when Gemini API is unavailable
 */
function generateFallbackExplanationWithLineMarkers(code: string, language?: string): string {
  // Split the code into lines for analysis
  const lines = code.split('\\n');
  const lineCount = lines.length;
  
  // Create a simple but effective fallback with proper line markers
  let explanation = "";
  
  // Add introduction
  explanation += "[Line 1] I'll explain this code step by step.\n\n";
  
  // Add basic code overview
  if (language) {
    explanation += "[Line 2] This is " + language + " code with " + lineCount + " lines.\n\n";
  } else {
    explanation += "[Line 2] This code has " + lineCount + " lines.\n\n";
  }
  
  // Identify and explain key structures
  let currentLine = 3;
  
  // Look for imports/requires
  const importLines = lines.findIndex(line => 
    line.includes('import ') || line.includes('require('));
  if (importLines !== -1) {
    explanation += "[Line " + (importLines + 1) + "] Here we're importing dependencies needed for the code.\n\n";
    currentLine++;
  }
  
  // Look for functions
  const functionLines = lines.findIndex(line => 
    line.includes('function ') || line.match(/\\w+\\s*\\([^)]*\\)\\s*{/));
  if (functionLines !== -1) {
    explanation += "[Line " + (functionLines + 1) + "] This line defines a function.\n\n";
    currentLine++;
  }
  
  // Look for API calls or key operations
  const apiCallLines = lines.findIndex(line => 
    line.includes('fetch(') || line.includes('axios.') || line.includes('await '));
  if (apiCallLines !== -1) {
    explanation += "[Line " + (apiCallLines + 1) + "] This line makes an API call or performs an asynchronous operation.\n\n";
    currentLine++;
  }
  
  // Look for error handling
  const errorHandlingLines = lines.findIndex(line => 
    line.includes('try ') || line.includes('catch '));
  if (errorHandlingLines !== -1) {
    explanation += "[Line " + (errorHandlingLines + 1) + "] This is part of error handling to manage exceptions.\n\n";
    currentLine++;
  }
  
  // Add summary
  explanation += "[Line " + lineCount + "] This completes the code.\n\n";
  explanation += "Note: This is a basic automated explanation while the AI service is unavailable.";
  
  return explanation;
}`;

// Replace the existing function with the fixed version
const functionRegex = /function generateFallbackExplanationWithLineMarkers[\s\S]*?}(\n|\r\n)/;
const updatedContent = content.replace(functionRegex, fixedFallbackFunction + '\n');

// Write the fixed content back to the file
fs.writeFileSync(filePath, updatedContent);
console.log('Fixed the fallback explanation generator to display properly');
