// Type definition for GeminiResponse from the Gemini AI service

export interface GeminiAnnotation {
  startLine: number;
  endLine: number;
  explanation: string;
}

export interface GeminiResponse {
  text: string;
  annotations?: GeminiAnnotation[];
  error?: string;
}
