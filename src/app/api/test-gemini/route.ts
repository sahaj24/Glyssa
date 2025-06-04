// API route to test Gemini API directly
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get the API key from environment
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    // Log information about the API key (but not the key itself)
    console.log('API key exists:', !!apiKey);
    console.log('API key length:', apiKey?.length || 0);
    console.log('API key prefix:', apiKey ? apiKey.substring(0, 4) + '...' : 'not set');

    // Different API call methods to try
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;
    
    // Create a simple request
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "Hello, please respond with a simple greeting."
            }
          ]
        }
      ]
    };

    // Make direct API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Get response details
    const status = response.status;
    const responseData = await response.text();

    // Return detailed information
    return NextResponse.json({
      success: response.ok,
      statusCode: status,
      responseData,
      apiKeyInfo: {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        prefix: apiKey ? apiKey.substring(0, 4) + '...' : 'not set'
      }
    });
  } catch (error: any) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
