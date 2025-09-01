import React, { createContext, useState, useContext, useRef } from 'react';

const AudioStreamContext = createContext();

export const useAudioStream = () => useContext(AudioStreamContext);

export const AudioStreamProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [assistance, setAssistance] = useState('');

  const audioContextRef = useRef(null);
  const websocketRef = useRef(null);
  const audioStreamRef = useRef(null);

  const startAssistance = async () => {
    setConnectionStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
      });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      const socket = new WebSocket('ws://localhost:8000/ws/transcribe');
      websocketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus('connected');
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(workletNode).connect(audioContext.destination);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'transcript') {
          if (message.is_final) {
            setFinalTranscript(prev => prev + message.text + ' ');
            setLiveTranscript('');
          } else {
            setLiveTranscript(message.text);
          }
        } else if (message.type === 'assistance') {
          setAssistance(message.content);
        }
      };

      workletNode.port.onmessage = (event) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      socket.onclose = () => {
        setConnectionStatus('disconnected');
      };

      socket.onerror = () => {
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error("Failed to start assistance:", error);
      setConnectionStatus('error');
    }
  };

  const stopAssistance = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setConnectionStatus('disconnected');
    setLiveTranscript('');
    setFinalTranscript('');
    setAssistance('');
  };

  return (
    <AudioStreamContext.Provider value={{
      connectionStatus,
      liveTranscript,
      finalTranscript,
      assistance,
      startAssistance,
      stopAssistance
    }}>
      {children}
    </AudioStreamContext.Provider>
  );
};