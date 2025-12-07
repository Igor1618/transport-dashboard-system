import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, LoginRequest } from '../types';
import { login as loginApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response = await loginApi(credentials);
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;

      // Директор имеет доступ ко всему
      if (user.role === 'director') return true;

      // Проверка прав доступа по роли
      const rolePermissions: Record<string, string[]> = {
        manager: ['dashboard', 'trips', 'salary', 'vehicles', 'upload'],
        economist: ['dashboard', 'trips', 'salary'],
        accountant: ['dashboard', 'trips', 'salary', 'vehicles'], // Доступ ко всем разделам, но без финансовой информации
        mechanic: ['dashboard', 'vehicles'],
        dispatcher: ['dashboard', 'trips', 'upload', 'vehicles'],
      };

      const permissions = rolePermissions[user.role] || [];
      return permissions.includes(permission);
    },
    [user]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
