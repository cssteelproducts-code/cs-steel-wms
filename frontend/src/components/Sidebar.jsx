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
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-60 z-50
        flex flex-col transition-transform duration-300 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: 'linear-gradient(175deg, #dc2626 0%, #b91c1c 35%, #991b1b 70%, #7f1d1d 100%)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 flex-shrink-0"
          style={{ background: '#ffffff', borderBottom: '3px solid #dc2626', paddingTop: 12, paddingBottom: 12 }}>
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="CS" className="object-contain flex-shrink-0" style={{ width: 38, height: 38 }} />
            <div>
              <div className="font-extrabold leading-tight" style={{ fontSize: 16, color: '#dc2626' }}>CS.Smart</div>
              <div className="font-semibold leading-tight tracking-widest" style={{ fontSize: 9, color: '#94a3b8' }}>WMS PLATFORM</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-700 p-1 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* User info */}
        <div className="mx-3 my-2 px-3 py-2.5 rounded-xl flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#b91c1c' }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.fullName}</div>
              <div className="text-red-200 text-[10px] truncate">{user?.roleName}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-4 pb-1.5 flex items-center gap-2">
                  <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-red-200">
                    {t(item.key)}
                  </span>
                  <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.2)' }} />
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 group"
                style={({ isActive }) => isActive
                  ? { background: 'rgba(255,255,255,0.92)', color: '#b91c1c', border: '1px solid rgba(255,255,255,0.3)' }
                  : { color: 'rgba(255,255,255,0.85)', border: '1px solid transparent' }
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-[12px]">{t(item.key)}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#b91c1c' }} />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 flex-shrink-0 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="text-[10px] text-red-200">CS Steel Product Co.,Ltd.</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>v1.0 © 2026</div>
        </div>
      </aside>
    </>
  );
}
