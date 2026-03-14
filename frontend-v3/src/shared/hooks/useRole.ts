'use client';

import { useAuth } from '@/components/AuthProvider';

export type UserRole = 'director' | 'accountant' | 'mechanic' | 'dispatcher';

// Матрица доступа к страницам
const PAGE_ACCESS: Record<string, UserRole[]> = {
  '/': ['director', 'accountant', 'mechanic', 'dispatcher'],
  '/vehicles': ['director', 'accountant', 'mechanic', 'dispatcher'],
  '/drivers': ['director', 'accountant', 'mechanic', 'dispatcher'],
  '/reports': ['director', 'accountant'],
  '/trips': ['director', 'accountant', 'dispatcher'],
  '/fuel': ['director', 'accountant'],
  '/salary': ['director', 'accountant'],
  '/import-wb': ['director', 'accountant'],
  '/repair': ['director', 'mechanic'],
  '/analytics': ['director'],
  '/management': ['director', 'mechanic', 'dispatcher'],
  '/dispatch': ['director', 'mechanic', 'dispatcher'],
  '/pnl': ['director'],
  '/admin/errors': ['director'],
};

// Пункты меню по ролям
const MENU_BY_ROLE: Record<UserRole, string[]> = {
  director: ['/', '/vehicles', '/drivers', '/reports', '/trips', '/fuel', '/salary', '/repair', '/analytics', '/management', '/dispatch', '/pnl', '/admin/errors'],
  accountant: ['/', '/vehicles', '/drivers', '/reports', '/trips', '/fuel', '/salary'],
  mechanic: ['/', '/vehicles', '/drivers', '/repair', '/management', '/dispatch'],
  dispatcher: ['/', '/vehicles', '/drivers', '/trips', '/management', '/dispatch'],
};

export function useRole() {
  const { user } = useAuth();
  const role = (user?.role || 'accountant') as UserRole;

  return {
    role,
    isDirector: role === 'director',
    
    // Может видеть эту страницу?
    canAccess: (path: string) => {
      const access = PAGE_ACCESS[path];
      if (!access) return true; // Нет ограничений → доступно
      return access.includes(role);
    },
    
    // Может видеть финансы?
    canSeeFinance: role === 'director',
    
    // Может видеть "к выплате" в отчёте?
    canSeePayout: role === 'director' || role === 'accountant',
    
    // Доступные пункты меню
    menuItems: MENU_BY_ROLE[role] || MENU_BY_ROLE.accountant,
  };
}
