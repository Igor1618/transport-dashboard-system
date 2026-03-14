'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import PinScreen from '@/components/PinScreen';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_display: string;
}

interface AuthContextType {
  user: User | null;
  logout: () => void;
  loading: boolean;
  /** Effective role for UI (emulated role for superadmin, or real role) */
  effectiveRole: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: () => {},
  loading: true,
  effectiveRole: '',
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emulatedRole, setEmulatedRole] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinNeeded, setPinNeeded] = useState(false);
  const [pinSetup, setPinSetup] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      if (u.role === 'superadmin') {
        const saved = localStorage.getItem('emulated_role');
        if (saved && saved !== 'superadmin') setEmulatedRole(saved);
      }
      // Check PIN status
      fetch('/api/auth/pin-status?user_id=' + u.id)
        .then(r => r.json())
        .then(d => {
          if (d.needs_setup) { setPinNeeded(true); setPinSetup(true); }
          else if (d.pin_required) { setPinNeeded(true); setPinSetup(false); }
          else { setPinVerified(true); }
          setPinChecked(true);
        })
        .catch(() => { setPinVerified(true); setPinChecked(true); });
    } else {
      setPinChecked(true);
    }
    setLoading(false);
  }, []);

  // Activity tracker — update last_activity_at every 5 min
  useEffect(() => {
    if (!user || !pinVerified) return;
    const update = () => {
      fetch('/api/auth/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => {});
    };
    update(); // immediate
    const iv = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user, pinVerified]);

  // Listen for role-switch events from RoleSwitcher
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('emulated_role');
      setEmulatedRole(saved && saved !== 'superadmin' ? saved : null);
    };
    window.addEventListener('role-switch', handler);
    return () => window.removeEventListener('role-switch', handler);
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('emulated_role');
    setUser(null);
    setEmulatedRole(null);
    router.push('/login');
  }, [router]);

  // Effective role: emulated role for superadmin, otherwise real role
  const effectiveRole = user?.role === 'superadmin'
    ? (emulatedRole || 'superadmin')
    : (user?.role || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  // Show PIN screen if needed
  if (user && pinChecked && pinNeeded && !pinVerified && pathname !== '/login') {
    return (
      <AuthContext.Provider value={{ user, logout, loading, effectiveRole }}>
        <PinScreen
          userId={user.id}
          userName={user.full_name}
          userRole={user.role_display || user.role}
          needsSetup={pinSetup}
          onSuccess={() => { setPinVerified(true); setPinNeeded(false); }}
          onLogout={logout}
        />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, logout, loading, effectiveRole }}>
      {children}
    </AuthContext.Provider>
  );
}
