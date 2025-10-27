
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, ExternalLink } from 'lucide-react';
import type { Message } from '../types';
import { geminiService } from '../services/geminiService';

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Olá! Eu sou o Assistente de Vistos da FedEx. Como posso ajudar hoje?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
    // Reset chat history when opening for a fresh start each time, can be changed.
    if (!isOpen) {
      geminiService.resetChat();
    }
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { text, sources } = await geminiService.sendChatMessage(inputValue);
      const botMessage: Message = {
        id: Date.now() + 1,
        text: text,
        sender: 'bot',
        sources: sources,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Desculpe, estou com problemas para me conectar no momento. Por favor, tente novamente mais tarde.",
        sender: 'bot',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 bg-purple-700 text-white p-4 rounded-full shadow-lg hover:bg-purple-800 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 z-50"
        aria-label="Abrir Chat"
      >
        <MessageSquare className="w-8 h-8" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[calc(100%-3rem)] sm:w-96 h-[70vh] max-h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-in-up">
      <header className="bg-purple-700 text-white p-4 flex justify-between items-center rounded-t-2xl">
        <h3 className="font-bold text-lg">Assistente de Vistos FedEx</h3>
        <button onClick={toggleChat} className="hover:bg-purple-600 p-1 rounded-full" aria-label="Fechar Chat">
          <X className="w-6 h-6" />
        </button>
      </header>
      
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="flex flex-col space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-purple-700" /></div>}
              <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-orange-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow-sm'}`}>
                <p className="text-sm">{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">Fontes:</h4>
                        <ul className="space-y-1">
                            {msg.sources.map((source, index) => (
                                <li key={index}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3"/>
                                        {source.title || new URL(source.uri).hostname}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
              </div>
              {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-orange-500" /></div>}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-end gap-2 justify-start">
               <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-purple-700" /></div>
                <div className="max-w-[80%] p-3 rounded-2xl bg-white text-gray-800 rounded-bl-none shadow-sm flex items-center">
                  <Loader2 className="w-5 h-5 text-purple-700 animate-spin" />
                </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <footer className="p-3 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Faça uma pergunta..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
          <button onClick={handleSendMessage} disabled={isLoading || inputValue.trim() === ''} className="bg-purple-700 text-white p-2.5 rounded-full hover:bg-purple-800 disabled:bg-gray-300 transition-colors">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Chatbot;