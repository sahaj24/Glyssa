import { NextResponse } from 'next/server';
import fs from 'fs';
// path import removed as it's not used

// Path to credentials file
const keyFilePath = '/Users/sahaj/Documents/glyssa-v/glyssa/credentials/google-credentials.json';

export async function GET() {
  try {
    // Check environment variable first
    const envCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let credentialSource = 'Not found';
    
    // Check if credentials file exists
    if (fs.existsSync(keyFilePath)) {
      // Load and parse the credentials file
      try {
        const keyFile = fs.readFileSync(keyFilePath, 'utf8');
        const credentials = JSON.parse(keyFile);
        credentialSource = 'File';
        
        // Return basic status with project ID (but no sensitive data)
        return NextResponse.json({
          status: 'ok',
          project: credentials.project_id,
          path: keyFilePath,
          env_path: envCredPath || 'Not set',
          credential_source: credentialSource,
          message: 'Google Cloud credentials loaded successfully'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
          status: 'error',
          message: `Failed to parse credentials file: ${errorMessage}`
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        status: 'error',
        message: 'Credentials file not found'
      }, { status: 404 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      status: 'error',
      message: `Error checking credentials: ${errorMessage}`
    }, { status: 500 });
  }
}
