import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  LayoutDashboard, Scale, FileText, Package, CheckSquare, TruckIcon,
  MapPin, Users, Settings, X, Activity,
  Bell, Route, ClipboardList, BrainCircuit, CalendarClock, Truck
} from 'lucide-react';
import logoImg from '../assets/Logo.png';

const PIPE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="42">'
  + '<defs>'
  + '<radialGradient id="p" cx="35%" cy="28%" r="72%">'
  + '<stop offset="0%" stop-color="#6b7685"/>'
  + '<stop offset="35%" stop-color="#3e4a58"/>'
  + '<stop offset="75%" stop-color="#232e3c"/>'
  + '<stop offset="100%" stop-color="#131c27"/>'
  + '</radialGradient>'
  + '<radialGradient id="h" cx="42%" cy="36%" r="68%">'
  + '<stop offset="0%" stop-color="#2e3d50"/>'
  + '<stop offset="100%" stop-color="#080f18"/>'
  + '</radialGradient>'
  + '</defs>'
  + '<rect width="48" height="42" fill="#0d1520"/>'
  + '<circle cx="12" cy="12" r="11" fill="url(#p)"/>'
  + '<circle cx="12" cy="12" r="5.5" fill="url(#h)"/>'
  + '<circle cx="36" cy="12" r="11" fill="url(#p)"/>'
  + '<circle cx="36" cy="12" r="5.5" fill="url(#h)"/>'
  + '<circle cx="0" cy="30" r="11" fill="url(#p)"/>'
  + '<circle cx="0" cy="30" r="5.5" fill="url(#h)"/>'
  + '<circle cx="24" cy="30" r="11" fill="url(#p)"/>'
  + '<circle cx="24" cy="30" r="5.5" fill="url(#h)"/>'
  + '<circle cx="48" cy="30" r="11" fill="url(#p)"/>'
  + '<circle cx="48" cy="30" r="5.5" fill="url(#h)"/>'
  + '</svg>';
const PIPE_BG = `url("data:image/svg+xml,${encodeURIComponent(PIPE_SVG)}") repeat`;

const menuItems = [
  { path: '/', icon: LayoutDashboard, key: 'nav.dashboard', code: 'DASHBOARD' },
  { path: '/monitor', icon: Activity, key: 'nav.monitor', code: 'TRIP_MONITOR' },
  { path: '/forecast', icon: BrainCircuit, key: 'nav.forecast', code: 'FORECAST' },
  { key: 'section.station', divider: true },
  { path: '/weigh-in', icon: Scale, key: 'nav.weighIn', code: 'WEIGH_IN' },
  { path: '/data-station', icon: FileText, key: 'nav.dataStation', code: 'DATA_STATION' },
  { path: '/loading-station', icon: Package, key: 'nav.loadingStation', code: 'LOADING_STATION' },
  { path: '/weigh-out', icon: TruckIcon, key: 'nav.weighOut', code: 'WEIGH_OUT' },
  { path: '/checker', icon: CheckSquare, key: 'nav.checker', code: 'CHECKER' },
  { path: '/records', icon: ClipboardList, key: 'nav.records', code: 'RECORDS' },
  { key: 'section.logistics', divider: true },
  { path: '/eta', icon: MapPin, key: 'nav.eta', code: 'ETA' },
  { path: '/delivery', icon: Route, key: 'nav.delivery', code: 'DELIVERY_PLAN' },
  { key: 'section.system', divider: true },
  { path: '/alerts', icon: Bell, key: 'nav.alerts', code: 'ALERTS' },
  { path: '/users', icon: Users, key: 'nav.users', code: 'USERS' },
  { path: '/master', icon: Settings, key: 'nav.master', code: 'MASTER' },
  { key: 'section.tools', divider: true },
  { path: '/shift-planning', icon: CalendarClock, key: 'nav.shiftPlanning', code: 'SHIFT_PLANNING' },
  { path: '/freight-calc', icon: Truck, key: 'nav.freightCalc', code: 'FREIGHT_CALC' },
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
        <div className="fixed inset-0 bg-black/40 z-[9998] lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-60 z-[9999]
        flex flex-col transition-transform duration-250 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{
        background: PIPE_BG,
        backgroundColor: '#0d1520',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.25)',
      }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex-1 flex justify-center">
            <img src={logoImg} alt="CS.Smart" className="w-auto object-contain" style={{ height: 80 }} />
          </div>
          <button onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = ''; }}>
            <X size={15} />
          </button>
        </div>

        {/* Red accent line */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)', flexShrink: 0 }} />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-5 pb-1.5 flex items-center gap-2">
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: '#475569' }}>
                    {t(item.key)}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150"
                style={({ isActive }) => isActive
                  ? {
                      background: 'rgba(220,38,38,0.18)',
                      color: '#fca5a5',
                      borderLeft: '3px solid #dc2626',
                      paddingLeft: '9px',
                    }
                  : {
                      color: '#94a3b8',
                      borderLeft: '3px solid transparent',
                      paddingLeft: '9px',
                    }
                }
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background?.includes('220,38,38')) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background?.includes('220,38,38')) {
                    e.currentTarget.style.background = '';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                <item.icon size={15} className="flex-shrink-0" />
                <span className="flex-1 leading-tight">{t(item.key)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#475569' }}>CS Steel Products Co., Ltd.</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#334155' }}>WMS v1.0 © 2026</div>
        </div>
      </aside>
    </>
  );
}
