'use client';

import { useState, useEffect, useCallback } from 'react';

interface PinScreenProps {
  userId: number;
  userName: string;
  userRole: string;
  needsSetup: boolean;
  onSuccess: () => void;
  onLogout: () => void;
}

export default function PinScreen({ userId, userName, userRole, needsSetup, onSuccess, onLogout }: PinScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phase, setPhase] = useState<'enter' | 'confirm' | 'verify'>(needsSetup ? 'enter' : 'verify');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  const title = phase === 'enter' ? 'Установите PIN-код' :
    phase === 'confirm' ? 'Повторите PIN-код' :
    'Введите PIN-код';

  const subtitle = phase === 'enter' ? 'Придумайте 4-значный код для быстрого входа' :
    phase === 'confirm' ? 'Введите PIN ещё раз для подтверждения' :
    '';

  const currentPin = phase === 'confirm' ? confirmPin : pin;
  const setCurrentPin = phase === 'confirm' ? setConfirmPin : setPin;

  const doShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleVerify = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code, user_id: userId }),
      });
      const data = await r.json();
      if (data.success) {
        onSuccess();
      } else if (data.error === 'blocked') {
        setBlocked(data.blocked_until);
        setError('Слишком много попыток');
        doShake();
      } else {
        setAttemptsLeft(data.attempts_left ?? 0);
        setError(data.attempts_left > 0 ? `Неверный PIN (осталось ${data.attempts_left})` : 'Неверный PIN');
        doShake();
      }
    } catch {
      setError('Ошибка сервера');
    } finally {
      setLoading(false);
      setPin('');
    }
  }, [userId, onSuccess, doShake]);

  const handleSetPin = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code, user_id: userId }),
      });
      const data = await r.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Ошибка');
        doShake();
      }
    } catch {
      setError('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  }, [userId, onSuccess, doShake]);

  // Auto-verify/submit on 4th digit
  useEffect(() => {
    if (currentPin.length === 4) {
      setError('');
      if (phase === 'verify') {
        handleVerify(currentPin);
      } else if (phase === 'enter') {
        // Move to confirm
        setTimeout(() => {
          setPhase('confirm');
          setConfirmPin('');
        }, 200);
      } else if (phase === 'confirm') {
        if (confirmPin === pin) {
          handleSetPin(pin);
        } else {
          setError('PIN не совпадает');
          doShake();
          setTimeout(() => {
            setPhase('enter');
            setPin('');
            setConfirmPin('');
          }, 1000);
        }
      }
    }
  }, [currentPin]);

  // Block countdown
  useEffect(() => {
    if (!blocked) return;
    const iv = setInterval(() => {
      if (new Date(blocked) <= new Date()) {
        setBlocked(null);
        setError('');
        setAttemptsLeft(3);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [blocked]);

  const pressDigit = (d: string) => {
    if (loading || blocked) return;
    if (currentPin.length < 4) {
      setCurrentPin(currentPin + d);
      setError('');
    }
  };

  const pressBack = () => {
    if (loading) return;
    setCurrentPin(currentPin.slice(0, -1));
    setError('');
  };

  const blockedRemaining = blocked ? Math.max(0, Math.ceil((new Date(blocked).getTime() - Date.now()) / 1000)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center">
      <div className="w-full max-w-xs mx-auto text-center px-4">
        {/* Lock icon */}
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-xl font-bold text-white mb-1">TL196</div>
        <div className="text-sm text-slate-400 mb-6">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mb-4 -mt-4">{subtitle}</div>}

        {/* Dots */}
        <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
              error && shake ? 'bg-red-500' :
              i < currentPin.length ? 'bg-white scale-110' : 'bg-slate-600'
            }`} />
          ))}
        </div>

        {/* Error */}
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        {blocked && <div className="text-yellow-400 text-sm mb-3">Заблокировано: {Math.floor(blockedRemaining / 60)}:{String(blockedRemaining % 60).padStart(2, '0')}</div>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(key => (
            <button
              key={key}
              onClick={() => {
                if (key === '⌫') pressBack();
                else if (key === '✓') { /* auto-submit on 4th */ }
                else pressDigit(key);
              }}
              disabled={loading || !!blocked}
              className={`h-16 rounded-xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-40 ${
                key === '⌫' ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' :
                key === '✓' ? 'bg-slate-700 text-green-400 hover:bg-slate-600' :
                'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* User info + logout */}
        <div className="text-sm text-slate-500">{userName} ({userRole})</div>
        <button onClick={onLogout} className="text-sm text-slate-600 hover:text-slate-400 mt-2 transition">
          ← Выйти
        </button>
      </div>

      {/* Shake animation */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
