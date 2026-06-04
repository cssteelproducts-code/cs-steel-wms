import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  LayoutDashboard, Scale, FileText, Package, CheckSquare, TruckIcon,
  MapPin, Users, Settings, Activity, Bell, ClipboardList,
  BrainCircuit, CalendarClock, Truck, ArrowLeftRight, ScanLine, ClipboardCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import logoImg from '../assets/Logo.png';

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
  { key: 'section.warehouse', divider: true },
  { path: '/location-check', icon: ScanLine, key: 'nav.locationCheck', code: 'STOCK' },
  { path: '/transfer', icon: ArrowLeftRight, key: 'nav.transfer', code: 'TRANSFER' },
  { path: '/transfer/driver', icon: Truck, key: 'nav.transferDriver', code: 'TRANSFER' },
  { path: '/stock-count', icon: ClipboardCheck, key: 'nav.stockCount', codes: ['STOCKCOUNT_OFFICE', 'STOCKCOUNT_FIELD'] },
  { key: 'section.logistics', divider: true },
  { path: '/tms', icon: Truck, key: 'nav.tms', code: 'TMS' },
  { path: '/eta', icon: MapPin, key: 'nav.eta', code: 'ETA' },
  { key: 'section.system', divider: true },
  { path: '/alerts', icon: Bell, key: 'nav.alerts', code: 'ALERTS' },
  { path: '/users', icon: Users, key: 'nav.users', code: 'USERS' },
  { path: '/master', icon: Settings, key: 'nav.master', code: 'MASTER' },
  { key: 'section.tools', divider: true },
  { path: '/shift-planning', icon: CalendarClock, key: 'nav.shiftPlanning', code: 'SHIFT_PLANNING' },
  { path: '/freight-calc', icon: Truck, key: 'nav.freightCalc', code: 'FREIGHT_CALC' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { hasPermission } = useAuth();
  const { t } = useLang();

  const visibleItems = menuItems.filter(item => {
    if (item.divider) return true;
    if (item.codes) return item.codes.some(c => hasPermission(c, 'canView'));
    return hasPermission(item.code, 'canView');
  });

  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0 transition-all duration-200 ease-out h-screen sticky top-0"
      style={{
        width: collapsed ? 64 : 240,
        backgroundColor: '#0d1520',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.25)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{
          height: collapsed ? 56 : 92,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          transition: 'height 0.2s ease-out',
        }}
      >
        <img
          src={logoImg}
          alt="CS.Smart"
          className="object-contain transition-all duration-200"
          style={{ height: collapsed ? 32 : 72, width: 'auto' }}
        />
      </div>

      {/* Red accent line */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)', flexShrink: 0 }} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5" style={{ padding: collapsed ? '12px 6px' : '12px 10px' }}>
        {visibleItems.map((item, idx) => {
          if (item.divider) {
            if (collapsed) {
              return (
                <div key={idx} className="my-2 mx-1" style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
              );
            }
            return (
              <div key={idx} className="px-2 pt-4 pb-1 flex items-center gap-2">
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
                  {t(item.key)}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
              </div>
            );
          }

          return collapsed ? (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={t(item.key)}
              className="flex items-center justify-center rounded-lg transition-all duration-150"
              style={({ isActive }) => ({
                height: 40,
                background: isActive ? 'rgba(220,38,38,0.20)' : 'transparent',
                color: isActive ? '#fca5a5' : '#94a3b8',
                borderLeft: isActive ? '3px solid #dc2626' : '3px solid transparent',
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.style.background?.includes('220,38,38')) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.style.background?.includes('220,38,38')) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <item.icon size={17} />
            </NavLink>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className="flex items-center gap-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap overflow-hidden"
              style={({ isActive }) => isActive
                ? { background: 'rgba(220,38,38,0.18)', color: '#fca5a5', borderLeft: '3px solid #dc2626', paddingLeft: 9, paddingRight: 10 }
                : { color: '#94a3b8', borderLeft: '3px solid transparent', paddingLeft: 9, paddingRight: 10 }
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

      {/* Footer + collapse toggle */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        {!collapsed && (
          <div className="px-4 pt-2.5 pb-1">
            <div className="text-[11px] font-semibold" style={{ color: '#475569' }}>CS Steel Products Co., Ltd.</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#334155' }}>WMS v1.0 © 2026</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center transition-colors duration-150"
          style={{ height: 36, color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#475569'; }}
          title={collapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
