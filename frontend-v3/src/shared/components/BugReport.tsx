'use client';

import { useState } from 'react';
import { Bug, X, Send } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export function BugReport() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          url: window.location.href,
          user_agent: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          screenshot: null,
        }),
      });
      setSent(true);
      setText('');
      setTimeout(() => { setSent(false); setOpen(false); }, 2000);
    } catch {}
    setSending(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title="Сообщить об ошибке"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Bug className="w-5 h-5 text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-red-600/20 px-4 py-3 border-b border-slate-700">
            <div className="text-white font-semibold flex items-center gap-2">
              <Bug className="w-4 h-4" /> Сообщить об ошибке
            </div>
            <div className="text-slate-400 text-xs mt-0.5">Опишите что пошло не так</div>
          </div>

          {sent ? (
            <div className="p-6 text-center">
              <div className="text-green-400 text-lg mb-1">✅ Отправлено!</div>
              <div className="text-slate-400 text-sm">Спасибо за обратную связь</div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Опишите ошибку..."
                className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-500"
                autoFocus
              />
              
              <div className="text-slate-500 text-xs">
                📍 {typeof window !== 'undefined' ? window.location.pathname : ''}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={!text.trim() || sending}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-sm text-white"
                >
                  <Send className="w-4 h-4" /> {sending ? '...' : 'Отправить'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
