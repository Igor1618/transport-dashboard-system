"use client";
import { useAuth } from "@/components/AuthProvider";
import { ShieldX } from "lucide-react";
import Link from "next/link";

const ROLE_HOME: Record<string, string> = {
  accountant: '/salary/summary',
  mechanic: '/maintenance',
  mechanic_senior: '/dashboard/mechanic',
  dispatcher: '/dispatch/wb',
  logist: '/hired',
  manager: '/tenders',
  economist: '/pnl',
  document_flow: '/contracts',
  director: '/dashboard',
  admin: '/dashboard',
  superadmin: '/dashboard',
};

export default function AccessDeniedPage() {
  const { effectiveRole, user } = useAuth();
  const role = effectiveRole || user?.role || 'accountant';
  const home = ROLE_HOME[role] || '/salary/summary';

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <ShieldX size={64} className="mx-auto text-red-400" />
        <h1 className="text-2xl font-bold">Нет доступа</h1>
        <p className="text-slate-400">У вас нет прав для просмотра этой страницы.</p>
        <Link href={home} className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
          На главную
        </Link>
      </div>
    </div>
  );
}
