// Script to clean up the geminiService.ts file
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'geminiService.ts');

// Create a backup
fs.copyFileSync(filePath, filePath + '.clean-backup');

// Read the file content
const content = fs.readFileSync(filePath, 'utf8');

// Find where our fixed function ends
const fixedFunctionEnd = 'return explanation;\n}';
const fixedFunctionEndIndex = content.indexOf(fixedFunctionEnd);

if (fixedFunctionEndIndex === -1) {
  console.error('Could not find the fixed function end');
  process.exit(1);
}

// Find the start of the analyzeCode function to ensure we keep it
const analyzeCodeStart = 'function analyzeCode(code: string)';
const analyzeCodeIndex = content.indexOf(analyzeCodeStart);

if (analyzeCodeIndex === -1) {
  console.error('Could not find the analyzeCode function');
  process.exit(1);
}

// Create a clean version of the file by keeping everything before the fixed function end
// and everything after the analyzeCode function start
const cleanContent = 
  content.substring(0, fixedFunctionEndIndex + fixedFunctionEnd.length) + 
  '\n\n' +
  content.substring(analyzeCodeIndex);

fs.writeFileSync(filePath, cleanContent);
console.log('Successfully cleaned up geminiService.ts file');
