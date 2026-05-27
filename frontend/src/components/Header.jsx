import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FLAGS } from './FlagIcons';
import { Menu, LogOut, User, Search, X, Truck, Users } from 'lucide-react';
import AlertBell from './AlertBell';
import api from '../services/api';
import dayjs from 'dayjs';

const SEARCH_ITEMS = [
  { path: '/', label: 'Dashboard', labelEn: 'Dashboard', tags: 'แดชบอร์ด ภาพรวม' },
  { path: '/monitor', label: 'Monitor รถในคลัง', labelEn: 'Trip Monitor', tags: 'ติดตาม สถานะ รถ' },
  { path: '/weigh-in', label: 'สถานีชั่งเข้า', labelEn: 'Weigh In', tags: 'weigh in ชั่ง รับรถ' },
  { path: '/data-station', label: 'สถานี Data', labelEn: 'Data Station', tags: 'เอกสาร pick data' },
  { path: '/loading-station', label: 'สถานีขึ้นสินค้า', labelEn: 'Loading Station', tags: 'ขึ้นสินค้า loading' },
  { path: '/checker', label: 'เช็คเกอร์', labelEn: 'Checker', tags: 'ตรวจสอบ checker' },
  { path: '/weigh-out', label: 'สถานีชั่งออก', labelEn: 'Weigh Out', tags: 'weigh out ชั่งออก' },
  { path: '/stock', label: 'สต็อกสินค้า', labelEn: 'Stock', tags: 'stock คลัง สินค้า ยอด' },
  { path: '/delivery', label: 'แผนจัดส่ง VRP', labelEn: 'Delivery Plan', tags: 'delivery route จัดส่ง' },
  { path: '/alerts', label: 'การแจ้งเตือน', labelEn: 'Alerts', tags: 'alert แจ้งเตือน bell' },
  { path: '/eta', label: 'ETA / GPS', labelEn: 'ETA GPS', tags: 'eta gps แผนที่' },
  { path: '/users', label: 'จัดการผู้ใช้', labelEn: 'Users', tags: 'users บทบาท สิทธิ์' },
  { path: '/master', label: 'ข้อมูลหลัก', labelEn: 'Master Data', tags: 'master คลัง ลูกค้า รถ' },
  { path: '/transfer', label: 'ย้ายสินค้าภายใน', labelEn: 'Internal Transfer', tags: 'transfer ย้าย สินค้า' },
  { path: '/profile', label: 'โปรไฟล์ของฉัน', labelEn: 'Profile', tags: 'profile รหัสผ่าน' },
];
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [dataResults, setDataResults] = useState({ trips: [], customers: [] });
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);
  const [time, setTime] = useState(dayjs().format('HH:mm:ss'));
  const langRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

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

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(v => !v); setSearchQ(''); }
      if (e.key === 'Escape') setShowSearch(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (showSearch) setTimeout(() => searchRef.current?.focus(), 50); }, [showSearch]);

  const filteredMenus = SEARCH_ITEMS.filter(item => {
    const q = searchQ.toLowerCase();
    if (!q) return true;
    return item.label.toLowerCase().includes(q) || item.labelEn.toLowerCase().includes(q) ||
      item.tags.toLowerCase().includes(q) || item.path.includes(q);
  });

  const fetchData = useCallback(async (q) => {
    if (q.length < 2) { setDataResults({ trips: [], customers: [] }); return; }
    setSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
      if (res.data.success) setDataResults({ trips: res.data.trips || [], customers: res.data.customers || [] });
    } catch {} finally { setSearching(false); }
  }, []);

  const handleSearchChange = (val) => {
    setSearchQ(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchData(val), 300);
  };

  const openSearch = () => { setShowSearch(true); setSearchQ(''); setDataResults({ trips: [], customers: [] }); };
  const goTo = (path) => { navigate(path); setShowSearch(false); setSearchQ(''); };
  const handleLogout = () => { logout(); navigate('/login'); };
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
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl transition-all flex-shrink-0"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280'; }}>
            <Menu size={20} />
          </button>
          <h1 className="font-black truncate hidden sm:block" style={{
            color: '#0f172a',
            fontSize: 17,
            letterSpacing: '-0.025em',
          }}>{title}</h1>
        </div>

        {/* Search pill — Apple-style */}
        <button onClick={openSearch}
          className="hidden md:flex items-center gap-2.5 px-4 h-9 rounded-full transition-all mx-3 flex-1 max-w-[260px]"
          style={{
            background: '#f4f5f7',
            border: '1.5px solid transparent',
            color: '#94a3b8',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#fef2f2';
            e.currentTarget.style.borderColor = 'rgba(220,38,38,0.2)';
            e.currentTarget.style.color = '#dc2626';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#f4f5f7';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}>
          <Search size={13} />
          <span className="text-xs font-medium flex-1 text-left">ค้นหา...</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/80 border border-gray-200 text-slate-400">⌘K</kbd>
        </button>

        {/* Search modal */}
        {showSearch && (
          <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-16 px-4"
            style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowSearch(false)}>
            <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-pop-in"
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                boxShadow: '0 32px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
              }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
                <Search size={16} className="text-red-500 flex-shrink-0" />
                <input ref={searchRef} value={searchQ} onChange={e => handleSearchChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && filteredMenus.length > 0) goTo(filteredMenus[0].path); }}
                  className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
                  placeholder="ค้นหาเมนู, ทะเบียนรถ, ชื่อลูกค้า..." />
                <button onClick={() => setShowSearch(false)} className="text-slate-300 hover:text-slate-500 p-0.5 transition-colors"><X size={15} /></button>
              </div>
              <div className="max-h-[400px] overflow-y-auto py-2">
                {filteredMenus.length > 0 && (
                  <>
                    {searchQ && <div className="px-5 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">เมนู</div>}
                    {filteredMenus.map(item => (
                      <button key={item.path} onClick={() => goTo(item.path)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-left group transition-all"
                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ background: '#f4f5f7' }}
                          onMouseEnter={e => e.parentElement.style.background = '#fef2f2'}>
                          <Search size={12} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 group-hover:text-red-600 transition-colors">{item.label}</div>
                          <div className="text-[11px] text-slate-400">{item.path}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {dataResults.trips.length > 0 && (
                  <>
                    <div className="px-5 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1.5">
                      <Truck size={10} />ทริป
                    </div>
                    {dataResults.trips.map(tr => (
                      <button key={tr.TripID} onClick={() => goTo('/monitor')}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all"
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Truck size={12} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800">{tr.LicensePlate}
                            <span className="ml-2 text-xs text-slate-400">#{tr.TripID}</span></div>
                          <div className="text-[11px] text-slate-400">{tr.CustomerName || '-'} · {tr.Status}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {dataResults.customers.length > 0 && (
                  <>
                    <div className="px-5 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1.5">
                      <Users size={10} />ลูกค้า
                    </div>
                    {dataResults.customers.map(c => (
                      <button key={c.CustomerID} onClick={() => goTo('/master')}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all"
                        onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <Users size={12} className="text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800">{c.CustomerName}</div>
                          <div className="text-[11px] text-slate-400">{c.CustomerCode || ''}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {searching && <div className="text-center py-4 text-xs text-slate-400">กำลังค้นหา...</div>}
                {searchQ.length >= 2 && !searching && filteredMenus.length === 0 && dataResults.trips.length === 0 && dataResults.customers.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">ไม่พบผลลัพธ์</div>
                )}
                {!searchQ && <div className="text-center py-8 text-slate-300 text-sm">พิมพ์เพื่อค้นหา...</div>}
              </div>
              <div className="px-5 py-2.5 flex items-center gap-3 text-xs text-slate-400" style={{ borderTop: '1px solid #f0f2f5' }}>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-500 text-[10px]">↵</kbd> เปิด</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-500 text-[10px]">Esc</kbd> ปิด</span>
              </div>
            </div>
          </div>
        )}

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
