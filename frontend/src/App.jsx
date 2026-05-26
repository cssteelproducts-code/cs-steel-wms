import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import LoadingSpinner from './components/LoadingSpinner';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripMonitor from './pages/TripMonitor';
import WeighIn from './pages/WeighIn';
import DataStation from './pages/DataStation';
import LoadingStation from './pages/LoadingStation';
import Checker from './pages/Checker';
import WeighOut from './pages/WeighOut';
import ETA from './pages/ETA';
import Users from './pages/Users';
import Master from './pages/Master';

const ProtectedRoute = ({ children, menuCode }) => {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-steel-900">
      <LoadingSpinner size="xl" text="กำลังโหลดระบบ..." />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (menuCode && !hasPermission(menuCode)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-red-400 font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <p className="text-steel-500 text-sm mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<ProtectedRoute menuCode="DASHBOARD"><Dashboard /></ProtectedRoute>} />
        <Route path="monitor" element={<ProtectedRoute menuCode="TRIP_MONITOR"><TripMonitor /></ProtectedRoute>} />
        <Route path="weigh-in" element={<ProtectedRoute menuCode="WEIGH_IN"><WeighIn /></ProtectedRoute>} />
        <Route path="data-station" element={<ProtectedRoute menuCode="DATA_STATION"><DataStation /></ProtectedRoute>} />
        <Route path="loading-station" element={<ProtectedRoute menuCode="LOADING_STATION"><LoadingStation /></ProtectedRoute>} />
        <Route path="checker" element={<ProtectedRoute menuCode="CHECKER"><Checker /></ProtectedRoute>} />
        <Route path="weigh-out" element={<ProtectedRoute menuCode="WEIGH_OUT"><WeighOut /></ProtectedRoute>} />
        <Route path="eta" element={<ProtectedRoute menuCode="ETA"><ETA /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute menuCode="USERS"><Users /></ProtectedRoute>} />
        <Route path="master" element={<ProtectedRoute menuCode="MASTER"><Master /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px'
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
