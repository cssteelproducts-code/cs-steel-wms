import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useLang } from '../context/LanguageContext';

const pageTitleKeys = {
  '/': 'page.dashboard',
  '/monitor': 'page.monitor',
  '/weigh-in': 'page.weighIn',
  '/data-station': 'page.dataStation',
  '/loading-station': 'page.loadingStation',
  '/checker': 'page.checker',
  '/weigh-out': 'page.weighOut',
  '/eta': 'page.eta',
  '/users': 'page.users',
  '/master': 'page.master',
  '/profile': 'page.profile',
  '/alerts': 'page.alerts',
  '/stock': 'page.stock',
  '/delivery': 'page.delivery',
};

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLang();
  const titleKey = pageTitleKeys[location.pathname];
  const title = titleKey ? t(titleKey) : 'CS.Smart';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
