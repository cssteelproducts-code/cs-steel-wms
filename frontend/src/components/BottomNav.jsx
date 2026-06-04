import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  MoreHorizontal, X, LayoutDashboard, Scale, FileText, Package, CheckSquare,
  TruckIcon, MapPin, Users, Settings, Activity, Bell, ClipboardList,
  BrainCircuit, CalendarClock, Truck, ArrowLeftRight, ScanLine, ClipboardCheck
} from 'lucide-react';

const ALL_ITEMS = [
  { path: '/',               icon: LayoutDashboard, key: 'nav.dashboard',      code: 'DASHBOARD' },
  { path: '/weigh-in',       icon: Scale,           key: 'nav.weighIn',        code: 'WEIGH_IN' },
  { path: '/weigh-out',      icon: TruckIcon,       key: 'nav.weighOut',       code: 'WEIGH_OUT' },
  { path: '/loading-station',icon: Package,         key: 'nav.loadingStation', code: 'LOADING_STATION' },
  { path: '/records',        icon: ClipboardList,   key: 'nav.records',        code: 'RECORDS' },
  { path: '/location-check', icon: ScanLine,        key: 'nav.locationCheck',  code: 'STOCK' },
  { path: '/transfer',       icon: ArrowLeftRight,  key: 'nav.transfer',       code: 'TRANSFER' },
  { path: '/stock-count',    icon: ClipboardCheck,  key: 'nav.stockCount',     codes: ['STOCKCOUNT_OFFICE', 'STOCKCOUNT_FIELD'] },
  { path: '/monitor',        icon: Activity,        key: 'nav.monitor',        code: 'TRIP_MONITOR' },
  { path: '/tms',            icon: Truck,           key: 'nav.tms',            code: 'TMS' },
  { path: '/eta',            icon: MapPin,          key: 'nav.eta',            code: 'ETA' },
  { path: '/data-station',   icon: FileText,        key: 'nav.dataStation',    code: 'DATA_STATION' },
  { path: '/checker',        icon: CheckSquare,     key: 'nav.checker',        code: 'CHECKER' },
  { path: '/forecast',       icon: BrainCircuit,    key: 'nav.forecast',       code: 'FORECAST' },
  { path: '/alerts',         icon: Bell,            key: 'nav.alerts',         code: 'ALERTS' },
  { path: '/users',          icon: Users,           key: 'nav.users',          code: 'USERS' },
  { path: '/master',         icon: Settings,        key: 'nav.master',         code: 'MASTER' },
  { path: '/shift-planning', icon: CalendarClock,   key: 'nav.shiftPlanning',  code: 'SHIFT_PLANNING' },
  { path: '/freight-calc',   icon: Truck,           key: 'nav.freightCalc',    code: 'FREIGHT_CALC' },
  { path: '/transfer/driver',icon: Truck,           key: 'nav.transferDriver', code: 'TRANSFER' },
];

export default function BottomNav() {
  const { hasPermission } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const visible = ALL_ITEMS.filter(item =>
    item.codes
      ? item.codes.some(c => hasPermission(c, 'canView'))
      : hasPermission(item.code, 'canView')
  );

  const pinned = visible.slice(0, 4);
  const more = visible.slice(4);

  const isActive = (item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid #eaecf0',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex h-14">
          {pinned.map(item => {
            const active = isActive(item);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                style={{ color: active ? '#dc2626' : '#9ca3af' }}
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                    style={{ width: 28, height: 3, background: '#dc2626' }}
                  />
                )}
                <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold leading-none mt-0.5 truncate max-w-[56px] text-center">
                  {t(item.key)}
                </span>
              </NavLink>
            );
          })}

          {more.length > 0 && (
            <button
              onClick={() => setShowMore(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ color: '#9ca3af' }}
            >
              <MoreHorizontal size={20} strokeWidth={1.8} />
              <span className="text-[10px] font-semibold leading-none mt-0.5">อื่นๆ</span>
            </button>
          )}
        </div>
      </nav>

      {/* More drawer */}
      {showMore && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden animate-slide-up"
            style={{ background: '#ffffff', maxHeight: '75vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <span className="font-bold text-slate-900 text-base">เมนูทั้งหมด</span>
              <button
                onClick={() => setShowMore(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 active:bg-slate-200 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div
              className="overflow-y-auto px-4 pb-8"
              style={{ maxHeight: 'calc(75vh - 72px)' }}
            >
              <div className="grid grid-cols-3 gap-2.5">
                {more.map(item => {
                  const active = isActive(item);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95"
                      style={{
                        background: active ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${active ? '#fecaca' : '#f1f5f9'}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: active ? 'rgba(220,38,38,0.1)' : '#fff' }}
                      >
                        <item.icon
                          size={18}
                          style={{ color: active ? '#dc2626' : '#64748b' }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-semibold text-center leading-tight"
                        style={{ color: active ? '#dc2626' : '#475569' }}
                      >
                        {t(item.key)}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
