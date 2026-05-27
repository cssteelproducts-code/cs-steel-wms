import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FLAGS } from './FlagIcons';
import { Menu, LogOut, User } from 'lucide-react';
import AlertBell from './AlertBell';
import dayjs from 'dayjs';

const LANGS = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
  { code: 'my', label: 'မြန်မာ' },
];

export default function Header({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const { lang, changeLang } = useLang();
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setShowLang(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { t } = useLang();
  const ActiveFlag = FLAGS[lang];

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
          <span className="text-sm font-medium" style={{ color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
          <span className="text-slate-300 text-xs select-none">|</span>
          <span className="text-sm font-medium" style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            {dayjs().format('DD/MM/YYYY')}
          </span>
        </div>

        {/* Language switcher — shows only current flag, dropdown on click */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setShowLang(v => !v)}
            className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl transition-all"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
          >
            {ActiveFlag && <ActiveFlag size={0.9} />}
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showLang ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showLang && (
            <div className="absolute right-0 top-full mt-2 rounded-xl shadow-xl z-50 overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 140 }}>
              {LANGS.map(({ code, label }) => {
                const Flag = FLAGS[code];
                const active = lang === code;
                return (
                  <button
                    key={code}
                    onClick={() => { changeLang(code); setShowLang(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
                    style={{
                      background: active ? '#fef2f2' : '',
                      color: active ? '#dc2626' : '#475569',
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}
                  >
                    <Flag size={0.9} />
                    <span>{label}</span>
                    {active && (
                      <svg className="ml-auto w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(v => !v)}
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
                {t('header.profile')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-sm text-red-500"
                onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <LogOut size={15} />
                {t('header.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
