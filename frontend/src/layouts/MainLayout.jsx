import { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useLang } from '../context/LanguageContext';
import { showBar, hideBar } from '../services/api';

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
  '/tms':               { title: 'ระบบวางแผนขนส่ง (TMS)' },
};

const PageFallback = () => {
  useEffect(() => { showBar(); return () => hideBar(); }, []);
  return null;
};

export default function MainLayout() {
  const location = useLocation();
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('wms_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('wms_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  const pageInfo = pageTitles[location.pathname];
  const title = pageInfo ? t(pageInfo.title) : 'CS.Smart';
  const subtitle = pageInfo?.subtitle ? t(pageInfo.subtitle) : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop only, sticky at viewport level */}
      <Sidebar collapsed={collapsed} onToggle={toggleCollapse} />

      {/* Main area — no overflow on this column so position:fixed modals cover full viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />

        <main
          className="flex-1 p-4 lg:p-6 pb-[72px] lg:pb-6"
          style={{ background: '#f1f5f9' }}
        >
          <Suspense fallback={<PageFallback />}>
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>

      {/* Bottom navigation — mobile/tablet only */}
      <BottomNav />
    </div>
  );
}
