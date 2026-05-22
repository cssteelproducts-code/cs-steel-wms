import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/ProtectedRoute';
import Layout       from './components/Layout';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Checkin      from './pages/Checkin';
import Checkout     from './pages/Checkout';
import DataStation  from './pages/DataStation';
import Loading      from './pages/Loading';
import STDMonitor   from './pages/STDMonitor';
import Tracking     from './pages/Tracking';
import Delivery     from './pages/Delivery/index';
import Data         from './pages/Data';
import Warehouse    from './pages/Warehouse';
import Transfer     from './pages/Transfer';
import ETA          from './pages/ETA';
import Users        from './pages/Users';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } });

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/"            element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/checkin"     element={<Checkin />} />
              <Route path="/checkout"    element={<Checkout />} />
              <Route path="/datastation" element={<DataStation />} />
              <Route path="/loading"     element={<Loading />} />
              <Route path="/stdmonitor"  element={<STDMonitor />} />
              <Route path="/tracking"    element={<Tracking />} />
              <Route path="/delivery/*"  element={<Delivery />} />
              <Route path="/data"        element={<Data />} />
              <Route path="/warehouse"   element={<Warehouse />} />
              <Route path="/transfer"    element={<Transfer />} />
              <Route path="/eta"         element={<ETA />} />
              <Route path="/users"       element={<Users />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
