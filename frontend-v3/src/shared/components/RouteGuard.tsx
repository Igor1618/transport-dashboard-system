'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

const PAGE_ACCESS: Record<string, string[]> = {
  '/': ['director', 'accountant', 'mechanic', 'mechanic_senior', 'dispatcher', 'logist', 'admin', 'superadmin', 'manager', 'economist', 'document_flow'],
  '/dashboard': ['director', 'admin', 'superadmin'],
  '/dashboard/mechanic': ['director', 'mechanic', 'mechanic_senior', 'admin', 'superadmin'],
  '/command': ['director', 'admin', 'superadmin'],
  '/pnl': ['director', 'admin', 'superadmin', 'economist'],
  '/tenders': ['director', 'admin', 'superadmin'],
  '/dispatch': ['director', 'dispatcher', 'logist', 'mechanic_senior', 'admin', 'superadmin'],
  '/dispatch/new': ['director', 'dispatcher', 'logist', 'mechanic_senior', 'admin', 'superadmin'],
  '/dispatch/wb': ['director', 'dispatcher', 'logist', 'mechanic_senior', 'admin', 'superadmin'],
  '/dispatch/track': ['director', 'dispatcher', 'logist', 'admin', 'superadmin'],
  '/logistics': ['director', 'logist', 'dispatcher', 'document_flow', 'admin', 'superadmin'],
  '/logistics/workplace': ['director', 'logist', 'dispatcher', 'mechanic_senior', 'admin', 'superadmin'],
  '/logistics/tracking': ['director', 'logist', 'dispatcher', 'admin', 'superadmin'],
  '/trips': ['director', 'dispatcher', 'logist', 'admin', 'superadmin'],
  '/rates': ['director', 'logist', 'admin', 'superadmin'],
  '/geofences': ['director', 'dispatcher', 'logist', 'admin', 'superadmin'],
  '/vehicles': ['director', 'accountant', 'mechanic', 'mechanic_senior', 'admin', 'superadmin'],
  '/vehicles/unknown-plates': ['director', 'admin', 'superadmin'],
  '/drivers': ['director', 'accountant', 'dispatcher', 'mechanic_senior', 'admin', 'superadmin'],
  '/maintenance': ['director', 'mechanic', 'mechanic_senior', 'admin', 'superadmin'],
  '/parts': ['director', 'mechanic', 'mechanic_senior', 'admin', 'superadmin'],
  '/reports': ['director', 'accountant', 'mechanic_senior', 'admin', 'superadmin'],
  '/fuel': ['director', 'accountant', 'admin', 'superadmin'],
  '/fuel/cards': ['director', 'accountant', 'admin', 'superadmin'],
  '/fuel/comparison': ['director', 'accountant', 'admin', 'superadmin'],
  '/salary': ['director', 'accountant', 'admin', 'superadmin'],
  '/salary/summary': ['director', 'accountant', 'admin', 'superadmin'],
  '/salary/registers': ['director', 'accountant', 'admin', 'superadmin'],
  '/salary/enforcement': ['director', 'accountant', 'admin', 'superadmin'],
  '/planning': ['director', 'accountant', 'mechanic_senior', 'admin', 'superadmin'],
  '/revenue': ['director', 'accountant', 'admin', 'superadmin'],
  '/contracts': ['director', 'logist', 'document_flow', 'admin', 'superadmin'],
  '/import-wb': ['director', 'accountant', 'admin', 'superadmin'],
  '/hired': ['director', 'accountant', 'logist', 'admin', 'superadmin'],
  '/hired/audit': ['director', 'admin', 'superadmin'],
  '/hired/reconcile': ['director', 'admin', 'superadmin'],
  '/analytics': ['director', 'admin', 'superadmin'],
  '/ati': ['director', 'logist', 'admin', 'superadmin'],
  '/notifications': ['director', 'admin', 'superadmin'],
  '/admin': ['director', 'admin', 'superadmin'],
  '/users': ['director', 'admin', 'superadmin'],
  '/access-denied': ['director', 'accountant', 'mechanic', 'mechanic_senior', 'dispatcher', 'logist', 'admin', 'superadmin', 'manager', 'economist', 'document_flow'],
};

const ROLE_HOME: Record<string, string> = {
  accountant: '/salary/summary',
  mechanic: '/maintenance',
  mechanic_senior: '/dashboard/mechanic',
  dispatcher: '/dispatch/wb',
  logist: '/hired',
  manager: '/tenders',
  economist: '/pnl',
  document_flow: '/contracts',
};

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user || pathname === '/login' || pathname === '/access-denied') return;

    const role = effectiveRole || user.role || 'accountant';

    if (role === 'superadmin') return;
    if (role === 'admin') return;

    // Check exact path first, then base path
    const basePath = '/' + (pathname.split('/').filter(Boolean)[0] || '');
    const access = PAGE_ACCESS[pathname] || PAGE_ACCESS[basePath];

    if (access && !access.includes(role)) {
      const home = ROLE_HOME[role] || '/access-denied';
      router.push(home === pathname ? '/access-denied' : home);
    }
  }, [pathname, user, effectiveRole, router]);

  return <>{children}</>;
}
