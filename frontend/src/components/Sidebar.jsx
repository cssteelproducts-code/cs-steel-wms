import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  LayoutDashboard, Scale, FileText, Package, CheckSquare, TruckIcon,
  MapPin, Users, Settings, X, Activity,
  Bell, Boxes, Route, ArrowLeftRight, ClipboardList
} from 'lucide-react';
import logoImg from '../assets/Logo.png';

const menuItems = [
  { path: '/', icon: LayoutDashboard, key: 'nav.dashboard', code: 'DASHBOARD' },
  { path: '/monitor', icon: Activity, key: 'nav.monitor', code: 'TRIP_MONITOR' },
  { key: 'section.station', divider: true },
  { path: '/weigh-in', icon: Scale, key: 'nav.weighIn', code: 'WEIGH_IN' },
  { path: '/data-station', icon: FileText, key: 'nav.dataStation', code: 'DATA_STATION' },
  { path: '/loading-station', icon: Package, key: 'nav.loadingStation', code: 'LOADING_STATION' },
  { path: '/weigh-out', icon: TruckIcon, key: 'nav.weighOut', code: 'WEIGH_OUT' },
  { path: '/checker', icon: CheckSquare, key: 'nav.checker', code: 'CHECKER' },
  { path: '/records', icon: ClipboardList, key: 'nav.records', code: 'RECORDS' },
  { key: 'section.warehouse', divider: true },
  { path: '/stock', icon: Boxes, key: 'nav.stock', code: 'STOCK' },
  { path: '/delivery', icon: Route, key: 'nav.delivery', code: 'DELIVERY_PLAN' },
  { path: '/transfer', icon: ArrowLeftRight, key: 'nav.transfer', code: 'TRANSFER' },
  { key: 'section.system', divider: true },
  { path: '/alerts', icon: Bell, key: 'nav.alerts', code: 'ALERTS' },
  { path: '/eta', icon: MapPin, key: 'nav.eta', code: 'ETA' },
  { path: '/users', icon: Users, key: 'nav.users', code: 'USERS' },
  { path: '/master', icon: Settings, key: 'nav.master', code: 'MASTER' }
];

export default function Sidebar({ isOpen, onClose }) {
  const { hasPermission } = useAuth();
  const { t } = useLang();

  const visibleItems = menuItems.filter(item => {
    if (item.divider) return true;
    return hasPermission(item.code, 'canView');
  });

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 z-50
        flex flex-col transition-transform duration-300 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{
        background: '#ffffff',
        borderRight: '1px solid #e8eaed',
        boxShadow: '2px 0 16px rgba(0,0,0,0.06)',
      }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #f0f2f5' }}>
          <div className="flex-1 flex justify-center">
            <img src={logoImg} alt="CS.Smart" className="w-auto object-contain" style={{ height: 58 }} />
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}>
            <X size={15} />
          </button>
        </div>

        {/* Red brand accent line */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)',
          flexShrink: 0,
        }} />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-5 pb-2 flex items-center gap-2">
                  <div style={{ flex: 1, height: 1, background: '#f0f2f5' }} />
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{ color: '#b0b8c8' }}>
                    {t(item.key)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: '#f0f2f5' }} />
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150 relative"
                style={({ isActive }) => isActive
                  ? {
                      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      color: '#ffffff',
                      boxShadow: '0 4px 14px rgba(185,28,28,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }
                  : { color: '#64748b' }
                }
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background.includes('dc2626')) {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.color = '#dc2626';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('dc2626')) {
                    e.currentTarget.style.background = '';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <item.icon size={16} className="flex-shrink-0" />
                <span className="flex-1 text-[13px]">{t(item.key)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #f0f2f5' }}>
          <div className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: '#94a3b8' }}>
            CS Steel Products Co., Ltd.
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: '#cbd5e1' }}>
            WMS v1.0 © 2026
          </div>
        </div>
      </aside>
    </>
  );
}
