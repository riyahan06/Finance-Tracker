import { useState, useCallback, useEffect, useRef } from 'react';
import { useTextGeneration } from '../hooks/useSharedAI';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

type VoiceGender = 'male' | 'female';

interface SpeakingState {
  messageId: string;
  text: string;
  currentIndex: number;
  isPaused: boolean;
}

const STORAGE_KEY = 'aiChatbotMessages';

function getFinanceContext(): { balance: number; transactions: string } {
  try {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const budgets = JSON.parse(localStorage.getItem('budgets') || '{}');
    
    const income = transactions.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
    const expenses = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
    const netBalance = income - expenses;
    
    const recentTx = transactions.slice(0, 10).map((t: any) => 
      `${t.type}: ${t.description} $${t.amount.toFixed(2)}${t.category ? ` (${t.category})` : ''}`
    ).join(', ');
    
    return {
      balance: netBalance,
      transactions: recentTx || 'No recent transactions'
    };
  } catch {
    return { balance: 0, transactions: 'No transaction data' };
  }
}

export function AIChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // TTS State
  const [selectedVoice, setSelectedVoice] = useState<VoiceGender>('female');
  const [speakingState, setSpeakingState] = useState<SpeakingState | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const { generate, isReady: getIsReady, state: modelState } = useTextGeneration();
  const isReady = getIsReady();

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Get preferred voice based on gender selection
  const getPreferredVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    
    if (selectedVoice === 'female') {
      return voices.find(v => 
        v.name.includes('Female') || 
        v.name.includes('Samantha') || 
        v.name.includes('Zira') ||
        v.name.includes('Microsoft Zira')
      ) || voices[0] || null;
    } else {
      return voices.find(v => 
        v.name.includes('Male') || 
        v.name.includes('Daniel') || 
        v.name.includes('David') ||
        v.name.includes('Microsoft David')
      ) || voices[0] || null;
    }
  }, [availableVoices, selectedVoice]);

  // Speak text with highlighting
  const speakText = useCallback((messageId: string, text: string) => {
    window.speechSynthesis.cancel();
    
    const voice = getPreferredVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 0.9;
    utterance.pitch = selectedVoice === 'female' ? 1.1 : 0.9;
    
    // Split text into words for highlighting
    const words = text.split(/(\s+)/);
    let currentIndex = 0;
    
    utterance.onstart = () => {
      setSpeakingState({ messageId, text, currentIndex: 0, isPaused: false });
    };
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        currentIndex = event.charIndex;
        setSpeakingState(prev => prev ? { ...prev, currentIndex } : null);
      }
    };
    
    utterance.onend = () => {
      setSpeakingState(null);
    };
    
    utterance.onerror = () => {
      setSpeakingState(null);
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getPreferredVoice, selectedVoice]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingState(null);
  }, []);

  // Toggle play/stop for a message
  const toggleSpeak = useCallback((message: ChatMessage) => {
    if (speakingState?.messageId === message.id) {
      stopSpeaking();
    } else {
      speakText(message.id, message.text);
    }
  }, [speakingState, speakText, stopSpeaking]);

  // Highlighted text component
  const HighlightedText = ({ text, currentIndex }: { text: string; currentIndex: number }) => {
    const beforeIndex = text.slice(0, currentIndex);
    const currentChar = text[currentIndex] || '';
    const afterIndex = text.slice(currentIndex + 1);
    
    return (
      <>
        <span style={{ color: 'rgba(241, 245, 249, 0.5)' }}>{beforeIndex}</span>
        <span className="highlight-text">{currentChar}</span>
        <span>{afterIndex}</span>
      </>
    );
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load chat messages:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { balance, transactions: txList } = getFinanceContext();
      
      const history = messages.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
      
      const systemPrompt = `You are a helpful Finance Assistant. Use the user's current balance and recent transactions to answer questions accurately. Keep answers short and professional. Current net balance: $${balance.toFixed(2)}. Recent transactions: ${txList}.`;
      
      const fullPrompt = `${systemPrompt}\n\nConversation:\n${history}\nUser: ${userMessage.text}\n\nProvide a helpful, concise response.`;

      const response = await generate(fullPrompt, {
        maxTokens: 150,
        temperature: 0.7
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, generate]);

  const handleClear = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const { balance } = getFinanceContext();

  return (
    <div className="ai-chatbot-page">
      <style>{`
        .ai-chatbot-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 140px);
          max-width: 800px;
          margin: 0 auto;
          padding: 16px;
        }

        .chat-header {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(59, 130, 246, 0.3));
          border-radius: 12px;
          padding: 16px 20px;
          border: 2px solid rgba(34, 197, 94, 0.5);
          margin-bottom: 16px;
        }

        .chat-header h2 {
          margin: 0 0 4px 0;
          font-size: 18px;
          color: #F1F5F9;
        }

        .chat-header p {
          margin: 0;
          font-size: 13px;
          color: #94A3B8;
        }

        .chat-context {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-context-item {
          font-size: 12px;
          color: #94A3B8;
        }

        .chat-context-value {
          font-size: 14px;
          font-weight: 600;
          color: ${balance >= 0 ? '#22C55E' : '#EF4444'};
        }

        .chat-status {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          background: ${isReady ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
          color: ${isReady ? '#22C55E' : '#F59E0B'};
          border: 1px solid ${isReady ? '#22C55E' : '#F59E0B'};
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-message {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .chat-message.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #8B5CF6, #6366F1);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .chat-message.assistant {
          align-self: flex-start;
          background: rgba(15, 23, 42, 0.8);
          color: #F1F5F9;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom-left-radius: 4px;
        }

        .chat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748B;
          text-align: center;
        }

        .chat-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .chat-input-container {
          margin-top: 16px;
          display: flex;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.8);
          color: #F1F5F9;
          font-size: 14px;
          outline: none;
        }

        .chat-input:focus {
          border-color: rgba(139, 92, 246, 0.5);
        }

        .chat-input::placeholder {
          color: #64748B;
        }

        .chat-send-btn {
          padding: 14px 24px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #8B5CF6, #6366F1);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-clear-btn {
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(100, 116, 139, 0.3);
          color: #94A3B8;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-clear-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
          border-color: #EF4444;
        }

        .chat-loading {
          align-self: flex-start;
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          color: #64748B;
          font-size: 13px;
        }

        /* Voice Controls */
        .voice-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .voice-selector {
          display: flex;
          gap: 4px;
        }

        .voice-btn {
          padding: 4px 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: transparent;
          color: #64748B;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .voice-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #94A3B8;
        }

        .voice-btn.active {
          background: rgba(139, 92, 246, 0.3);
          border-color: #8B5CF6;
          color: #A78BFA;
        }

        .speak-btn {
          padding: 4px 10px;
          border: none;
          border-radius: 6px;
          background: rgba(34, 197, 94, 0.2);
          color: #22C55E;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .speak-btn:hover {
          background: rgba(34, 197, 94, 0.3);
          transform: scale(1.05);
        }

        .speak-btn.speaking {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
        }

        .speak-btn.speaking:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .highlight-text {
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.5));
          background-size: 200% 100%;
          animation: highlightWave 1s ease-in-out infinite;
          border-radius: 2px;
          padding: 1px 0;
        }

        @keyframes highlightWave {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .message-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .inline-speak-btn {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: #64748B;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.7;
        }

        .inline-speak-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.1);
        }

        .inline-speak-btn.speaking {
          color: #EF4444;
          opacity: 1;
        }
      `}</style>

      <div className="chat-header">
        <h2>💬 AI Finance Chatbot</h2>
        <p>Ask questions about your finances in natural language</p>
        <div className="chat-context">
          <div>
            <div className="chat-context-item">Net Balance</div>
            <div className="chat-context-value">${Math.abs(balance).toFixed(2)} {balance < 0 ? '(Debt)' : ''}</div>
          </div>
          <div className="chat-status">
            {isReady ? '✓ AI Ready' : 'Loading...'}
          </div>
        </div>
        <div className="voice-controls">
          <span style={{ fontSize: '11px', color: '#64748B' }}>Voice:</span>
          <div className="voice-selector">
            <button 
              className={`voice-btn ${selectedVoice === 'female' ? 'active' : ''}`}
              onClick={() => setSelectedVoice('female')}
              title="Female Voice"
            >
              👩
            </button>
            <button 
              className={`voice-btn ${selectedVoice === 'male' ? 'active' : ''}`}
              onClick={() => setSelectedVoice('male')}
              title="Male Voice"
            >
              👨
            </button>
          </div>
          {speakingState && (
            <button 
              className="speak-btn speaking"
              onClick={stopSpeaking}
              style={{ marginLeft: 'auto' }}
            >
              ⏹️ Stop
            </button>
          )}
        </div>
      </div>

        <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div>Ask me about your finances!</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              "How much did I spend on Food?"<br />
              "Give me a savings plan"<br />
              "What's my top expense category?"
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && speakingState?.messageId === msg.id ? (
                  <HighlightedText text={msg.text} currentIndex={speakingState.currentIndex} />
                ) : (
                  msg.text
                )}
                {msg.role === 'assistant' && (
                  <div className="message-actions">
                    <button 
                      className={`inline-speak-btn ${speakingState?.messageId === msg.id ? 'speaking' : ''}`}
                      onClick={() => toggleSpeak(msg)}
                      title={speakingState?.messageId === msg.id ? 'Stop reading' : 'Read aloud'}
                    >
                      {speakingState?.messageId === msg.id ? '⏹️' : '🔊'} 
                      {speakingState?.messageId === msg.id ? ' Stop' : ' Read'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="chat-loading">
                🤖 Syncing with Local Data...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask about your finances..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
        />
        <button 
          className="chat-clear-btn"
          onClick={handleClear}
          title="Clear chat"
        >
          🗑️
        </button>
        <button 
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
