import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TripsPage from './pages/TripsPage';
import SalaryPage from './pages/SalaryPage';
import UploadPage from './pages/UploadPage';
import RoutesPage from './pages/RoutesPage';
import VehiclesPage from './pages/VehiclesPage';

// Компонент для защищенных маршрутов
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Страница логина */}
          <Route path="/login" element={<LoginPage />} />

          {/* Защищенные маршруты */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="salary" element={<SalaryPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="upload" element={<UploadPage />} />
          </Route>

          {/* Перенаправление на главную */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
