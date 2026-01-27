"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Truck, Users, FileText, Upload, 
  BarChart3, Settings, TrendingUp 
} from "lucide-react";

const menuItems = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/vehicles", label: "Машины", icon: Truck },
  { href: "/drivers", label: "Водители", icon: Users },
  { href: "/trips", label: "Рейсы", icon: FileText },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/ratings", label: "Рейтинги", icon: TrendingUp },
  { href: "/upload", label: "Загрузка", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 p-4">
      <div className="flex items-center gap-3 mb-8 px-2">
        <span className="text-2xl">🚛</span>
        <span className="text-xl font-bold text-white">TL196</span>
      </div>
      
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive 
                  ? "bg-blue-600 text-white" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-400">Лихачев Сергей</div>
          <div className="text-xs text-slate-500">Директор</div>
        </div>
      </div>
    </aside>
  );
}
