import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useLang } from '../context/LanguageContext';

const pageTitles = {
  '/':                  { title: 'page.dashboard' },
  '/monitor':           { title: 'page.monitor' },
  '/weigh-in':          { title: 'page.weighIn' },
  '/data-station':      { title: 'page.dataStation' },
  '/loading-station':   { title: 'page.loadingStation' },
  '/checker':           { title: 'page.checker' },
  '/weigh-out':         { title: 'page.weighOut' },
  '/eta':               { title: 'page.eta' },
  '/users':             { title: 'page.users' },
  '/master':            { title: 'page.master' },
  '/profile':           { title: 'page.profile' },
  '/alerts':            { title: 'page.alerts' },
  '/stock':             { title: 'page.stock' },
  '/delivery':          { title: 'page.delivery' },
  '/transfer':          { title: 'ระบบย้ายสินค้าภายใน', subtitle: 'ควบคุมการขนย้ายสินค้าจากฝ่ายผลิตไปยังคลังสินค้า' },
  '/transfer/driver':   { title: 'ระบบย้ายสินค้าภายใน', subtitle: 'ควบคุมการขนย้ายสินค้าจากฝ่ายผลิตไปยังคลังสินค้า' },
  '/records':           { title: 'บันทึกการขึ้นสินค้า' },
  '/forecast':          { title: 'วิเคราะห์และวางแผนล่วงหน้า' },
};

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLang();
  const pageInfo = pageTitles[location.pathname];
  const title = pageInfo ? (pageInfo.title.startsWith('page.') ? t(pageInfo.title) : pageInfo.title) : 'CS.Smart';
  const subtitle = pageInfo?.subtitle || null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
