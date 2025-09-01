import React from 'react';
import { getWsBaseUrl } from '@/lib/api';
import { Mic, Square, Play, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import SideChatbot from '@/components/SideChatbot';

// Helper to format time
const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function VoiceTranscriber() {
  const [isRecording, setIsRecording] = React.useState(false);
    const [transcription, setTranscription] = React.useState([]);
    const [interimTranscription, setInterimTranscription] = React.useState('');
  const [error, setError] = React.useState(null);
    const [isProcessing, setIsProcessing] = React.useState(false); // To keep track of initial connection
    const [elapsedTime, setElapsedTime] = React.useState(0);
    
    const wsRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
    const timerRef = React.useRef(null);

  // Update call context when transcription changes
  React.useEffect(() => {
    const context = {
      isRecording,
      elapsedTime,
      transcription: transcription.join(' '),
      interimTranscription
    };
    // Make context available globally for the SideChatbot
    window.callContext = context;
  }, [isRecording, elapsedTime, transcription, interimTranscription]);

  const startRecording = async () => {
    try {
            setIsProcessing(true);
            setError(null);
            setTranscription([]);
            setInterimTranscription('');
            setElapsedTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Connect to WebSocket endpoint
            const wsBaseUrl = getWsBaseUrl();
            const websocketUrl = `${wsBaseUrl}/ws/transcribe`;
            wsRef.current = new WebSocket(websocketUrl);
            
            wsRef.current.onopen = () => {
                console.log("WebSocket connection opened");
      mediaRecorderRef.current = new MediaRecorder(stream);
                
                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0 && wsRef.current.readyState === WebSocket.OPEN) {
                        // Send audio data as a blob
                        wsRef.current.send(event.data);
                    }
                };
                
                mediaRecorderRef.current.onstart = () => {
                    setIsRecording(true);
                    setIsProcessing(false);
                    // Start timer
                    timerRef.current = setInterval(() => {
                        setElapsedTime(prev => prev + 1);
                    }, 1000);
                };

      mediaRecorderRef.current.onstop = () => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        // Send a closing message to the server
                        wsRef.current.send(JSON.stringify({ type: 'END_OF_STREAM' }));
                    }
                    clearInterval(timerRef.current);
                    setIsRecording(false);
                };
                
                // Start recording, sending data every second
                mediaRecorderRef.current.start(1000); 
            };
            
            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.is_final) {
                    setTranscription(prev => [...prev, data.text]);
                    setInterimTranscription('');
                } else {
                    setInterimTranscription(data.text);
                }
            };
            
            wsRef.current.onerror = (err) => {
                console.error("WebSocket error:", err);
                setError("WebSocket connection error. Make sure the backend is running.");
                setIsProcessing(false);
                setIsRecording(false);
                clearInterval(timerRef.current);
            };

            wsRef.current.onclose = () => {
                console.log("WebSocket connection closed");
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
                }
            };

    } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to start recording. Please check microphone permissions.');
      setIsProcessing(false);
    }
  };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
    };

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-8">
        <div>
                    <h1 className="text-2xl font-bold">Real-time Speech-to-Text</h1>
          <p className="text-muted-foreground mt-2">
                        Click "Start Recording" and speak. Your words will be transcribed in real-time.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr,1fr,300px]">
          {/* Recording Section */}
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-6">
              <div className="space-y-4">
                                <h2 className="text-xl font-semibold">Recorder</h2>
                <div className="flex justify-center gap-4">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      className="w-full"
                      disabled={isProcessing}
                    >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Recording
                                                </>
                                            )}
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                  )}
                </div>

                                <div className="text-center text-2xl font-mono">
                                    {formatTime(elapsedTime)}
                  </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transcription Section */}
          <div className="space-y-4">
                        <div className="border border-border rounded-lg p-6 min-h-[200px]">
                            <h2 className="text-xl font-semibold mb-4">Transcription</h2>
                            <div className="space-y-2">
                                {transcription.map((text, index) => (
                                    <p key={index}>{text}</p>
                                ))}
                                {interimTranscription && (
                                    <p className="text-muted-foreground">{interimTranscription}</p>
                                )}
                                {!isRecording && transcription.length === 0 && !interimTranscription && (
                  <div className="text-center text-muted-foreground py-8">
                                        Start recording to see live transcription.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Chatbot - Always visible */}
          <div className="space-y-4">
            <div className="sticky top-4">
              <SideChatbot />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 