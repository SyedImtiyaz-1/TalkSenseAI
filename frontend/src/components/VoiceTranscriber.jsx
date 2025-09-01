import React, { useState, useRef, useEffect } from 'react';
import { getWsBaseUrl } from '@/lib/api';

const VoiceTranscriber = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [error, setError] = useState(null);
  const [currentSpeaker, setCurrentSpeaker] = useState('Customer');
  const [microphoneStatus, setMicrophoneStatus] = useState('off'); // 'off', 'pending', 'ready'
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const inputStreamRef = useRef(null);

  // Check microphone permissions on component mount
  useEffect(() => {
    checkMicrophonePermission();
    return () => {
      stopRecording();
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      if (result.state === 'granted') {
        setMicrophoneStatus('ready');
      } else if (result.state === 'prompt') {
        setMicrophoneStatus('off');
      } else {
        setMicrophoneStatus('off');
        setError('Microphone access is blocked. Please allow microphone access in your browser settings.');
      }
    } catch (err) {
      console.error('Error checking microphone permission:', err);
      setMicrophoneStatus('off');
    }
  };

  const initializeMicrophone = async () => {
    try {
      setMicrophoneStatus('pending');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      if (!stream.active) {
        throw new Error('Microphone stream is not active');
      }
      
      setMicrophoneStatus('ready');
      return stream;
    } catch (err) {
      console.error('Microphone initialization error:', err);
      setMicrophoneStatus('off');
      throw err;
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setTranscriptions([]);

      // Initialize microphone
      const stream = await initializeMicrophone();
      streamRef.current = stream;

      // Initialize WebSocket
      const wsBaseUrl = getWsBaseUrl();
      websocketRef.current = new WebSocket(`${wsBaseUrl}/ws/transcribe`);
      
      websocketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcription') {
          setTranscriptions(prev => [...prev, {
            speaker: currentSpeaker,
            text: data.text,
            timestamp: new Date().toLocaleTimeString()
          }]);
        } else if (data.type === 'error') {
          setError(data.message);
          stopRecording();
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please try again.');
        stopRecording();
      };

      websocketRef.current.onopen = () => {
        audioContextRef.current = new AudioContext({
          sampleRate: 44100,
        });

        inputStreamRef.current = audioContextRef.current.createMediaStreamSource(stream);
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processorRef.current.onaudioprocess = (e) => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            websocketRef.current.send(pcmData.buffer);
          }
        };

        inputStreamRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
        
        setIsRecording(true);
      };

    } catch (err) {
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Microphone access was denied. Please allow microphone access and try again.'
        : 'Failed to access microphone. Please check your microphone connection and browser settings.';
      
      setError(errorMessage);
      stopRecording();
    }
  };

  const stopRecording = () => {
    // Stop recording
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Cleanup audio context
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (inputStreamRef.current) {
      inputStreamRef.current.disconnect();
      inputStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    setIsRecording(false);
  };

  const handleSpeakerToggle = () => {
    setCurrentSpeaker(prev => prev === 'Customer' ? 'Agent' : 'Customer');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Call Simulator</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <span className={`w-2 h-2 rounded-full ${
                  microphoneStatus === 'ready' ? 'bg-green-500' :
                  microphoneStatus === 'pending' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className="text-sm text-gray-600">
                  Microphone: {microphoneStatus === 'ready' ? 'Ready' : 
                              microphoneStatus === 'pending' ? 'Initializing...' : 
                              'Off'}
                </span>
              </div>
              <span className="text-sm font-medium">Current Speaker:</span>
              <button
                onClick={handleSpeakerToggle}
                disabled={isRecording}
                className={`px-4 py-2 rounded-lg font-medium ${
                  currentSpeaker === 'Customer'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                } ${isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              >
                {currentSpeaker}
              </button>
            </div>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={microphoneStatus === 'off'}
              className={`px-6 py-2 rounded-lg font-semibold ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : microphoneStatus === 'off'
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } flex items-center gap-2`}
            >
              {isRecording ? (
                <>
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Stop Call
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Call
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-lg min-h-[400px] space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Live Call Transcript</h3>
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-gray-600">Recording as {currentSpeaker}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {transcriptions.length > 0 ? (
              transcriptions.map((item, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg ${
                    item.speaker === 'Customer'
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-green-50 border border-green-100'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-semibold text-sm ${
                      item.speaker === 'Customer' ? 'text-blue-700' : 'text-green-700'
                    }`}>
                      {item.speaker}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-gray-700">{item.text}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 italic">
                  {isRecording 
                    ? 'Listening... Start speaking.' 
                    : 'Click "Start Call" to begin the simulation.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceTranscriber; 