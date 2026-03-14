'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { RoleSwitcher } from './RoleSwitcher';
import { ReactNode } from 'react';

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <RoleSwitcher />
      <main className="pt-14 lg:pt-0 lg:ml-64 p-4 lg:p-6 min-h-screen">
        {children}
      </main>
    </>
  );
}
