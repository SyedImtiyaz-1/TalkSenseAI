import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, User, Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import SideChatbot from '@/components/SideChatbot';

const CallSimulator = () => {
  // Call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [insights, setInsights] = useState([]);
  const [sentiment, setSentiment] = useState('neutral');
  const [selectedScenario, setSelectedScenario] = useState('customer_support');
  const [callContext, setCallContext] = useState({});
  const [isCustomerSpeaking, setIsCustomerSpeaking] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [error, setError] = useState(null); // Add error state

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState('customer');
  const mediaRecorderRef = useRef(null);
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  // Chat state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you with suggestions during the call.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scenarios = [
    { id: 'customer_support', name: 'Customer Support Issue' },
    { id: 'sales_inquiry', name: 'Sales Inquiry' },
    { id: 'technical_issue', name: 'Technical Issue' },
    { id: 'billing_question', name: 'Billing Question' },
  ];

  useEffect(() => {
    let timer;
    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCallActive, callDuration]);

  // Scroll to bottom effect for chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Update call context when relevant data changes
  useEffect(() => {
    const context = {
      isCallActive,
      callDuration,
      transcript,
      sentiment,
      scenario: selectedScenario
    };
    setCallContext(context);
    // Make context available globally for the SideChatbot
    window.callContext = context;
  }, [isCallActive, callDuration, transcript, sentiment, selectedScenario]);

  // Initialize audio recording and AWS Transcribe streaming
  useEffect(() => {
    if (!isCallActive) return;

    const initializeAudioRecording = async () => {
      try {
        console.log('Requesting microphone access...');
        // Request microphone access with specific constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 44100,
            sampleSize: 16,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('Microphone access granted');
        streamRef.current = stream;

        // Initialize AudioContext
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });

        // Create and load AudioWorklet
        const workletCode = `
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.bufferSize = 2048; // Increased buffer size for better streaming
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }

            process(inputs, outputs, parameters) {
              const input = inputs[0][0];
              if (!input) return true;

              // Fill buffer with input data
              for (let i = 0; i < input.length; i++) {
                this.buffer[this.bufferIndex++] = input[i];
                
                if (this.bufferIndex >= this.bufferSize) {
                  // Convert to 16-bit PCM
                  const pcmData = new Int16Array(this.bufferSize);
                  for (let j = 0; j < this.bufferSize; j++) {
                    // Scale to 16-bit range and convert to integer
                    pcmData[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
                  }
                  
                  // Send the buffer
                  this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
                  
                  // Reset buffer
                  this.buffer = new Float32Array(this.bufferSize);
                  this.bufferIndex = 0;
                }
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `;

        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        
        await audioContextRef.current.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        // Create audio source from microphone stream
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Create and connect AudioWorkletNode
        const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
        source.connect(workletNode);
        workletNode.connect(audioContextRef.current.destination);

        // Initialize WebSocket connection
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const wsPort = '8000';
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/transcribe`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        websocketRef.current = new WebSocket(wsUrl);

        websocketRef.current.onopen = () => {
          console.log('WebSocket connection established');
          setIsRecording(true);
          setError(null);
        };

        // Handle audio data from AudioWorklet
        workletNode.port.onmessage = (event) => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(event.data);
          }
        };

        websocketRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('Received transcription:', data);
          
          if (data.error) {
            console.error('Transcription error:', data.error);
            setError(data.error);
            toast.error('Transcription error: ' + data.error);
            return;
          }

          if (data.text) {
            const speakerPrefix = currentSpeaker === 'customer' ? 'Customer: ' : 'Agent: ';
            const transcriptText = data.text.trim();
            
            if (transcriptText) {
              setTranscript(prev => {
                const newText = `${speakerPrefix}${transcriptText}`;
                return prev ? `${prev}\n${newText}` : newText;
              });

              // Update insights based on transcript
              const insightType = currentSpeaker === 'customer' ? 'intent' : 'action';
              const insightText = currentSpeaker === 'customer' 
                ? 'Customer query detected' 
                : 'Agent response recorded';
              
              setInsights(prev => [...prev, { type: insightType, text: insightText }]);
              
              // Simple sentiment analysis
              const lowerText = transcriptText.toLowerCase();
              if (lowerText.includes('thank') || 
                  lowerText.includes('great') || 
                  lowerText.includes('good') ||
                  lowerText.includes('excellent') ||
                  lowerText.includes('perfect')) {
                setSentiment('positive');
              } else if (lowerText.includes('issue') || 
                        lowerText.includes('problem') || 
                        lowerText.includes('not working') ||
                        lowerText.includes('bad') ||
                        lowerText.includes('terrible')) {
                setSentiment('negative');
              }
            }
          }
        };

        websocketRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          const errorMsg = 'Error connecting to transcription service. Please try again.';
          setError(errorMsg);
          toast.error(errorMsg);
          stopRecording();
        };

        websocketRef.current.onclose = () => {
          console.log('WebSocket connection closed');
          setIsRecording(false);
          if (error) {
            toast.error('Connection closed due to an error');
          }
        };

      } catch (error) {
        console.error('Error initializing audio:', error);
        const errorMessage = error.name === 'NotAllowedError' 
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : 'Error accessing microphone. Please check your microphone connection and try again.';
        setError(errorMessage);
        stopRecording();
      }
    };

    initializeAudioRecording();

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
      }
      if (websocketRef.current) {
        websocketRef.current.close();
        console.log('WebSocket connection closed');
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        console.log('Audio context closed');
      }
    };
  }, [isCallActive, currentSpeaker]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoadingChat || !isCallActive) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoadingChat(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content,
          transcript: transcript
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const botMessage = { 
        role: 'assistant', 
        content: data.response || 'I apologize, but I couldn\'t generate a proper response at the moment.'
      };
      setMessages(prev => [...prev, botMessage]);

      // Update insights if provided
      if (data.analysis?.insight) {
        setInsights(prev => [...prev, { type: 'ai_suggestion', text: data.analysis.insight }]);
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsLoadingChat(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startCall = () => {
    setError(null); // Clear any previous errors
    setIsCallActive(true);
    setCallDuration(0);
    setTranscript('');
    setInsights([]);
    setSentiment('neutral');
    setMessages([
      {
        role: 'assistant',
        content: 'Call started. I\'ll provide suggestions as the conversation progresses.'
      }
    ]);
    setCurrentSpeaker('customer');
    setIsCustomerSpeaking(true);
    setIsAgentSpeaking(false);
  };

  const endCall = () => {
    setError(null); // Clear any errors
    setIsCallActive(false);
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsCustomerSpeaking(false);
    setIsAgentSpeaking(false);
  };

  const toggleSpeaker = () => {
    setCurrentSpeaker(prev => {
      const newSpeaker = prev === 'customer' ? 'agent' : 'customer';
      if (newSpeaker === 'customer') {
        setIsCustomerSpeaking(true);
        setIsAgentSpeaking(false);
      } else {
        setIsCustomerSpeaking(false);
        setIsAgentSpeaking(true);
      }
      
      // Update the current speaker state locally
      // We'll use this for new transcriptions
      return newSpeaker;
    });
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'intent':
        return 'text-blue-500';
      case 'entity':
        return 'text-purple-500';
      case 'sentiment':
        return 'text-green-500';
      case 'resolution':
        return 'text-yellow-500';
      case 'summary':
        return 'text-orange-500';
      case 'action':
        return 'text-pink-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSentimentColor = () => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Call Simulator</h1>
          <p className="text-muted-foreground">
            Practice customer interactions and analyze call performance in real-time.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[2fr,1fr,1fr]">
          <div className="flex flex-col gap-6">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Simulation Controls</CardTitle>
                <CardDescription>Manage your call session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                      </svg>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Button
                    onClick={isCallActive ? endCall : startCall}
                    variant={isCallActive ? "destructive" : "default"}
                    className={`${isCallActive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white w-full`}
                  >
                    {isCallActive ? "End Call" : "Start Call"}
                  </Button>
                  {isCallActive && (
                    <span className="text-sm text-muted-foreground">
                      Duration: {formatTime(callDuration)}
                    </span>
                  )}
                </div>

                {isCallActive && (
                  <div className="flex flex-col gap-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Current Speaker:</span>
                      <Button 
                        onClick={toggleSpeaker}
                        variant="outline"
                        className="flex gap-2 items-center"
                      >
                        {currentSpeaker === 'customer' ? (
                          <>
                            <User className="h-4 w-4" />
                            Customer
                          </>
                        ) : (
                          <>
                            <Bot className="h-4 w-4" />
                            Agent
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 p-2 rounded-md ${isCustomerSpeaking ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100'}`}>
                        <div className="flex items-center gap-2">
                          <User className={`h-4 w-4 ${isCustomerSpeaking ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={isCustomerSpeaking ? 'text-blue-600 font-medium' : 'text-gray-400'}>Customer</span>
                          {isCustomerSpeaking && isRecording && (
                            <span className="ml-auto flex gap-1">
                              <span className="animate-pulse h-2 w-2 bg-blue-600 rounded-full"></span>
                              <span className="animate-pulse delay-100 h-2 w-2 bg-blue-600 rounded-full"></span>
                              <span className="animate-pulse delay-200 h-2 w-2 bg-blue-600 rounded-full"></span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex-1 p-2 rounded-md ${isAgentSpeaking ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}>
                        <div className="flex items-center gap-2">
                          <Bot className={`h-4 w-4 ${isAgentSpeaking ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={isAgentSpeaking ? 'text-green-600 font-medium' : 'text-gray-400'}>Agent</span>
                          {isAgentSpeaking && isRecording && (
                            <span className="ml-auto flex gap-1">
                              <span className="animate-pulse h-2 w-2 bg-green-600 rounded-full"></span>
                              <span className="animate-pulse delay-100 h-2 w-2 bg-green-600 rounded-full"></span>
                              <span className="animate-pulse delay-200 h-2 w-2 bg-green-600 rounded-full"></span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {isRecording ? (
                          <>
                            <Mic className="h-4 w-4 animate-pulse" />
                            <span>Recording...</span>
                          </>
                        ) : (
                          <>
                            <MicOff className="h-4 w-4" />
                            <span>Microphone off</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Live Transcription</CardTitle>
                <CardDescription>Real-time conversation transcript</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="min-h-[400px] p-4 rounded-md bg-muted whitespace-pre-line border border-gray-200 overflow-y-auto">
                  {transcript || "Transcription will appear here..."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Real-time Insights</CardTitle>
                <CardDescription>AI-powered call analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                      <span className={`font-medium ${getInsightColor(insight.type)}`}>
                        {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}:
                      </span>
                      <span className="text-gray-700">{insight.text}</span>
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Insights will appear during the call
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Call Analytics</CardTitle>
                <CardDescription>Performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 rounded-md bg-muted/50">
                    <span className="text-sm font-medium">Sentiment:</span>
                    <span className={`ml-2 capitalize ${getSentimentColor()}`}>
                      {sentiment}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Customer Satisfaction</span>
                        <span className="text-sm text-muted-foreground">
                          {sentiment === 'positive' ? '80%' : sentiment === 'neutral' ? '50%' : '30%'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all duration-500"
                          style={{ width: `${sentiment === 'positive' ? 80 : sentiment === 'neutral' ? 50 : 30}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Agent Performance</span>
                        <span className="text-sm text-muted-foreground">75%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: '75%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Chatbot - Always visible */}
          <div className="flex flex-col gap-6">
            <div className="sticky top-4">
              <SideChatbot />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallSimulator; 