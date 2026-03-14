"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, Truck as TruckIcon, Users, FileText, Upload, 
  BarChart3, Menu, X, LogOut, DollarSign, Fuel, Wallet, MapPin, Wrench, Bug, Brain,
  Navigation, Package, Calendar, Target, Activity, Bell, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

/**
 * Role-based menu: each role sees only relevant items (max ~7).
 * admin/superadmin see FULL_MENU with groups.
 */
const ROLE_MENUS: Record<string, { href: string; label: string; icon: any }[]> = {
  director: [
    { href: "/command", label: "🎯 Командный центр", icon: Target },
    { href: "/pnl", label: "📊 P&L", icon: DollarSign },
    { href: "/tenders", label: "📦 Тендеры WB", icon: BarChart3 },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/fuel", label: "⛽ Топливо", icon: Fuel },
    { href: "/fuel/cards", label: "🔗 Карты", icon: Fuel },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
    { href: "/maintenance", label: "🔧 ТО и ремонт", icon: Wrench },
    { href: "/geofences", label: "📍 Геозоны", icon: MapPin },
    { href: "/parts", label: "📦 Запчасти", icon: Package },
    { href: "/ati/loads", label: "🚛 ATI Грузы", icon: TruckIcon },
    { href: "/analytics/drivers", label: "👷 Рейтинг", icon: Users },
    { href: "/analytics/utilization", label: "📊 Утилизация", icon: Activity },
    { href: "/salary/summary", label: "💰 Зарплата", icon: Wallet },
    { href: "/salary/registers", label: "📋 Реестры ЗП", icon: Wallet },
    { href: "/salary/enforcement", label: "⚖️ Исп. листы", icon: Wallet },
    { href: "/hired", label: "🚛 Наёмный транспорт", icon: TruckIcon },
    { href: "/notifications", label: "🔔 Уведомления", icon: Target },
  ],
  logist: [
    { href: "/hired", label: "🚛 Наёмный транспорт", icon: TruckIcon },
    { href: "/dispatch/new", label: "📡 Мониторинг GPS", icon: Navigation },
    { href: "/dispatch/track", label: "🗺️ GPS-треки", icon: MapPin },
    { href: "/dispatch/wb", label: "🚛 Диспетчерская WB", icon: TruckIcon },
    { href: "/logistics/workplace", label: "🚛 Рабочее место", icon: Package },
    { href: "/rates", label: "💰 Тарифы", icon: DollarSign },
  ],
  dispatcher: [
    { href: "/dispatch/new", label: "📡 Диспетчерская", icon: Navigation },
    { label: "Диспетчерская", href: "/dispatch/wb", icon: "🚛" },
    { label: "Автозагрузка WB", href: "/settings/wb-import", icon: "📥" },
    { href: "/dispatch/track", label: "🗺️ GPS-треки", icon: MapPin },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
    { href: "/trips", label: "🛣️ Рейсы", icon: FileText },
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/hired", label: "🚛 Наёмный транспорт", icon: TruckIcon },
    { href: "/planning", label: "📅 Планирование", icon: Wallet },
  ],
  mechanic: [
    { href: "/maintenance", label: "🔧 ТО и ремонт", icon: Wrench },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/parts", label: "📦 Запчасти", icon: Package },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
    { href: "/fuel", label: "⛽ Топливо", icon: Fuel },
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/logistics/workplace", label: "📍 GPS / Карта", icon: MapPin },
    { href: "/planning", label: "📅 Планирование", icon: Wallet },
  ],
  mechanic_senior: [
    { href: "/dashboard/mechanic", label: "🏠 Дашборд механика", icon: Wrench },
    { href: "/maintenance", label: "🔧 ТО и ремонт", icon: Wrench },    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },    { href: "/parts", label: "📦 Запчасти", icon: Package },    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },    { href: "/reports", label: "📋 Отчёты", icon: FileText },    { href: "/dispatch/wb", label: "🚛 Диспетчерская WB", icon: TruckIcon },    { href: "/dispatch/new", label: "📡 Мониторинг GPS", icon: MapPin },    { href: "/logistics/workplace", label: "📍 GPS / Карта", icon: MapPin },
    { href: "/planning", label: "📅 Планирование", icon: Wallet },
  ],
  accountant: [
    { href: "/hired/accounting", label: "📊 Учёт наёмных", icon: TruckIcon },
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/fuel", label: "⛽ Топливо", icon: Fuel },
    { href: "/fuel/cards", label: "🔗 Карты", icon: Fuel },
    { href: "/salary/summary", label: "💰 Зарплата", icon: Wallet },
    { href: "/salary/registers", label: "📋 Реестры ЗП", icon: Wallet },
    { href: "/salary/enforcement", label: "⚖️ Исп. листы", icon: Wallet },
    { href: "/import-wb", label: "📦 Загрузка WB", icon: Upload },
    { href: "/hired", label: "🚛 Наёмный транспорт", icon: TruckIcon },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
  ],
  manager: [
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
    { href: "/trips", label: "🛣️ Рейсы", icon: FileText },
  ],
  docs_specialist: [
    { href: "/reports", label: "📋 Отчёты", icon: FileText },
    { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon },
    { href: "/drivers", label: "👨‍✈️ Водители", icon: Users },
  ],
};

/** Full menu for admin/superadmin — grouped */
interface MenuItem { href: string; label: string; icon: any; group?: string; }
const FULL_MENU: MenuItem[] = [
  // 📊 УПРАВЛЕНИЕ
  { href: "/command", label: "🎯 Командный центр", icon: Target, group: "📊 УПРАВЛЕНИЕ" },
  { href: "/pnl", label: "📊 P&L", icon: DollarSign, group: "📊 УПРАВЛЕНИЕ" },
  { href: "/tenders", label: "📦 Тендеры WB", icon: BarChart3, group: "📊 УПРАВЛЕНИЕ" },
  // 🚛 ЛОГИСТИКА
  { href: "/dispatch/new", label: "📡 Мониторинг GPS", icon: Navigation, group: "🚛 ЛОГИСТИКА" },
  { href: "/dispatch/track", label: "🗺️ GPS-треки", icon: Navigation, group: "🚛 ЛОГИСТИКА" },
  { href: "/dispatch/wb", label: "🚛 Диспетчерская", icon: Navigation, group: "🚛 ЛОГИСТИКА" },
  { href: "/logistics/workplace", label: "🚛 Рабочее место", icon: Package, group: "🚛 ЛОГИСТИКА" },
  { href: "/logistics/tracking", label: "🛤️ Трекинг", icon: Navigation, group: "🚛 ЛОГИСТИКА" },
  { href: "/trips", label: "🛣️ Рейсы", icon: FileText, group: "🚛 ЛОГИСТИКА" },
  { href: "/rates", label: "💰 Тарифы", icon: DollarSign, group: "🚛 ЛОГИСТИКА" },
  { href: "/geofences", label: "📍 Геозоны", icon: MapPin, group: "🚛 ЛОГИСТИКА" },
  // 🚗 ПАРК
  { href: "/vehicles", label: "🚗 Машины", icon: TruckIcon, group: "🚗 ПАРК" },
  { href: "/vehicles/unknown-plates", label: "⚠️ Неопознанные", icon: TruckIcon, group: "🚗 ПАРК" },
  { href: "/drivers", label: "👨‍✈️ Водители", icon: Users, group: "🚗 ПАРК" },
  { href: "/maintenance", label: "🔧 ТО и ремонт", icon: Wrench, group: "🚗 ПАРК" },
  { href: "/parts", label: "📦 Запчасти", icon: Package, group: "🚗 ПАРК" },
  // 📋 УЧЁТ
  { href: "/reports", label: "📋 Отчёты", icon: FileText, group: "📋 УЧЁТ" },
  { href: "/fuel", label: "⛽ Топливо", icon: Fuel, group: "📋 УЧЁТ" },
  { href: "/fuel/cards", label: "🔗 Топл. карты", icon: Fuel, group: "📋 УЧЁТ" },
    { href: "/fuel/comparison", label: "⛽ Расход GPS/Отчёт", icon: Fuel, group: "📋 УЧЁТ" },
  { href: "/salary/summary", label: "💰 Зарплата", icon: Wallet, group: "📋 УЧЁТ" },
  { href: "/planning", label: "📅 Планирование", icon: Wallet, group: "📋 УЧЁТ" },
  { href: "/salary/registers", label: "📋 Реестры ЗП", icon: Wallet, group: "📋 УЧЁТ" },
    { href: "/salary/enforcement", label: "⚖️ Исп. листы", icon: Wallet },
  { href: "/revenue/registries", label: "💳 Реестры WB", icon: DollarSign, group: "📋 УЧЁТ" },
  
  { href: "/import-wb", label: "📤 Загрузка WB", icon: Upload, group: "📋 УЧЁТ" },
  // 📈 АНАЛИТИКА
  { href: "/analytics/drivers", label: "👷 Рейтинг водителей", icon: Users, group: "📈 АНАЛИТИКА" },
  { href: "/hired", label: "🚛 Наёмный транспорт", icon: TruckIcon, group: "📋 УЧЁТ" },
  { href: "/hired/accounting", label: "📊 Учёт наёмных", icon: TruckIcon, group: "📋 УЧЁТ" },
  
  
  { href: "/analytics/utilization", label: "📊 Утилизация", icon: Activity, group: "📈 АНАЛИТИКА" },
  // 🔗 ИНТЕГРАЦИИ
  { href: "/ati/loads", label: "🚛 ATI Грузы", icon: TruckIcon, group: "🔗 ИНТЕГРАЦИИ" },
  // ⚙️ СИСТЕМА
  { href: "/notifications", label: "🔔 Уведомления", icon: Bell, group: "⚙️ СИСТЕМА" },
  { href: "/users", label: "👥 Пользователи", icon: Users, group: "⚙️ СИСТЕМА" },

];

function getMenuForRole(role: string) {
  if (["superadmin", "admin", "director"].includes(role)) return FULL_MENU;
  return ROLE_MENUS[role] || FULL_MENU;
}

export function Sidebar() {
  const pathname = usePathname();
  useHotkeys();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, logout, effectiveRole } = useAuth();
  const [, forceUpdate] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setIsOpen(false); }, [pathname]);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('role-switch', handler);
    return () => window.removeEventListener('role-switch', handler);
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  if (!mounted) return null;

  const role = effectiveRole || user?.role || '';
  const menuItems = getMenuForRole(role);
  const isGrouped = ["superadmin", "admin", "director"].includes(role);
  const hasBanner = user?.role === 'superadmin' && role !== 'superadmin';

  // Build grouped structure
  const groups: { name: string; items: MenuItem[] }[] = [];
  if (isGrouped) {
    let currentGroup = "";
    for (const item of menuItems as MenuItem[]) {
      const g = item.group || "";
      if (g !== currentGroup) {
        groups.push({ name: g, items: [] });
        currentGroup = g;
      }
      groups[groups.length - 1].items.push(item);
    }
  }

  const roleDisplay = ["admin", "superadmin"].includes(role) ? `👑 ${role}` : 
    (role !== user?.role ? `👁 ${role}` : role);

  return (
    <>
      <header className={`lg:hidden fixed left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50 ${hasBanner ? 'top-8' : 'top-0'}`}>
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
        
        <nav className="flex-1 overflow-y-auto px-4 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {isGrouped ? (
            groups.map((group) => {
              const isCollapsed = collapsed[group.name];
              const hasActive = group.items.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')));
              return (
                <div key={group.name}>
                  <button 
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pt-3 pb-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{group.name}</span>
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {!isCollapsed && group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })
          ) : (
            menuItems.map((item: any) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })
          )}
        </nav>

        <div className="flex-shrink-0 border-t border-slate-800 p-4">
          {user && (
            <div className="mb-3 px-2">
              <div className="text-sm text-white truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500">{roleDisplay}</div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1 mb-2">
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
