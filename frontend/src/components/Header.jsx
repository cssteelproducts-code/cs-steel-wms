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
  { path: '/eta', label: 'ETA / GPS', labelEn: 'ETA GPS', tags: 'eta gps แผนที่ รถขนส่ง' },
  { path: '/users', label: 'จัดการผู้ใช้', labelEn: 'Users', tags: 'users บทบาท สิทธิ์ permission' },
  { path: '/master', label: 'ข้อมูลหลัก', labelEn: 'Master Data', tags: 'master คลัง ลูกค้า รถ สถานี' },
  { path: '/transfer', label: 'ย้ายสินค้าภายใน (Office)', labelEn: 'Internal Transfer', tags: 'transfer ย้าย สินค้า ผลิต คลัง office จ่ายงาน' },
  { path: '/transfer/driver', label: 'งานขนย้าย (คนขับ)', labelEn: 'Transfer Driver', tags: 'transfer driver คนขับ รับงาน ย้ายสินค้า' },
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
        setSearchQ('');
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showSearch]);

  const filteredMenus = SEARCH_ITEMS.filter(item => {
    const q = searchQ.toLowerCase();
    if (!q) return true;
    return item.label.toLowerCase().includes(q) ||
      item.labelEn.toLowerCase().includes(q) ||
      item.tags.toLowerCase().includes(q) ||
      item.path.includes(q);
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
    <header className="h-16 flex items-center gap-3 px-5 flex-shrink-0 sticky top-0 z-30"
      style={{ background: '#ffffff', borderBottom: '1px solid #f3f4f6', boxShadow: '0 1px 0 #f3f4f6' }}>

      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0" style={{ color: '#6b7280' }}>
          <Menu size={20} />
        </button>
        <h1 className="font-bold truncate hidden sm:block" style={{ color: '#374151', fontSize: 21 }}>{title}</h1>
      </div>


      {/* Search Palette Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-20 px-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSearch(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
            onClick={e => e.stopPropagation()}>
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <Search size={16} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredMenus.length > 0) goTo(filteredMenus[0].path);
                }}
                className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
                placeholder="ค้นหาเมนู, ทะเบียนรถ, ชื่อลูกค้า..."
              />
              <button onClick={() => setShowSearch(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X size={15} />
              </button>
            </div>
            {/* Results */}
            <div className="max-h-[420px] overflow-y-auto py-1.5">
              {/* Menus */}
              {filteredMenus.length > 0 && (
                <>
                  {searchQ && <div className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">เมนู</div>}
                  {filteredMenus.map(item => (
                    <button key={item.path} onClick={() => goTo(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-red-50 group">
                      <Search size={13} className="text-slate-300 group-hover:text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-red-600">{item.label}</div>
                        <div className="text-xs text-slate-400">{item.path}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Trips */}
              {dataResults.trips.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={10} />ทริป
                  </div>
                  {dataResults.trips.map(t => (
                    <button key={t.TripID} onClick={() => goTo('/monitor')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50 group">
                      <Truck size={13} className="text-slate-300 group-hover:text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
                          {t.LicensePlate}
                          <span className="ml-2 text-xs text-slate-400">#{t.TripID}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {t.CustomerName || '-'} · {t.VehicleType || '-'} · {t.Status} · {dayjs(t.TripDate).format('DD/MM/YY')}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Customers */}
              {dataResults.customers.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={10} />ลูกค้า
                  </div>
                  {dataResults.customers.map(c => (
                    <button key={c.CustomerID} onClick={() => goTo('/master')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-emerald-50 group">
                      <Users size={13} className="text-slate-300 group-hover:text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-emerald-600">{c.CustomerName}</div>
                        <div className="text-xs text-slate-400">{c.CustomerCode || ''}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {searching && <div className="text-center py-4 text-slate-400 text-xs">กำลังค้นหา...</div>}

              {searchQ.length >= 2 && !searching && filteredMenus.length === 0 && dataResults.trips.length === 0 && dataResults.customers.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">ไม่พบผลลัพธ์สำหรับ "{searchQ}"</div>
              )}
              {!searchQ && <div className="text-center py-6 text-slate-300 text-sm">พิมพ์เพื่อค้นหา...</div>}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-500">↵</kbd> เปิด</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-500">Esc</kbd> ปิด</span>
            </div>
          </div>
        </div>
      )}

      {/* Right: clock + lang + bell + profile */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-2 px-3 h-9 rounded-2xl"
          style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold tabular-nums" style={{ color: '#111827' }}>{time}</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: '#111827' }}>{dayjs().format('DD/MM/YYYY')}</span>
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
