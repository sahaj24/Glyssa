// Test script to verify Google Cloud Text-to-Speech credentials
const fs = require('fs');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

async function testTTSCredentials() {
  console.log('Testing Google Cloud Text-to-Speech credentials...');
  
  try {
    // Path to your credentials file
    const keyFilePath = './credentials/google-credentials.json';
    console.log('Looking for credentials at:', keyFilePath);
    
    if (!fs.existsSync(keyFilePath)) {
      console.error('Credentials file not found!');
      return false;
    }
    
    console.log('Credentials file found, loading...');
    const keyFile = fs.readFileSync(keyFilePath, 'utf8');
    
    try {
      const credentials = JSON.parse(keyFile);
      console.log('Credentials parsed successfully');
      console.log('Project ID:', credentials.project_id);
      console.log('Client email:', credentials.client_email);
      
      // Initialize TTS client with credentials
      console.log('Initializing TTS client...');
      const client = new TextToSpeechClient({ credentials });
      
      // Simple request to test connectivity
      console.log('Testing API with listVoices() call...');
      const [result] = await client.listVoices({});
      console.log('API call successful!');
      console.log(`Found ${result.voices.length} voices`);
      
      return true;
    } catch (error) {
      console.error('Error using credentials:', error);
      return false;
    }
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

// Run the test
testTTSCredentials().then(success => {
  if (success) {
    console.log('✅ Credentials test PASSED!');
    process.exit(0);
  } else {
    console.log('❌ Credentials test FAILED!');
    process.exit(1);
  }
});
