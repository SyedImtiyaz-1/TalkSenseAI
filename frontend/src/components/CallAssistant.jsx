import React from 'react';
import { useAudioStream } from '../context/AudioStreamContext';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

const CallAssistant = () => {
  const {
    connectionStatus,
    liveTranscript,
    finalTranscript,
    assistance,
    startAssistance,
    stopAssistance,
  } = useAudioStream();

  const isTranscribing = connectionStatus === 'connected' || connectionStatus === 'connecting';

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Real-Time Call Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button onClick={isTranscribing ? stopAssistance : startAssistance}>
            {isTranscribing ? 'Stop Assistance' : 'Start Assistance'}
          </Button>
          <p className="text-sm text-gray-500">Status: {connectionStatus}</p>
        </div>
        <div className="p-4 border rounded-md bg-gray-50 h-48 overflow-y-auto">
          <p>
            <span className="text-gray-600">{finalTranscript}</span>
            <span className="text-gray-400">{liveTranscript}</span>
          </p>
        </div>
        <div className="p-4 border rounded-md bg-blue-50 h-32 overflow-y-auto">
          <p className="text-blue-800">{assistance}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CallAssistant;