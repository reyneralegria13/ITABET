import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { getSocket } from '@/lib/socket';

import MainLayout from '@/components/layout/MainLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminRoute from '@/components/auth/AdminRoute';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import SportsPage from '@/pages/SportsPage';
import LivePage from '@/pages/LivePage';
import GamePage from '@/pages/GamePage';
import WalletPage from '@/pages/WalletPage';
import BetHistoryPage from '@/pages/BetHistoryPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/admin/AdminPage';
import PromotionsPage from '@/pages/PromotionsPage';

function App() {
  const { isAuthenticated, user, updateBalance } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();

      const socket = getSocket();
      socket.on('balance:update', ({ balance, bonusBalance }) => {
        updateBalance(balance, bonusBalance);
      });

      return () => {
        socket.off('balance:update');
        disconnectSocket();
      };
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #1e293b',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="sports" element={<SportsPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="games/:id" element={<GamePage />} />
          <Route path="promotions" element={<PromotionsPage />} />
        </Route>

        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route
            path="login"
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />}
          />
          <Route
            path="register"
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />}
          />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="bets" element={<BetHistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route element={<MainLayout />}>
            <Route path="admin/*" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
