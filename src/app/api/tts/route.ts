import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';

// Type definitions for the Google TTS API
type SynthesizeSpeechRequest = protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest;
import fs from 'fs';
// path import removed as it's not used

// Use the service account key file path or environment variable
// The service account key is loaded dynamically from a file or from credentials directly
const keyFilePath = '/Users/sahaj/Documents/glyssa-v/glyssa/new-google-credentials.json';
console.log('Attempting to use credentials file at:', keyFilePath);

// You can also set the GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable with the entire JSON content
// This is useful for deployment where you don't want to rely on a file

// Create a client with the service account key
let client: TextToSpeechClient | null = null;
// clientInitAttempted removed as it's not used
let initError: Error | string | null = null;

/**
 * Initialize the TTS client
 */
function initClient(): boolean {
  // Always reinitialize for troubleshooting
  // clientInitAttempted assignment removed
  client = null;
  
  try {
    console.log('Initializing Google Cloud TTS client...');
    
    // Option 1: Check if direct JSON credentials are provided in environment
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        console.log('Found GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        client = new TextToSpeechClient({ credentials });
        console.log('Google TTS client initialized successfully from JSON environment variable');
        return true;
      } catch (parseError: unknown) {
        console.error('Error parsing credentials from environment variable:', parseError);
      }
    }

    // Option 2: Check if key file exists
    console.log('Checking for credentials file at:', keyFilePath);
    if (fs.existsSync(keyFilePath)) {
      console.log('Credentials file found, loading contents...');
      // Load and parse the credentials file
      const keyFile = fs.readFileSync(keyFilePath, 'utf8');
      console.log('Credentials file loaded, length:', keyFile.length);
      
      try {
        // Print first few chars to verify it's not empty/corrupted
        console.log('Credentials file preview:', keyFile.substring(0, 50) + '...');
        
        const credentials = JSON.parse(keyFile);
        console.log('Credentials parsed successfully, project_id:', credentials.project_id);
        
        // Initialize client with explicit credentials
        client = new TextToSpeechClient({ credentials });
        console.log('Google TTS client initialized successfully from credentials file');
        return true;
      } catch (parseError: unknown) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        console.error('Error parsing credentials file:', errorMessage);
        initError = `Invalid credentials JSON: ${errorMessage}`;
      }
    } else {
      console.error('Credentials file not found at:', keyFilePath);
    }

    // Option 3: Fallback to standard environment variable path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        client = new TextToSpeechClient();
        console.log('Google TTS client initialized from GOOGLE_APPLICATION_CREDENTIALS environment variable');
        return true;
      } catch (error) {
        console.error('Error initializing client with GOOGLE_APPLICATION_CREDENTIALS:', error);
      }
    }
    
    // All methods failed
    console.error('Failed to initialize Google TTS client with any available method');
    initError = 'No valid credentials found. Please provide valid Google Cloud credentials.';
    return false;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error initializing Text-to-Speech client:', errorMessage);
    initError = `Client initialization error: ${errorMessage}`;
    return false;
  }
}

// Try to initialize the client when module loads
initClient();

export async function POST(request: NextRequest) {
  console.log('TTS API route POST handler called');
  
  try {
    // Always initialize client to ensure we have the latest credentials
    if (!initClient()) {
      console.error('Failed to initialize TTS client:', initError);
      return NextResponse.json(
        { error: `Failed to initialize TTS client: ${initError}` },
        { status: 500 }
      );
    }
    
    console.log('TTS API route called with initialized client');

    // Double-check client is available
    if (!client) {
      return NextResponse.json(
        { error: 'Text-to-Speech client not initialized' },
        { status: 500 }
      );
    }

    // Parse the request body
    const body = await request.json();
    console.log('Request body received:', {
      textLength: body.text?.length || 0,
      isSSML: body.isSSML,
      voiceName: body.voiceOptions?.name
    });
    
    const { text, isSSML, voiceOptions } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text parameter is required' },
        { status: 400 }
      );
    }

    // Set default voice options if not provided - prefer Studio voices for higher quality
    const voice = {
      languageCode: voiceOptions?.languageCode || 'en-US',
      name: voiceOptions?.name || 'en-US-Studio-M',
      ssmlGender: voiceOptions?.ssmlGender || 'MALE',
    };

    // Configure the request to Google TTS API
    const request_config: SynthesizeSpeechRequest = {
      // Handle SSML input properly
      input: isSSML ? { ssml: text } : { text },
      voice,
      audioConfig: { 
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
        // Higher quality audio settings
        effectsProfileId: ['medium-bluetooth-speaker-class-device'],
        pitch: 0,
        speakingRate: 0.97
      },
    };
    
    console.log('TTS request config:', JSON.stringify({
      inputType: isSSML ? 'ssml' : 'text',
      voiceName: voice.name,
      languageCode: voice.languageCode
    }));

    try {
      console.log('Calling Google TTS API with synthesizeSpeech...');
      // Call the Google TTS API with explicit error handling
      const [response] = await client.synthesizeSpeech(request_config as SynthesizeSpeechRequest);
      
      console.log('Google TTS API response received');
      
      // Return the audio content as a base64 string with validation
      if (response.audioContent && response.audioContent.length > 0) {
        console.log('Audio content received, length:', response.audioContent.length);
        
        // Validate audio content before converting to base64
        if (response.audioContent.length < 100) {
          console.warn('Audio content suspiciously small, might be invalid');
          return NextResponse.json(
            { error: 'Invalid audio content received from Google TTS API', success: false },
            { status: 500 }
          );
        }
        
        try {
          const base64Audio = Buffer.from(response.audioContent as Buffer).toString('base64');
          console.log('Converted to base64, length:', base64Audio.length);
          
          // Validate base64 string
          if (base64Audio.length % 4 !== 0) {
            console.warn('Generated base64 string length is not a multiple of 4, which may indicate corruption');
          }
          
          // Log a preview of the base64 data for debugging
          console.log('Base64 preview:', 
            `Start: ${base64Audio.substring(0, 20)}...`, 
            `End: ...${base64Audio.substring(base64Audio.length - 20)}`);
          
          return NextResponse.json({
            audio: base64Audio,
            success: true
          });
        } catch (error) {
          console.error('Error converting audio content to base64:', error);
          return NextResponse.json(
            { error: 'Error processing audio data', success: false },
            { status: 500 }
          );
        }
      } else {
        console.error('No audio content in response');
        return NextResponse.json(
          { error: 'No audio content returned from Google TTS API', success: false },
          { status: 500 }
        );
      }
    } catch (syntError: unknown) {
      console.error('Error in synthesizeSpeech call:', syntError);
      throw syntError; // Rethrow to be caught by outer handler
    }
    
  } catch (error: unknown) {
    // Check if this is a quota exceeded error (429)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('TTS API error details:', errorMessage);
    
    if (error instanceof Error && errorMessage.includes('429')) {
      // Return a specific error for quota exceeded
      console.warn('Google Cloud API quota exceeded');
      return NextResponse.json(
        { error: 'Google Cloud API quota exceeded. Please try again later.', success: false },
        { status: 429 }
      );
    }

    // Check for specific error types for better error messages
    let status = 500;
    let responseMessage = errorMessage;
    
    if (errorMessage.includes('permission denied') || errorMessage.includes('forbidden')) {
      status = 403;
      responseMessage = 'Google Cloud API permission denied. Please check your API credentials and permissions.';
    } else if (errorMessage.includes('not found')) {
      status = 404;
      responseMessage = 'Resource not found. Please check your Google Cloud project configuration.';
    }
    
    console.error('TTS API error:', responseMessage);
    return NextResponse.json({ error: responseMessage, success: false, details: errorMessage }, { status });
  }
}
