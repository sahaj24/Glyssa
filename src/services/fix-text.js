// Script to fix the fallback explanation text formatting
const fs = require('fs');
const path = require('path');

// Path to the geminiService.ts file
const filePath = path.join(__dirname, 'geminiService.ts');

// Create a backup
fs.copyFileSync(filePath, filePath + '.text-backup');

// Read the file content
const content = fs.readFileSync(filePath, 'utf8');

// Find the generateFallbackExplanationWithLineMarkers function
const functionStart = content.indexOf('function generateFallbackExplanationWithLineMarkers');
if (functionStart === -1) {
  console.error('Could not find the generateFallbackExplanationWithLineMarkers function');
  process.exit(1);
}

// Find the end of the function
const functionEnd = content.indexOf('}\n\nfunction analyzeCode', functionStart);
if (functionEnd === -1) {
  console.error('Could not find the end of the generateFallbackExplanationWithLineMarkers function');
  process.exit(1);
}

// Replace the function with a simpler version that uses plain text
const simpleFallbackFunction = `
/**
 * Generate a simple fallback explanation with line markers when Gemini API is unavailable
 */
function generateFallbackExplanationWithLineMarkers(code, language) {
  // Split code into lines and count them
  const lines = code.split('\\n');
  const lineCount = lines.length;
  
  // Create a simple fallback explanation with plain text
  let explanation = "";
  
  // Add introduction with line marker
  explanation += "[Line 1] This is a fallback explanation while the AI service is unavailable.\\n\\n";
  
  // Add language information
  if (language) {
    explanation += "[Line 2] This appears to be " + language + " code with " + lineCount + " lines.\\n\\n";
  } else {
    explanation += "[Line 2] This code has " + lineCount + " lines.\\n\\n";
  }
  
  // Add basic code structure information
  let currentLineMarker = 3;
  
  // Look for imports
  for (let i = 0; i < Math.min(lineCount, 10); i++) {
    if (lines[i].includes('import ') || lines[i].includes('require(')) {
      explanation += "[Line " + (i + 1) + "] This line imports dependencies.\\n\\n";
      currentLineMarker++;
      break;
    }
  }
  
  // Look for functions
  for (let i = 0; i < lineCount; i++) {
    if (lines[i].includes('function ') || lines[i].match(/[a-zA-Z0-9_]+\\s*\\([^)]*\\)\\s*\\{/)) {
      explanation += "[Line " + (i + 1) + "] This line defines a function.\\n\\n";
      currentLineMarker++;
      break;
    }
  }
  
  // Look for classes
  for (let i = 0; i < lineCount; i++) {
    if (lines[i].includes('class ')) {
      explanation += "[Line " + (i + 1) + "] This line defines a class.\\n\\n";
      currentLineMarker++;
      break;
    }
  }
  
  // Look for control structures
  for (let i = 0; i < lineCount; i++) {
    if (lines[i].includes('if ') || lines[i].includes('for ') || lines[i].includes('while ')) {
      explanation += "[Line " + (i + 1) + "] This line contains a control structure.\\n\\n";
      currentLineMarker++;
      break;
    }
  }
  
  // Add final explanation
  explanation += "[Line " + lineCount + "] End of code.\\n\\n";
  
  explanation += "Note: This is a basic fallback explanation. The AI service is currently unavailable.";
  
  return explanation;
}`;

// Replace the function in the content
const updatedContent = 
  content.substring(0, functionStart) + 
  simpleFallbackFunction + 
  content.substring(functionEnd + 1);

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContent);
console.log('Successfully updated the fallback explanation generator with plain text');
