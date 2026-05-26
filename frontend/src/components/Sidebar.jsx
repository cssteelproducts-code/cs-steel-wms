import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Scale, FileText, Package, CheckSquare, TruckIcon,
  MapPin, Users, Settings, X, ChevronRight, Activity
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', code: 'DASHBOARD' },
  { path: '/monitor', icon: Activity, label: 'Monitor รถ', code: 'TRIP_MONITOR' },
  { label: '— สถานี —', divider: true },
  { path: '/weigh-in', icon: Scale, label: 'สถานีชั่งเข้า', code: 'WEIGH_IN' },
  { path: '/data-station', icon: FileText, label: 'สถานี Data', code: 'DATA_STATION' },
  { path: '/loading-station', icon: Package, label: 'สถานีขึ้นสินค้า', code: 'LOADING_STATION' },
  { path: '/checker', icon: CheckSquare, label: 'เช็คเกอร์', code: 'CHECKER' },
  { path: '/weigh-out', icon: TruckIcon, label: 'สถานีชั่งออก', code: 'WEIGH_OUT' },
  { label: '— ระบบ —', divider: true },
  { path: '/eta', icon: MapPin, label: 'ETA / GPS รถ', code: 'ETA' },
  { path: '/users', icon: Users, label: 'จัดการผู้ใช้', code: 'USERS' },
  { path: '/master', icon: Settings, label: 'ข้อมูลหลัก', code: 'MASTER' }
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, hasPermission } = useAuth();
  const location = useLocation();

  const visibleItems = menuItems.filter(item => {
    if (item.divider) return true;
    return hasPermission(item.code, 'canView');
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-steel-900 border-r border-steel-700 z-50
        flex flex-col transition-transform duration-300 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-steel-700 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              CS
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">CS Steel WMS</div>
              <div className="text-steel-400 text-xs">{user?.warehouseName || 'คลังสินค้า'}</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-steel-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-steel-700 bg-steel-800/50">
          <div className="text-white text-sm font-medium truncate">{user?.fullName}</div>
          <div className="text-steel-400 text-xs mt-0.5">{user?.roleName}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} className="px-2 pt-4 pb-1 text-xs text-steel-500 font-medium uppercase tracking-wider">
                  {item.label}
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium
                  transition-colors duration-150 group
                  ${isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-steel-400 hover:text-white hover:bg-steel-700/50'}
                `}
              >
                <item.icon size={17} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-steel-700 text-xs text-steel-500 text-center">
          CS Steel Products Co., Ltd. © 2025
        </div>
      </aside>
    </>
  );
}
