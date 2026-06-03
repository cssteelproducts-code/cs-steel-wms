import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FLAGS } from './FlagIcons';
import { LogOut, User } from 'lucide-react';
import AlertBell from './AlertBell';
import dayjs from 'dayjs';
const LANGS = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
  { code: 'my', label: 'မြန်မာ' },
];

export default function Header({ title, subtitle }) {
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

  const handleLogout = () => { logout(); window.location.href = '/login'; };
  const ActiveFlag = FLAGS[lang];

  return (
    <>
      {/* Thin brand-red racing stripe at top of header — Lamborghini signature */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #dc2626, #ef4444 40%, #b91c1c 80%, #dc2626)',
        flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 31,
      }} />

      <header className="h-[60px] flex items-center gap-3 px-5 flex-shrink-0 sticky top-[3px] z-30"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid #eaecf0',
          boxShadow: '0 1px 0 #eaecf0, 0 4px 16px rgba(0,0,0,0.04)',
        }}>

        {/* Left */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="min-w-0">
            <h1 className="font-bold truncate leading-tight" style={{ color: '#0f172a', fontSize: 16, letterSpacing: '-0.02em' }}>{title}</h1>
            {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">

          {/* Live clock — Apple Watch style */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 h-9 rounded-full"
            style={{ background: '#f4f5f7', border: '1.5px solid transparent' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse"
              style={{ boxShadow: '0 0 6px rgba(220,38,38,0.6)' }} />
            <span className="text-sm font-black tabular-nums" style={{ color: '#dc2626', letterSpacing: '0.01em' }}>{time}</span>
            <span className="text-xs font-semibold tabular-nums text-slate-400">{dayjs().format('DD/MM/YY')}</span>
          </div>

          {/* Language */}
          <div className="relative" ref={langRef}>
            <button onClick={() => setShowLang(v => !v)}
              className="flex items-center gap-1.5 h-9 px-2.5 rounded-full transition-all"
              style={{ background: '#f4f5f7' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f4f5f7'; }}>
              {ActiveFlag && <ActiveFlag size={0.9} />}
              <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${showLang ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLang && (
              <div className="absolute right-0 top-full mt-2 rounded-2xl shadow-xl z-50 overflow-hidden animate-pop-in"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e8eaed',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
                  minWidth: 150,
                }}>
                {LANGS.map(({ code, label }) => {
                  const Flag = FLAGS[code];
                  const active = lang === code;
                  return (
                    <button key={code} onClick={() => { changeLang(code); setShowLang(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all"
                      style={{
                        background: active ? '#fef2f2' : '',
                        color: active ? '#dc2626' : '#374151',
                        fontWeight: active ? 800 : 500,
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}>
                      <Flag size={0.9} />
                      <span>{label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 4px rgba(220,38,38,0.6)' }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <AlertBell />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => setShowProfile(v => !v)}
              className="flex items-center gap-2 h-9 px-2.5 rounded-full transition-all"
              style={{ background: '#f4f5f7' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f4f5f7'; }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
                style={{
                  background: 'linear-gradient(135deg,#dc2626,#991b1b)',
                  boxShadow: '0 0 0 2px rgba(220,38,38,0.25)',
                }}>
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <span className="text-xs font-bold hidden sm:block text-slate-700">
                {user?.fullName?.split(' ')[0]}
              </span>
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-3xl shadow-2xl z-50 overflow-hidden animate-pop-in"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e8eaed',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                }}>
                <div className="px-4 py-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm"
                      style={{
                        background: 'linear-gradient(135deg,#dc2626,#991b1b)',
                        boxShadow: '0 4px 12px rgba(185,28,28,0.35)',
                      }}>
                      {user?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900">{user?.fullName}</div>
                      <div className="text-xs font-bold text-red-500">{user?.roleName}</div>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button onClick={() => { setShowProfile(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-sm font-semibold text-slate-600"
                    onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#0f172a'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#4b5563'; }}>
                    <User size={15} className="text-slate-400" />
                    {t('header.profile')}
                  </button>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-sm font-semibold text-red-500 mt-0.5"
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
    </>
  );
}
