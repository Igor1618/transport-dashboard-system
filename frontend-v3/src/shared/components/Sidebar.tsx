"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, Truck, Users, FileText, Upload, 
  BarChart3, TrendingUp, Menu, X, LogOut, DollarSign, Fuel, Wallet, MapPin, Wrench, Bug, Brain,
  Navigation,
  Package,
  Calendar, Activity,
} from "lucide-react";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";

const menuItems = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["director", "accountant", "mechanic", "dispatcher"] },
  { href: "/vehicles", label: "Машины", icon: Truck, roles: ["director", "accountant", "mechanic", "dispatcher"] },
  { href: "/drivers", label: "Водители", icon: Users, roles: ["director", "accountant", "mechanic", "dispatcher"] },
  { href: "/reports", label: "Отчёты водителей", icon: FileText, roles: ["director", "accountant"] },
  { href: "/trips", label: "Рейсы", icon: FileText, roles: ["director", "accountant", "dispatcher"] },
  { href: "/fuel", label: "Топливо", icon: Fuel, roles: ["director", "accountant"] },
  { href: "/contracts", label: "Договоры 1С", icon: FileText, roles: ["director", "accountant"] },
  { href: "/salary", label: "Зарплата", icon: Wallet, roles: ["director", "accountant"] },
  { href: "/import-wb", label: "Загрузка WB", icon: Upload, roles: ["director", "accountant"] },
  { href: "/repair", label: "Ремонты", icon: Wrench, roles: ["director", "mechanic"] },
  { href: "/management", label: "Управление", icon: Users, roles: ["director", "mechanic", "dispatcher"] },
  { href: "/dispatch", label: "Диспетчерская", icon: MapPin, roles: ["director", "mechanic", "dispatcher"] },
  { href: "/dispatch/track", label: "Треки", icon: Navigation, roles: ["director", "mechanic", "dispatcher"] },
  { href: "/logistics/orders", label: "Логистика", icon: Package, roles: ["director", "logist", "docs_specialist", "dispatcher"] },
  { href: "/tenders", label: "Тендеры WB", icon: BarChart3, roles: ["director", "manager", "logist"] },
  { href: "/logistics/planning", label: "Планирование", icon: Calendar, roles: ["director", "logist", "dispatcher"] },
  { href: "/pnl", label: "P&L", icon: DollarSign, roles: ["director"] },
  { href: "/analytics", label: "AI-аналитика", icon: Brain, roles: ["director"] },
  { href: "/analytics/utilization", label: "Утилизация парка", icon: Activity, roles: ["director", "manager"] },
  { href: "/ati/loads", label: "ATI Грузы", icon: Truck, roles: ["director", "logist", "dispatcher"] },
  { href: "/geofences", label: "Геозоны", icon: MapPin, roles: ["director", "logist", "dispatcher"] },
  { href: "/parts", label: "Склад запчастей", icon: Package, roles: ["director", "mechanic"] },
  { href: "/analytics/drivers", label: "Рейтинг водителей", icon: Users, roles: ["director", "accountant"] },
  { href: "/admin/errors", label: "Ошибки", icon: Bug, roles: ["director"] },
  { href: "/users", label: "Пользователи", icon: Users, roles: ["director"] },
];

export function Sidebar() {
  const pathname = usePathname();
  useHotkeys();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setIsOpen(false); }, [pathname]);

  if (!mounted) return null;

  const visibleItems = menuItems.filter(item => 
    !item.roles || item.roles.includes(user?.role || "")
  );

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚛</span>
          <span className="text-lg font-bold text-white">TL196</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-400 hover:text-white">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />}

      <aside className={`fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0">
          <span className="text-2xl">🚛</span>
          <span className="text-xl font-bold text-white">TL196</span>
          <button onClick={() => setIsOpen(false)} className="lg:hidden ml-auto p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-slate-800 p-4">
          {user && (
            <div className="mb-3 px-2">
              <div className="text-sm text-white truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500">{user.role_display || ""}</div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1">
            <ThemeToggle /><NotificationBell />
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
            <span className="font-medium">Выход</span>
          </button>
        </div>
      </aside>
    </>
  );
}
