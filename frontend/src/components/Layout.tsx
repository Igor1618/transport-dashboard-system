import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  Users,
  DollarSign,
  Upload,
  LogOut,
  Menu,
  X,
  Map,
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Дашборд', path: '/', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Рейсы', path: '/trips', icon: Truck, permission: 'trips' },
    { name: 'Автомобили', path: '/vehicles', icon: Truck, permission: 'trips' },
    { name: 'Зарплаты', path: '/salary', icon: DollarSign, permission: 'salary' },
    { name: 'Тарифы', path: '/routes', icon: Map, permission: 'salary' },
    { name: 'Пользователи', path: '/users', icon: Users, permission: 'dashboard' },
    { name: 'Загрузка', path: '/upload', icon: Upload, permission: 'upload' },
  ];

  const filteredMenuItems = menuItems.filter((item) => hasPermission(item.permission));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-[#1e1e2d] text-white p-4 flex items-center justify-between z-30 shadow-lg">
        <h1 className="text-xl font-bold">🚛 TL196</h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-white/20 transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile */}
      <aside
        className={`bg-[#1e1e2d] text-white transition-all duration-300 flex flex-col shadow-xl z-50
          ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 w-64' : 'fixed inset-y-0 left-0 -translate-x-full'}
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'md:w-64' : 'md:w-20'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {(isSidebarOpen || isMobileMenuOpen) && <h1 className="text-2xl font-bold drop-shadow-lg">🚛 TL196</h1>}
          <button
            onClick={() => {
              setIsSidebarOpen(!isSidebarOpen);
              setIsMobileMenuOpen(false);
            }}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors hidden md:block"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors md:hidden"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 hover:bg-white/10 rounded-lg mx-2 transition-all hover:translate-x-1 text-gray-300 hover:text-white"
              >
                <Icon size={20} />
                {(isSidebarOpen || isMobileMenuOpen) && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-700">
          {(isSidebarOpen || isMobileMenuOpen) && user && (
            <div className="mb-4">
              <p className="text-sm font-medium drop-shadow">{user.full_name}</p>
              <p className="text-xs text-white/70">{user.role_display}</p>
              <p className="text-[10px] text-gray-500 mt-1">v2.1 (Mobile Ready)</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
          >
            <LogOut size={20} />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="ml-3">Выход</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        <div className="container mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
