import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, LogOut, User, RefreshCw } from 'lucide-react';
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
    <header className="h-16 bg-steel-900 border-b border-steel-700 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-steel-400 hover:text-white p-2 rounded-lg hover:bg-steel-700 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-white font-semibold text-lg hidden sm:block">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Live clock */}
        <div className="hidden md:flex items-center gap-2 bg-steel-800 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 font-mono text-sm font-medium">{time}</span>
          <span className="text-steel-500 text-xs">
            {dayjs().format('DD/MM/YYYY')}
          </span>
        </div>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 bg-steel-800 hover:bg-steel-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.fullName?.charAt(0) || 'U'}
              </span>
            </div>
            <span className="text-white text-sm font-medium hidden sm:block max-w-24 truncate">
              {user?.fullName}
            </span>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-steel-800 border border-steel-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-steel-700">
                <div className="text-white font-medium">{user?.fullName}</div>
                <div className="text-steel-400 text-xs mt-0.5">{user?.roleName}</div>
              </div>
              <button
                onClick={() => { setShowProfile(false); navigate('/profile'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-steel-300 hover:text-white hover:bg-steel-700 transition-colors text-sm"
              >
                <User size={16} />
                โปรไฟล์ / เปลี่ยนรหัสผ่าน
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors text-sm"
              >
                <LogOut size={16} />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
