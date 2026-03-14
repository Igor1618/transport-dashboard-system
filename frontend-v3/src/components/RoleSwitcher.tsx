'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Eye, X, ChevronDown } from 'lucide-react';

/** Default landing page per role */
const ROLE_HOME: Record<string, string> = {
  superadmin: '/command',
  admin: '/command',
  director: '/dashboard',
  logist: '/hired',
  dispatcher: '/dispatch/new',
  mechanic: '/maintenance',
  mechanic_senior: '/maintenance',
  accountant: '/reports',
  manager: '/dashboard',
  docs_specialist: '/logistics/orders',
};

const EMULABLE_ROLES = [
  { value: 'superadmin', label: '👑 Суперадмин (все права)' },
  { value: 'admin', label: '🔑 Администратор' },
  { value: 'director', label: '📊 Директор' },
  { value: 'logist', label: '📦 Логист' },
  { value: 'dispatcher', label: '🚛 Диспетчер' },
  { value: 'mechanic', label: '🔧 Механик' },
  { value: 'mechanic_senior', label: '🔧 Кол. механик' },
  { value: 'accountant', label: '💰 Бухгалтер' },
  { value: 'manager', label: '👤 Менеджер' },
  { value: 'docs_specialist', label: '📋 Документовед' },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  EMULABLE_ROLES.map(r => [r.value, r.label])
);

export function RoleSwitcher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [emulatedRole, setEmulatedRole] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load saved emulated role
  useEffect(() => {
    try {
      const saved = localStorage.getItem('emulated_role');
      if (saved && saved !== 'superadmin') setEmulatedRole(saved);
    } catch {}
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const router = useRouter();

  if (!user || user.role !== 'superadmin') return null;

  const selectRole = (role: string) => {
    if (role === 'superadmin') {
      setEmulatedRole(null);
      localStorage.removeItem('emulated_role');
    } else {
      setEmulatedRole(role);
      localStorage.setItem('emulated_role', role);
    }
    setOpen(false);
    window.dispatchEvent(new Event('role-switch'));
    // Redirect to role's home page
    router.push(ROLE_HOME[role] || '/dashboard');
  };

  const clearEmulation = () => {
    setEmulatedRole(null);
    localStorage.removeItem('emulated_role');
    window.dispatchEvent(new Event('role-switch'));
    router.push(ROLE_HOME['superadmin'] || '/command');
  };

  return (
    <>
      {/* Emulation banner */}
      {emulatedRole && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/90 text-black text-center py-1.5 text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          <span>Режим просмотра: {ROLE_LABELS[emulatedRole] || emulatedRole}</span>
          <button onClick={clearEmulation} className="ml-2 p-0.5 rounded hover:bg-amber-600/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dropdown trigger */}
      <div ref={ref} className={`fixed z-[61] ${emulatedRole ? 'top-9' : 'top-2'} right-4 transition-all`}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{emulatedRole ? ROLE_LABELS[emulatedRole]?.split(' ')[0] : '👑'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {EMULABLE_ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => selectRole(r.value)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  (emulatedRole === r.value || (!emulatedRole && r.value === 'superadmin'))
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
