import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function SideChatbot() {
  const [messages, setMessages] = React.useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you with this call?'
    }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  };

  React.useEffect(() => {
    // Only scroll on new messages, not on initial render
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages]);

  // Handle textarea height
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`;
    }
  }, [input]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get current call context from global variable
      const callContext = window.callContext || {};
      
      // Prepare the payload with context
      const payload = { 
        message: userMessage.content,
      };
      
      // Add transcript if available in the context
      if (callContext.transcript) {
        payload.transcript = callContext.transcript;
      } else if (callContext.transcription) {
        payload.transcript = callContext.transcription;
      }
      
      // Add other context data that might be useful
      if (callContext.scenario) {
        payload.scenario = callContext.scenario;
      }
      
      if (callContext.sentiment) {
        payload.sentiment = callContext.sentiment;
      }
      
      if (callContext.isCallActive !== undefined) {
        payload.isCallActive = callContext.isCallActive;
      }
      
      if (callContext.page) {
        payload.page = callContext.page;
      }
      
      // If we have files in the context, include them
      if (callContext.files && callContext.files.length > 0) {
        payload.files = callContext.files;
      }
      
      if (callContext.s3Files && callContext.s3Files.length > 0) {
        payload.s3Files = callContext.s3Files;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
        throw new Error(errorData.detail || 'Failed to get response from AI.');
      }

      const data = await response.json();
      const botMessage = { 
        role: 'assistant', 
        content: data.response || 'I apologize, but I couldn\'t generate a proper response at the moment.'
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      toast.error('Error: ' + error.message);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I encountered an error while processing your request. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
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

  return (
    <Card className="border shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 mb-2 max-h-[300px]">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-2 group text-sm",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 flex-shrink-0">
                  <Bot className="h-3 w-3" />
                </div>
              )}
              <div
                className={cn(
                  "px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap",
                  message.role === 'user'
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-800 rounded-bl-none"
                )}
              >
                {message.content}
              </div>
              {message.role === 'user' && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-600 text-white flex-shrink-0">
                  <User className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-px" />
        </div>
        
        <form 
          onSubmit={handleSubmit} 
          className="flex gap-2 mt-auto"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for help..."
            className="min-h-[36px] max-h-[80px] flex-1 text-sm resize-none rounded-md"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className={cn(
              "bg-blue-600 text-white hover:bg-blue-700 h-9 w-9 p-0 rounded-md flex items-center justify-center",
              isLoading && "opacity-80"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 