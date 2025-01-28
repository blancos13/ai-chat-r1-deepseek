'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, ChatMessage, Chat, GROQ_MODELS } from '../types/chat';
import { PlusIcon, SendIcon, MenuIcon, UserIcon, BotIcon, MoonIcon, SunIcon } from '@/components/Icons';

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState(GROQ_MODELS[0].id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chats');
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      // If there are chats, set the current chat to the most recent one
      if (parsedChats.length > 0) {
        setCurrentChat(parsedChats[0]);
        setSelectedModel(parsedChats[0].model);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save chats to localStorage when they change
  useEffect(() => {
    if (isLoaded && chats.length > 0) {
      localStorage.setItem('chats', JSON.stringify(chats));
    }
  }, [chats, isLoaded]);

  // Add dark mode effect
  useEffect(() => {
    // Set initial dark mode
    document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages, streamingMessage]);

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      model: selectedModel,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChat(newChat);
    setStreamingMessage('');
    setInput('');
    setIsModelSelectOpen(false);
  };

  const handleChatSelect = (chat: Chat) => {
    setCurrentChat(chat);
    setSelectedModel(chat.model);
    setStreamingMessage('');
    setInput('');
    setIsModelSelectOpen(false);
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setIsModelSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !currentChat) return;

    setIsLoading(true);
    setStreamingMessage('');

    const userMessage: Message = { role: 'user', content: input };
    const newMessage = { id: Date.now().toString(), message: userMessage };

    try {
      // If this is the first message, get the title first
      let chatTitle = currentChat.title;
      if (currentChat.messages.length === 0) {
        const titleResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: 'Generate a very short title (2-4 words) for a conversation that starts with this message. For example, if the user asks "How are you?", respond with "General Greeting". Only return the title, nothing else.'
              },
              {
                role: 'user',
                content: input
              }
            ],
            model: selectedModel,
          }),
        });

        if (titleResponse.ok) {
          const reader = titleResponse.body?.getReader();
          const decoder = new TextDecoder();
          let title = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              title += chunk;
            }

            // Clean up the title
            chatTitle = title.trim()
              .replace(/^["']|["']$/g, '') // Remove quotes if present
              .replace(/^Title:?\s*/i, '') // Remove "Title:" prefix if present
              .replace(/^\d+\.\s*/, '') // Remove leading numbers
              .replace(/^-\s*/, '') // Remove leading dash
              .trim();
          }
        }
      }

      // Update chat with new message and title
      const updatedChat = {
        ...currentChat,
        title: chatTitle,
        messages: [...currentChat.messages, newMessage],
        updatedAt: new Date()
      };

      setCurrentChat(updatedChat);
      setChats(prev => prev.map(chat => chat.id === currentChat.id ? updatedChat : chat));
      setInput('');

      // Get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedChat.messages.map(m => m.message),
          model: selectedModel,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let responseText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          responseText += chunk;
          setStreamingMessage(responseText);
        }

        const aiMessage: Message = {
          role: 'assistant',
          content: responseText,
        };

        const newAiMessage = { id: Date.now().toString(), message: aiMessage };
        const finalChat = {
          ...updatedChat,
          messages: [...updatedChat.messages, newAiMessage],
          updatedAt: new Date()
        };

        setCurrentChat(finalChat);
        setChats(prev => prev.map(chat => chat.id === currentChat.id ? finalChat : chat));
        setStreamingMessage('');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f0f]">
        <div className="text-white/80">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f0f0f]">
      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-[280px] sidebar transform transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={handleNewChat}
              className="modern-button flex items-center gap-2 w-full p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="font-medium">New Chat</span>
            </button>
          </div>

          {/* Model Selection */}
          <div className="px-4 mb-2">
            <div className="relative">
              <button
                onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                className="model-select-button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="icon-container">
                      <svg className="w-4 h-4 text-emerald-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
                              d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">
                      {GROQ_MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${isModelSelectOpen ? 'rotate-180' : ''}`} 
                       fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isModelSelectOpen && (
                <div className="dropdown-content absolute left-0 right-0 mt-2 glass-panel overflow-hidden z-50">
                  {GROQ_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className="model-option"
                    >
                      <div className="model-option-name">{model.name}</div>
                      <div className="model-option-details">
                        {model.developer} • {model.type} • {Math.round(model.contextWindow / 1000)}k context
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleChatSelect(chat)}
                className={`sidebar-item ${currentChat?.id === chat.id ? 'active' : ''}`}
              >
                <div className="icon-container">
                  <svg className="w-4 h-4 text-emerald-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="truncate">{chat.title}</div>
              </button>
            ))}
          </div>

          {/* User Section */}
          <div className="p-4 border-t border-white/10">
            <button className="sidebar-item w-full">
              <div className="icon-container">
                <UserIcon className="w-4 h-4 text-emerald-500/80" />
              </div>
              <span className="font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center p-4 bg-black/20 backdrop-blur-xl border-b border-white/10">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {!currentChat ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="icon-container w-20 h-20 mb-6">
                <svg className="w-10 h-10 text-emerald-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white/90 mb-2">Welcome to Groq Chat</h1>
              <p className="text-gray-400 max-w-sm">Start a new conversation or select an existing chat to begin</p>
            </div>
          ) : (
            <div className="chat-container">
              <div className="flex-1 px-4 py-6 space-y-6">
                {currentChat.messages.map(({ id, message }) => (
                  <div key={id} className="message-appear">
                    <div className="flex gap-4 max-w-3xl mx-auto">
                      <div className="icon-container flex-shrink-0">
                        {message.role === 'user' ? (
                          <UserIcon className="w-4 h-4 text-emerald-500/80" />
                        ) : (
                          <BotIcon className="w-4 h-4 text-emerald-500/80" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-400 mb-1">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className={`message-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}>
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="message-appear">
                    <div className="flex gap-4 max-w-3xl mx-auto">
                      <div className="icon-container flex-shrink-0">
                        <BotIcon className="w-4 h-4 text-emerald-500/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-400 mb-1">Assistant</div>
                        <div className="message-bubble assistant">
                          {streamingMessage}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-gradient-to-b from-transparent to-black/50">
          <div className="max-w-3xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                className="chat-input"
                disabled={isLoading || !currentChat}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !currentChat}
                className="modern-button absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </form>
            <div className="mt-2 text-center text-xs text-gray-500">
              {GROQ_MODELS.find(m => m.id === selectedModel)?.name} • 
              {Math.round((GROQ_MODELS.find(m => m.id === selectedModel)?.contextWindow || 0) / 1000)}k tokens
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 