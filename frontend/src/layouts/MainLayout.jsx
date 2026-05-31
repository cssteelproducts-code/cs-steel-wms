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
  '/transfer':          { title: 'page.transfer', subtitle: 'page.transferSubtitle' },
  '/transfer/driver':   { title: 'page.transferDriver', subtitle: 'page.transferSubtitle' },
  '/records':           { title: 'page.records' },
  '/forecast':          { title: 'page.forecast' },
  '/shift-planning':    { title: 'page.shiftPlanning' },
  '/freight-calc':      { title: 'page.freightCalc', subtitle: 'page.freightCalcSubtitle' },
  '/location-check':    { title: 'page.locationCheck', subtitle: 'page.locationCheckSubtitle' },
  '/stock-count':       { title: 'page.stockCount', subtitle: 'page.stockCountSubtitle' },
};

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLang();
  const pageInfo = pageTitles[location.pathname];
  const title = pageInfo ? t(pageInfo.title) : 'CS.Smart';
  const subtitle = pageInfo?.subtitle ? t(pageInfo.subtitle) : null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-scroll p-5 lg:p-6" style={{ background: '#f1f5f9' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
