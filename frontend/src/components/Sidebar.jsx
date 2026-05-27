import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  LayoutDashboard, Scale, FileText, Package, CheckSquare, TruckIcon,
  MapPin, Users, Settings, X, Activity,
  Bell, Boxes, Route
} from 'lucide-react';
import logoImg from '../assets/Logo.png';

const menuItems = [
  { path: '/', icon: LayoutDashboard, key: 'nav.dashboard', code: 'DASHBOARD' },
  { path: '/monitor', icon: Activity, key: 'nav.monitor', code: 'TRIP_MONITOR' },
  { key: 'section.station', divider: true },
  { path: '/weigh-in', icon: Scale, key: 'nav.weighIn', code: 'WEIGH_IN' },
  { path: '/data-station', icon: FileText, key: 'nav.dataStation', code: 'DATA_STATION' },
  { path: '/loading-station', icon: Package, key: 'nav.loadingStation', code: 'LOADING_STATION' },
  { path: '/checker', icon: CheckSquare, key: 'nav.checker', code: 'CHECKER' },
  { path: '/weigh-out', icon: TruckIcon, key: 'nav.weighOut', code: 'WEIGH_OUT' },
  { key: 'section.warehouse', divider: true },
  { path: '/stock', icon: Boxes, key: 'nav.stock', code: 'STOCK' },
  { path: '/delivery', icon: Route, key: 'nav.delivery', code: 'DELIVERY_PLAN' },
  { key: 'section.system', divider: true },
  { path: '/alerts', icon: Bell, key: 'nav.alerts', code: 'ALERTS' },
  { path: '/eta', icon: MapPin, key: 'nav.eta', code: 'ETA' },
  { path: '/users', icon: Users, key: 'nav.users', code: 'USERS' },
  { path: '/master', icon: Settings, key: 'nav.master', code: 'MASTER' }
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, hasPermission } = useAuth();
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
      `} style={{ background: '#ffffff', borderRight: '1px solid #f3f4f6', boxShadow: '4px 0 24px rgba(0,0,0,0.04)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#dc2626,#7f1d1d)' }}>
              <img src={logoImg} alt="CS" className="w-6 h-6 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <div className="font-black leading-tight tracking-tight" style={{ fontSize: 15, color: '#111827' }}>CS.Smart</div>
              <div className="font-medium leading-tight" style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.12em' }}>WMS PLATFORM</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* User chip */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2.5 rounded-2xl flex-shrink-0"
          style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: '#111827' }}>{user?.fullName}</div>
              <div className="text-xs font-medium truncate" style={{ color: '#ef4444' }}>{user?.roleName}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-5 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#d1d5db' }}>
                    {t(item.key)}
                  </span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150"
                style={({ isActive }) => isActive
                  ? { background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#ffffff', boxShadow: '0 4px 12px rgba(220,38,38,0.30)' }
                  : { color: '#6b7280' }
                }
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background.includes('gradient')) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.color = '#111827';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('gradient')) {
                    e.currentTarget.style.background = '';
                    e.currentTarget.style.color = '#6b7280';
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
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #f3f4f6' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#9ca3af' }}>CS Steel Product Co.,Ltd.</div>
          <div className="text-[10px]" style={{ color: '#d1d5db' }}>v1.0 © 2026</div>
        </div>
      </aside>
    </>
  );
}
