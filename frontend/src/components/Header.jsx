import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, LogOut, User } from 'lucide-react';
import AlertBell from './AlertBell';
import dayjs from 'dayjs';

export default function Header({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [time, setTime] = useState(dayjs().format('HH:mm:ss'));

  useState(() => {
    const timer = setInterval(() => setTime(dayjs().format('HH:mm:ss')), 1000);
    return () => clearInterval(timer);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-30"
      style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', borderTop: '3px solid #dc2626', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-semibold text-base hidden sm:block" style={{ color: '#1e293b' }}>{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <AlertBell />
        {/* Live clock */}
        <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-emerald-600 font-mono text-sm font-medium">{time}</span>
          <span className="text-sm font-medium" style={{ color: '#64748b' }}>
            {dayjs().format('DD/MM/YYYY')}
          </span>
        </div>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 h-9 px-3 rounded-xl transition-all ml-1"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl z-50 overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="font-semibold text-sm" style={{ color: '#0f172a' }}>{user?.fullName}</div>
                <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{user?.roleName}</div>
              </div>
              <button
                onClick={() => { setShowProfile(false); navigate('/profile'); }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-sm whitespace-nowrap"
                style={{ color: '#475569' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#475569'; }}
              >
                <User size={15} />
                โปรไฟล์ / เปลี่ยนรหัสผ่าน
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-sm text-red-500"
                onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <LogOut size={15} />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
