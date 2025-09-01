import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chatbot from './pages/Chatbot';
import VoiceTranscriber from './pages/VoiceTranscriber';
import CallSimulator from './pages/CallSimulator';
import DataManager from './pages/DataManager';
import { Toaster } from 'sonner';
import { AudioStreamProvider } from './context/AudioStreamContext';
import CallAssistant from './components/CallAssistant';

function App() {
  return (
    <Router>
      <AudioStreamProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path="/voice-transcriber" element={<VoiceTranscriber />} />
            <Route path="/call-simulator" element={<CallSimulator />} />
            <Route path="/data-manager" element={<DataManager />} />
          </Routes>
          <div className="fixed bottom-4 right-4">
            <CallAssistant />
          </div>
        </Layout>
      </AudioStreamProvider>
      <Toaster richColors position="top-center" />
    </Router>
  );
}

export default App;
