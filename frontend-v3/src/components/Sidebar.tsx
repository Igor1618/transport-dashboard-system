"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, Truck, Users, FileText, Upload, 
  BarChart3, TrendingUp, Menu, X, LogOut, DollarSign, Fuel, Wallet
} from "lucide-react";
import { useAuth } from "./AuthProvider";

const menuItems = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard, roles: ["director", "manager", "economist"] },
  { href: "/vehicles", label: "Машины", icon: Truck, roles: ["director", "manager", "accountant", "mechanic", "dispatcher"] },
  { href: "/drivers", label: "Водители", icon: Users, roles: ["director", "manager", "accountant", "dispatcher"] },
  { href: "/reports", label: "Отчёты водителей", icon: FileText, roles: ["director", "manager", "accountant", "economist"] },
  { href: "/trips", label: "Рейсы", icon: FileText, roles: ["director", "manager", "accountant", "economist", "dispatcher"] },
  { href: "/analytics", label: "Аналитика", icon: BarChart3, roles: ["director", "manager", "economist"] },
  { href: "/ratings", label: "Рейтинги", icon: TrendingUp, roles: ["director", "manager"] },
  { href: "/rates", label: "Тарифы", icon: DollarSign, roles: ["director", "accountant", "economist"] },
  { href: "/fuel", label: "Топливо", icon: Fuel, roles: ["director", "manager", "accountant", "economist"] },
  { href: "/salary", label: "Зарплата", icon: Wallet, roles: ["director", "accountant", "economist"] },
  { href: "/import-wb", label: "Загрузка WB", icon: Upload, roles: ["director", "manager", "accountant", "dispatcher"] },
  { href: "/users", label: "Пользователи", icon: Users, roles: ["director"] },
];

export function Sidebar() {
  const pathname = usePathname();
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

      <aside className={`fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 p-4 z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex items-center gap-3 mb-8 px-2 pt-2 lg:pt-0">
          <span className="text-2xl">🚛</span>
          <span className="text-xl font-bold text-white">TL196</span>
          <button onClick={() => setIsOpen(false)} className="lg:hidden ml-auto p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          {user && (
            <div className="mb-3 px-2">
              <div className="text-sm text-white truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500">{user.role_display || ""}</div>
            </div>
          )}
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выход</span>
          </button>
        </div>
      </aside>
    </>
  );
}
