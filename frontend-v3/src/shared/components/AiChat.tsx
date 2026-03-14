'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const SUGGESTIONS = [
  '📊 Какая маржа за январь?',
  '🚛 Сколько машин в парке?',
  '⛽ Кто перерасходует топливо?',
  '👤 Кто лучший водитель?',
];

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          page: window.location.pathname,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: data.reply || data.error || 'Ошибка' }]);
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: '❌ Ошибка соединения' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-20 z-50 w-12 h-12 bg-purple-600 hover:bg-purple-500 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title="AI-помощник"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-20 z-50 w-96 h-[500px] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-purple-600/20 px-4 py-3 border-b border-slate-700 flex items-center gap-2 shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <div>
              <div className="text-white font-semibold text-sm">AI-помощник TL196</div>
              <div className="text-purple-300/60 text-xs">Задайте вопрос о данных</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2 mt-4">
                <div className="text-center text-slate-400 text-sm mb-4">Привет! Чем могу помочь?</div>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 bg-purple-600/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                }`}>
                  {m.loading ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="w-7 h-7 bg-blue-600/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(input)}
                placeholder="Спросите что-нибудь..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                disabled={loading}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
