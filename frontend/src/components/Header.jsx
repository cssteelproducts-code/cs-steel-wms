import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FLAGS } from './FlagIcons';
import { Menu, LogOut, User, Search } from 'lucide-react';
import AlertBell from './AlertBell';
import dayjs from 'dayjs';

const LANGS = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
  { code: 'my', label: 'မြန်မာ' },
];

export default function Header({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const { lang, changeLang, t } = useLang();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [time, setTime] = useState(dayjs().format('HH:mm:ss'));
  const langRef = useRef(null);
  const profileRef = useRef(null);

  useState(() => {
    const timer = setInterval(() => setTime(dayjs().format('HH:mm:ss')), 1000);
    return () => clearInterval(timer);
  });

  useEffect(() => {
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setShowLang(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const ActiveFlag = FLAGS[lang];

  return (
    <header className="h-16 flex items-center gap-3 px-5 flex-shrink-0 sticky top-0 z-30"
      style={{ background: '#ffffff', borderBottom: '1px solid #f3f4f6', boxShadow: '0 1px 0 #f3f4f6' }}>

      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0" style={{ color: '#6b7280' }}>
          <Menu size={20} />
        </button>
        <h1 className="font-bold text-sm truncate hidden sm:block" style={{ color: '#374151' }}>{title}</h1>
      </div>

      {/* Center: search bar */}
      <div className="flex-1 max-w-md mx-auto hidden md:flex items-center gap-2 px-4 h-10 rounded-2xl transition-all"
        style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb' }}>
        <Search size={14} style={{ color: '#9ca3af' }} className="flex-shrink-0" />
        <span className="text-sm flex-1" style={{ color: '#9ca3af' }}>ค้นหาเมนู...</span>
        <span className="text-xs px-1.5 py-0.5 rounded-lg font-mono flex-shrink-0"
          style={{ background: '#e5e7eb', color: '#9ca3af' }}>⌘K</span>
      </div>

      {/* Right: clock + lang + bell + profile */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-2 px-3 h-9 rounded-2xl"
          style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold tabular-nums" style={{ color: '#111827' }}>{time}</span>
          <span className="text-xs font-medium tabular-nums" style={{ color: '#9ca3af' }}>{dayjs().format('DD/MM/YYYY')}</span>
        </div>

        {/* Language */}
        <div className="relative" ref={langRef}>
          <button onClick={() => setShowLang(v => !v)}
            className="flex items-center gap-1.5 h-9 px-2.5 rounded-2xl transition-all"
            style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#f3f4f6'}>
            {ActiveFlag && <ActiveFlag size={0.9} />}
            <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${showLang ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showLang && (
            <div className="absolute right-0 top-full mt-2 rounded-2xl shadow-xl z-50 overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #f3f4f6', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 150 }}>
              {LANGS.map(({ code, label }) => {
                const Flag = FLAGS[code];
                const active = lang === code;
                return (
                  <button key={code} onClick={() => { changeLang(code); setShowLang(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                    style={{ background: active ? '#fef2f2' : '', color: active ? '#dc2626' : '#374151', fontWeight: active ? 700 : 500 }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}>
                    <Flag size={0.9} />
                    <span>{label}</span>
                    {active && <svg className="ml-auto w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bell */}
        <AlertBell />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setShowProfile(v => !v)}
            className="flex items-center gap-2 h-9 px-2.5 rounded-2xl transition-all"
            style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#f3f4f6'}>
            <div className="w-6 h-6 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <span className="text-xs font-semibold hidden sm:block" style={{ color: '#374151' }}>
              {user?.fullName?.split(' ')[0]}
            </span>
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-3xl shadow-xl z-50 overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #f3f4f6', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
              <div className="px-4 py-4" style={{ borderBottom: '1px solid #f9fafb' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: '#111827' }}>{user?.fullName}</div>
                    <div className="text-xs font-medium" style={{ color: '#ef4444' }}>{user?.roleName}</div>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button onClick={() => { setShowProfile(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-sm font-semibold"
                  style={{ color: '#374151' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <User size={15} className="text-gray-400" />
                  {t('header.profile')}
                </button>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-sm font-semibold mt-0.5"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <LogOut size={15} />
                  {t('header.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
