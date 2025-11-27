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
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Дашборд', path: '/', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Рейсы', path: '/trips', icon: Truck, permission: 'trips' },
    { name: 'Зарплаты', path: '/salary', icon: DollarSign, permission: 'salary' },
    { name: 'Водители', path: '/drivers', icon: Users, permission: 'drivers' },
    { name: 'Загрузка', path: '/upload', icon: Upload, permission: 'upload' },
  ];

  const filteredMenuItems = menuItems.filter((item) => hasPermission(item.permission));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-indigo-900 text-white transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-indigo-800">
          {isSidebarOpen && <h1 className="text-xl font-bold">TL196</h1>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded hover:bg-indigo-800"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="mt-4">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center px-4 py-3 hover:bg-indigo-800 transition-colors"
              >
                <Icon size={20} />
                {isSidebarOpen && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-indigo-800">
          {isSidebarOpen && user && (
            <div className="mb-4">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-indigo-300">{user.role_display}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 hover:bg-indigo-800 rounded transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3">Выход</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
