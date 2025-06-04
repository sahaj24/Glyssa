import React, { useState } from 'react';
import googleTTSService from '../services/googleTTSService';

const TTSDebug: React.FC = () => {
  const [testText, setTestText] = useState('This is a test of the Google TTS API.');
  const [status, setStatus] = useState<string>('Ready');
  const [apiResponse, setApiResponse] = useState<string>('');

  const [selectedVoice, setSelectedVoice] = useState('en-US-Standard-D');

  const testGoogleTTS = async () => {
    try {
      setStatus('Testing Google TTS API...');
      console.log('Sending request to Google TTS API...');
      
      // Direct API test to isolate any issues
      const requestBody = {
        text: `<speak>${testText}</speak>`,
        isSSML: true,
        voiceOptions: {
          languageCode: 'en-US',
          name: selectedVoice,
          ssmlGender: 'MALE'
        }
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', response.status);
      
      let responseText;
      try {
        responseText = await response.text();
        console.log('Response text:', responseText);
      } catch (e) {
        console.error('Error reading response text:', e);
        responseText = 'Error reading response';
      }
      
      if (!response.ok) {
        setStatus(`API Error (${response.status}): ${responseText.substring(0, 100)}`);
        setApiResponse(responseText);
        return;
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed response:', data);
      } catch (e) {
        console.error('Error parsing JSON response:', e);
        setStatus(`Error parsing response: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setApiResponse(responseText);
        return;
      }
      
      if (data.audio) {
        setStatus('Success! Playing audio...');
        setApiResponse(`Received audio data of length: ${data.audio.length}\n\nFull response: ${JSON.stringify(data, null, 2)}`);
        
        // Play the audio
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
      } else {
        setStatus('No audio data returned');
        setApiResponse(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setApiResponse(error instanceof Error ? error.stack || '' : 'No stack trace');
    }
  };

  const testBrowserTTS = () => {
    try {
      setStatus('Testing browser TTS...');
      
      // Use browser TTS directly
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      
      // Try to get a good voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(voice => voice.lang.includes('en-'));
      if (englishVoices.length > 0) {
        utterance.voice = englishVoices[0];
        setApiResponse(`Using voice: ${englishVoices[0].name}`);
      } else {
        setApiResponse('No English voices available');
      }
      
      utterance.onend = () => {
        setStatus('Browser TTS completed');
      };
      
      utterance.onerror = (event) => {
        setStatus(`Browser TTS error: ${event.error}`);
      };
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setApiResponse(error instanceof Error ? error.stack || '' : 'No stack trace');
    }
  };

  const testGoogleTTSService = () => {
    try {
      setStatus('Testing googleTTSService...');
      
      googleTTSService.speak(
        testText,
        (lineNumber) => {
          setApiResponse(`Highlighting line ${lineNumber}`);
        },
        () => {
          setStatus('TTS service speech completed');
        }
      );
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setApiResponse(error instanceof Error ? error.stack || '' : 'No stack trace');
    }
  };

  // Check for credentials file (client-side check)
  const [credentialStatus, setCredentialStatus] = useState<string>('Checking...');
  const [credentialDetails, setCredentialDetails] = useState<{path?: string; project?: string}>({});
  
  React.useEffect(() => {
    // Just perform a simple fetch to test the API connection
    fetch('/api/tts/status')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        return { status: 'error', message: `HTTP error ${response.status}` };
      })
      .then(data => {
        if (data.status === 'ok') {
          setCredentialStatus(`✅ Credentials loaded - Project: ${data.project || 'unknown'}`);
          setCredentialDetails({
            path: data.path,
            project: data.project
          });
        } else {
          setCredentialStatus(`❌ Credentials issue: ${data.message || 'Unknown error'}`);
        }
      })
      .catch(error => {
        setCredentialStatus(`❌ API check failed: ${error.message}`);
      });
  }, []);

  // List of Google TTS voices to try
  const voiceOptions = [
    { name: 'en-US-Standard-D', description: 'Standard Male (D)' },
    { name: 'en-US-Standard-E', description: 'Standard Female (E)' },
    { name: 'en-US-Studio-M', description: 'Studio Male (M)' },
    { name: 'en-US-Studio-O', description: 'Studio Female (O)' },
    { name: 'en-US-Neural2-D', description: 'Neural2 Male (D)' },
    { name: 'en-US-Neural2-F', description: 'Neural2 Female (F)' },
    { name: 'en-US-Wavenet-D', description: 'Wavenet Male (D)' },
    { name: 'en-US-Wavenet-E', description: 'Wavenet Female (E)' },
  ];

  return (
    <div className="p-4 bg-zinc-900 text-white rounded-md shadow-lg">
      <h2 className="text-xl font-bold mb-4">TTS API Debug</h2>
      
      <div className="mb-4 p-2 bg-zinc-800 rounded">
        <div className="font-bold mb-1">Google Cloud Credentials:</div>
        <div className={credentialStatus.includes('✅') ? 'text-green-500' : 'text-red-500'}>
          {credentialStatus}
        </div>
        {credentialDetails.project && (
          <div className="mt-2 text-xs">
            <div><span className="font-semibold">Project ID:</span> {credentialDetails.project}</div>
            {credentialDetails.path && <div><span className="font-semibold">Credentials Path:</span> {credentialDetails.path}</div>}
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block mb-2">Test Text:</label>
        <textarea
          className="w-full p-2 bg-zinc-800 text-white rounded"
          rows={3}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
        />
      </div>
      
      <div className="mb-4">
        <label className="block mb-2">Google Voice:</label>
        <select
          className="w-full p-2 bg-zinc-800 text-white rounded"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
        >
          {voiceOptions.map(voice => (
            <option key={voice.name} value={voice.name}>
              {voice.description}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex space-x-2 mb-4">
        <button
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          onClick={testGoogleTTS}
        >
          Test Google TTS API
        </button>
        
        <button
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
          onClick={testBrowserTTS}
        >
          Test Browser TTS
        </button>
        
        <button
          className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
          onClick={testGoogleTTSService}
        >
          Test TTS Service
        </button>
      </div>
      
      <div className="mb-4">
        <div className="font-bold">Status:</div>
        <div className="p-2 bg-zinc-800 rounded">{status}</div>
      </div>
      
      <div>
        <div className="font-bold">API Response:</div>
        <pre className="p-2 bg-zinc-800 rounded overflow-auto max-h-40 text-sm">{apiResponse}</pre>
      </div>
    </div>
  );
};

export default TTSDebug;
