import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Chatbot() {
  const [messages, setMessages] = React.useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you with questions about call insights and related topics. How can I help you today?'
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content })
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
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b via-white">
      <Card className="max-w-2xl w-full h-[90dvh] sm:h-[80dvh] shadow-2xl border-0 sm:rounded-2xl rounded-none overflow-hidden bg-white m-auto">
        <CardHeader className="bg-white border-b border-border px-4 py-3 flex-none">
          <CardTitle className="text-xl sm:text-2xl font-bold">AI Chatbot</CardTitle>
          <CardDescription className="text-base sm:text-lg">
            Chat with our AI assistant about call-related insights and questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 h-[calc(100%-4rem)] overflow-hidden">
          <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 bg-gradient-to-b from-white/80 to-blue-50 space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-end gap-2 sm:gap-3 group animate-slideIn",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 shadow-md border border-blue-200 flex-shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                <div
                  className={cn(
                    "px-4 py-2 rounded-2xl shadow-md max-w-[85vw] sm:max-w-[70%] text-base transition-all duration-300 whitespace-pre-wrap",
                    message.role === 'user'
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-blue-900 border border-blue-100 rounded-bl-md"
                  )}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-md border border-blue-300 flex-shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} className="h-px" />
          </div>
          
          <form 
            onSubmit={handleSubmit} 
            className="flex-none bg-white/90 backdrop-blur border-t border-border flex gap-2 px-2 sm:px-6 py-3"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send, Shift + Enter for new line)"
              className="min-h-[44px] max-h-[120px] flex-1 bg-muted/50 text-base resize-none rounded-xl border border-blue-200 focus:border-blue-400 focus:ring-blue-200 shadow-sm"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className={cn(
                "bg-blue-600 text-white hover:bg-blue-700 w-14 h-12 rounded-xl flex items-center justify-center text-base shadow-lg transition-all duration-200 flex-none",
                isLoading && "opacity-80"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Send className="h-6 w-6" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 