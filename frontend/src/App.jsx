import { lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import MainLayout from './layouts/MainLayout';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/Login';

// All pages are lazy — separate JS chunks downloaded only when first navigated to.
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const TripMonitor    = lazy(() => import('./pages/TripMonitor'));
const Forecast       = lazy(() => import('./pages/Forecast'));
const ShiftPlanning  = lazy(() => import('./pages/ShiftPlanning'));
const FreightCalc    = lazy(() => import('./pages/FreightCalc'));
const WeighIn        = lazy(() => import('./pages/WeighIn'));
const DataStation    = lazy(() => import('./pages/DataStation'));
const LoadingStation = lazy(() => import('./pages/LoadingStation'));
const Checker        = lazy(() => import('./pages/Checker'));
const WeighOut       = lazy(() => import('./pages/WeighOut'));
const ETA            = lazy(() => import('./pages/ETA'));
const Users          = lazy(() => import('./pages/Users'));
const Master         = lazy(() => import('./pages/Master'));
const Profile        = lazy(() => import('./pages/Profile'));
const Alerts         = lazy(() => import('./pages/Alerts'));
const DeliveryPlan   = lazy(() => import('./pages/DeliveryPlan'));
const TMS            = lazy(() => import('./pages/TMS'));
const Transfer       = lazy(() => import('./pages/Transfer'));
const TransferDriver = lazy(() => import('./pages/TransferDriver'));
const Records        = lazy(() => import('./pages/Records'));
const LocationCheck  = lazy(() => import('./pages/LocationCheck'));
const StockCount     = lazy(() => import('./pages/StockCount'));
const Stock          = lazy(() => import('./pages/Stock'));


const ProtectedRoute = ({ children, menuCode, menuCodeAny }) => {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f1f5f9' }}>
      <LoadingSpinner size="xl" text="กำลังโหลดระบบ..." />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  const denied = (menuCode && !hasPermission(menuCode)) ||
                 (menuCodeAny && !menuCodeAny.some(c => hasPermission(c)));
  if (denied) {
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

// Preload all page chunks after login so navigation is instant
const LAZY_PAGES = [
  () => import('./pages/Dashboard'),      () => import('./pages/TripMonitor'),
  () => import('./pages/WeighIn'),        () => import('./pages/DataStation'),
  () => import('./pages/LoadingStation'), () => import('./pages/WeighOut'),
  () => import('./pages/Checker'),        () => import('./pages/Records'),
  () => import('./pages/Alerts'),         () => import('./pages/Users'),
  () => import('./pages/Master'),         () => import('./pages/Transfer'),
  () => import('./pages/TransferDriver'), () => import('./pages/Stock'),
  () => import('./pages/StockCount'),     () => import('./pages/LocationCheck'),
  () => import('./pages/DeliveryPlan'),   () => import('./pages/ETA'),
  () => import('./pages/Profile'),        () => import('./pages/Forecast'),
  () => import('./pages/ShiftPlanning'),  () => import('./pages/FreightCalc'),
  () => import('./pages/TMS'),
];

function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Delay 1.5s so initial data fetches (master data warmup) get bandwidth first
    const t = setTimeout(() => {
      LAZY_PAGES.forEach(load => load().catch(() => {}));
    }, 1500);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<ProtectedRoute menuCode="DASHBOARD"><Dashboard /></ProtectedRoute>} />
        <Route path="monitor" element={<ProtectedRoute menuCode="TRIP_MONITOR"><TripMonitor /></ProtectedRoute>} />
        <Route path="forecast" element={<ProtectedRoute menuCode="FORECAST"><Forecast /></ProtectedRoute>} />
        <Route path="shift-planning" element={<ProtectedRoute menuCode="SHIFT_PLANNING"><ShiftPlanning /></ProtectedRoute>} />
        <Route path="weigh-in" element={<ProtectedRoute menuCode="WEIGH_IN"><WeighIn /></ProtectedRoute>} />
        <Route path="data-station" element={<ProtectedRoute menuCode="DATA_STATION"><DataStation /></ProtectedRoute>} />
        <Route path="loading-station" element={<ProtectedRoute menuCode="LOADING_STATION"><LoadingStation /></ProtectedRoute>} />
        <Route path="checker" element={<ProtectedRoute menuCode="CHECKER"><Checker /></ProtectedRoute>} />
        <Route path="weigh-out" element={<ProtectedRoute menuCode="WEIGH_OUT"><WeighOut /></ProtectedRoute>} />
        <Route path="eta" element={<ProtectedRoute menuCode="ETA"><ETA /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute menuCode="USERS"><Users /></ProtectedRoute>} />
        <Route path="master" element={<ProtectedRoute menuCode="MASTER"><Master /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="alerts" element={<ProtectedRoute menuCode="ALERTS"><Alerts /></ProtectedRoute>} />
        <Route path="delivery" element={<ProtectedRoute menuCode="DELIVERY_PLAN"><DeliveryPlan /></ProtectedRoute>} />
        <Route path="transfer" element={<ProtectedRoute menuCode="TRANSFER"><Transfer /></ProtectedRoute>} />
        <Route path="transfer/driver" element={<ProtectedRoute menuCode="TRANSFER"><TransferDriver /></ProtectedRoute>} />
        <Route path="records" element={<ProtectedRoute menuCode="RECORDS"><Records /></ProtectedRoute>} />
        <Route path="location-check" element={<ProtectedRoute menuCode="STOCK"><LocationCheck /></ProtectedRoute>} />
        <Route path="freight-calc" element={<ProtectedRoute menuCode="FREIGHT_CALC"><FreightCalc /></ProtectedRoute>} />
        <Route path="stock-count" element={<ProtectedRoute menuCodeAny={['STOCKCOUNT_OFFICE', 'STOCKCOUNT_FIELD']}><StockCount /></ProtectedRoute>} />
        <Route path="stock" element={<ProtectedRoute menuCode="STOCK"><Stock /></ProtectedRoute>} />
        <Route path="tms" element={<ProtectedRoute menuCode="TMS"><TMS /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const loadingBarStyle = `
#global-loading-bar {
  position: fixed; top: 0; left: 0; width: 100%; height: 3px;
  background: linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #dc2626 100%);
  background-size: 200% 100%;
  z-index: 99999; opacity: 0; pointer-events: none;
  transition: opacity 0.15s ease;
}
#global-loading-bar.active {
  opacity: 1;
  animation: loading-sweep 1.2s linear infinite;
}
@keyframes loading-sweep {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
        <style>{loadingBarStyle}</style>
        <div id="global-loading-bar" />
        <AppRoutes />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 2500,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
              marginBottom: 'env(safe-area-inset-bottom, 0px)'
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } }
          }}
        />
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
