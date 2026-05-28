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
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-60 z-50
        flex flex-col transition-transform duration-250 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{
        background: '#ffffff',
        borderRight: '1px solid #e8edf3',
        boxShadow: '1px 0 12px rgba(0,0,0,0.05)',
      }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex-1 flex justify-center">
            <img src={logoImg} alt="CS.Smart" className="w-auto object-contain" style={{ height: 52 }} />
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0 text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-4 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
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
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ` +
                  (isActive
                    ? 'bg-red-50 text-red-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                }
                style={({ isActive }) => isActive
                  ? { borderLeft: '3px solid #dc2626', paddingLeft: '9px' }
                  : { borderLeft: '3px solid transparent', paddingLeft: '9px' }
                }
              >
                <item.icon size={15} className="flex-shrink-0" />
                <span className="flex-1 leading-tight">{t(item.key)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #f1f5f9' }}>
          <div className="text-[11px] font-semibold text-slate-400">CS Steel Products Co., Ltd.</div>
          <div className="text-[10px] text-slate-300 mt-0.5">WMS v1.0 © 2026</div>
        </div>
      </aside>
    </>
  );
}
