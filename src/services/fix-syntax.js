// Script to fix the syntax errors in fallback explanation
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'geminiService.ts');
const backupPath = path.join(__dirname, 'geminiService.ts.bak');

// Create a backup
fs.copyFileSync(filePath, backupPath);

// Create a simple, correctly formatted fallback function
const fixedFunction = `
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
  explanation += "[Line 1] I'll explain this code step by step.\\n\\n";
  
  // Add basic code overview
  if (language) {
    explanation += "[Line 2] This is " + language + " code with " + lineCount + " lines.\\n\\n";
  } else {
    explanation += "[Line 2] This code has " + lineCount + " lines.\\n\\n";
  }
  
  // Identify and explain key structures
  let currentLine = 3;
  
  // Look for imports/requires
  const importLines = lines.findIndex(line => 
    line.includes('import ') || line.includes('require('));
  if (importLines !== -1) {
    explanation += "[Line " + (importLines + 1) + "] Here we're importing dependencies needed for the code.\\n\\n";
    currentLine++;
  }
  
  // Look for functions
  const functionLines = lines.findIndex(line => 
    line.includes('function ') || line.match(/\\w+\\s*\\([^)]*\\)\\s*{/));
  if (functionLines !== -1) {
    explanation += "[Line " + (functionLines + 1) + "] This line defines a function.\\n\\n";
    currentLine++;
  }
  
  // Look for API calls or key operations
  const apiCallLines = lines.findIndex(line => 
    line.includes('fetch(') || line.includes('axios.') || line.includes('await '));
  if (apiCallLines !== -1) {
    explanation += "[Line " + (apiCallLines + 1) + "] This line makes an API call or performs an asynchronous operation.\\n\\n";
    currentLine++;
  }
  
  // Look for error handling
  const errorHandlingLines = lines.findIndex(line => 
    line.includes('try ') || line.includes('catch '));
  if (errorHandlingLines !== -1) {
    explanation += "[Line " + (errorHandlingLines + 1) + "] This is part of error handling to manage exceptions.\\n\\n";
    currentLine++;
  }
  
  // Add summary
  explanation += "[Line " + lineCount + "] This completes the code.\\n\\n";
  explanation += "Note: This is a basic automated explanation while the AI service is unavailable.";
  
  return explanation;
}`;

// Get the full file content
const fileContent = fs.readFileSync(backupPath, 'utf8');

// Find where the function starts and ends
const functionStartRegex = /function generateFallbackExplanationWithLineMarkers[\s\S]*?\{/;
const functionEndRegex = /return explanation;\s*\}/;

const functionStartMatch = fileContent.match(functionStartRegex);
const functionEndMatch = fileContent.match(functionEndRegex);

if (functionStartMatch && functionEndMatch) {
  const startIndex = functionStartMatch.index;
  // Find the end of the function (add the length of the matched return statement)
  const endIndex = fileContent.indexOf(functionEndMatch[0], startIndex) + functionEndMatch[0].length;
  
  // Replace the whole function with our fixed version
  const newContent = 
    fileContent.substring(0, startIndex) + 
    fixedFunction + 
    fileContent.substring(endIndex);
  
  // Write the fixed content
  fs.writeFileSync(filePath, newContent);
  console.log('Fixed syntax errors in fallback explanation generator');
} else {
  console.error('Could not find the function to replace');
}
