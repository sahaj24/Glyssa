import React, { useState, useEffect, useRef } from 'react';
import { GeminiResponse } from '../services/geminiService';

interface CodeHighlighterProps {
  code: string;
  language: string;
  annotations?: GeminiResponse['annotations'];
  currentHighlight?: number;
  onLineClick?: (lineNumber: number) => void;
}

const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  code,
  language,
  annotations = [],
  currentHighlight = -1,
  onLineClick
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  // Split code into lines
  useEffect(() => {
    if (code) {
      setLines(code.split('\n'));
    }
  }, [code]);

  // Scroll to highlighted line
  useEffect(() => {
    if (currentHighlight >= 0 && codeRef.current) {
      const lineElements = codeRef.current.querySelectorAll('.code-line');
      if (lineElements[currentHighlight]) {
        lineElements[currentHighlight].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentHighlight]);

  // Check if a line should be highlighted
  const shouldHighlight = (lineIndex: number) => {
    if (currentHighlight === lineIndex) return true;
    
    if (annotations) {
      return annotations.some(
        annotation => 
          lineIndex >= annotation.startLine - 1 && 
          lineIndex <= annotation.endLine - 1
      );
    }
    
    return false;
  };

  // Get annotation for a specific line
  const getAnnotationForLine = (lineIndex: number) => {
    if (!annotations) return null;
    
    return annotations.find(
      annotation => 
        lineIndex >= annotation.startLine - 1 && 
        lineIndex <= annotation.endLine - 1
    );
  };

  // Handle line click
  const handleLineClick = (lineIndex: number) => {
    if (onLineClick) {
      onLineClick(lineIndex);
    }
    
    const annotation = getAnnotationForLine(lineIndex);
    if (annotation) {
      setActiveAnnotation(lineIndex);
    } else {
      setActiveAnnotation(null);
    }
  };

  return (
    <div className="relative">
      <div 
        ref={codeRef}
        className="font-mono text-sm bg-zinc-900 rounded-md overflow-auto"
      >
        {lines.map((line, index) => {
          const isHighlighted = shouldHighlight(index);
          const annotation = getAnnotationForLine(index);
          const isActive = activeAnnotation === index;
          
          return (
            <div 
              key={index}
              className={`code-line flex relative ${
                isHighlighted 
                  ? 'bg-zinc-800 hover:bg-zinc-700' 
                  : 'hover:bg-zinc-800'
              } ${
                isActive ? 'border-l-2 border-purple-500' : ''
              }`}
              onClick={() => handleLineClick(index)}
            >
              <div className="text-zinc-500 text-right pr-4 select-none w-12 flex-shrink-0 bg-zinc-900">
                {index + 1}
              </div>
              <pre className="px-4 py-1 overflow-x-auto flex-grow">
                <code>{line || ' '}</code>
              </pre>
              
              {annotation && isActive && (
                <div className="absolute left-full top-0 ml-2 p-2 bg-zinc-800 rounded-md shadow-lg text-sm text-zinc-300 max-w-xs z-10">
                  {annotation.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CodeHighlighter;
