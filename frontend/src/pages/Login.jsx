import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, User, X } from 'lucide-react';
import logoImg from '../assets/Logo.png';

const LANGS = {
  th: {
    title: 'ระบบจัดการคลังสินค้า',
    subtitle: 'บริษัท ซีเอสสตีลโปรดักส์ จำกัด',
    username: 'ชื่อผู้ใช้',
    password: 'รหัสผ่าน',
    userPlaceholder: 'กรอกชื่อผู้ใช้',
    passPlaceholder: 'กรอกรหัสผ่าน',
    login: 'เข้าสู่ระบบ',
    loggingIn: 'กำลังเข้าสู่ระบบ...',
    rememberMe: 'จดจำรหัสผ่าน',
    resetPwd: 'รีเซ็ตรหัสผ่าน',
    resetTitle: 'รีเซ็ตรหัสผ่าน',
    resetBody: 'กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่านของท่าน',
    close: 'ปิด',
    footer: 'CS Steel WMS v1.0 | สงวนสิทธิ์สำหรับพนักงาน',
    errRequired: 'กรุณากรอก Username และ Password',
  },
  en: {
    title: 'Warehouse Management System',
    subtitle: 'CS Steel Products Co., Ltd.',
    username: 'Username',
    password: 'Password',
    userPlaceholder: 'Enter username',
    passPlaceholder: 'Enter password',
    login: 'Sign In',
    loggingIn: 'Signing in...',
    rememberMe: 'Remember me',
    resetPwd: 'Reset Password',
    resetTitle: 'Reset Password',
    resetBody: 'Please contact your system administrator to reset your password.',
    close: 'Close',
    footer: 'CS Steel WMS v1.0 | Authorized personnel only',
    errRequired: 'Please enter Username and Password',
  },
  my: {
    title: 'ကုန်သိုလှောင်ရုံ စီမံခန့်ခွဲမှုစနစ်',
    subtitle: 'CS Steel Products ကုမ္ပဏီလီမိတက်',
    username: 'အကောင့်အမည်',
    password: 'စကားဝှက်',
    userPlaceholder: 'အကောင့်အမည် ထည့်ပါ',
    passPlaceholder: 'စကားဝှက် ထည့်ပါ',
    login: 'ဝင်ရောက်ရန်',
    loggingIn: 'ဝင်ရောက်နေသည်...',
    rememberMe: 'မှတ်သားထားမည်',
    resetPwd: 'စကားဝှက်ပြန်သတ်မှတ်',
    resetTitle: 'စကားဝှက်ပြန်လည်သတ်မှတ်ရန်',
    resetBody: 'ကျေးဇူးပြု၍ သင်၏ system စီမံသူနှင့် ဆက်သွယ်ပါ။',
    close: 'ပိတ်ရန်',
    footer: 'CS Steel WMS v1.0 | ဝန်ထမ်းများအတွက်သာ',
    errRequired: 'Username နှင့် Password ထည့်ပါ',
  },
};

// Inline SVG: large-scale steel architecture (columns, trusses, arches, bracing)
function SteelBackground() {
  const s = 'rgba(220,220,220,0.055)';
  const sm = 'rgba(220,220,220,0.035)';
  const sw = 'rgba(220,220,220,0.08)';
  const red = 'rgba(185,28,28,0.12)';
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Floor grid */}
      {[0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440].map(x => (
        <line key={`vg${x}`} x1={x} y1="700" x2={(x + 720) % 1440} y2="900" stroke={sm} strokeWidth="1" />
      ))}
      {[720, 810, 900].map((y, i) => (
        <line key={`hg${i}`} x1="0" y1={y} x2="1440" y2={y} stroke={sm} strokeWidth="1" />
      ))}

      {/* Main outer arch — dominant structural element */}
      <path d="M -60 950 Q 720 -80 1500 950" fill="none" stroke={sw} strokeWidth="12" />
      {/* Inner arch */}
      <path d="M 60 950 Q 720 60 1380 950" fill="none" stroke={s} strokeWidth="7" />
      {/* Tertiary arch */}
      <path d="M 160 950 Q 720 200 1280 950" fill="none" stroke={sm} strokeWidth="5" />
      {/* Small inner arch */}
      <path d="M 300 950 Q 720 360 1140 950" fill="none" stroke={sm} strokeWidth="3" />

      {/* Red accent arch glow */}
      <path d="M -60 950 Q 720 -80 1500 950" fill="none" stroke={red} strokeWidth="14" />

      {/* Vertical columns — left cluster */}
      <line x1="60" y1="0" x2="60" y2="950" stroke={sw} strokeWidth="9" />
      <line x1="68" y1="0" x2="68" y2="950" stroke={s} strokeWidth="3" />
      <line x1="52" y1="0" x2="52" y2="950" stroke={s} strokeWidth="3" />

      <line x1="200" y1="280" x2="200" y2="950" stroke={s} strokeWidth="6" />
      <line x1="207" y1="280" x2="207" y2="950" stroke={sm} strokeWidth="2" />
      <line x1="193" y1="280" x2="193" y2="950" stroke={sm} strokeWidth="2" />

      <line x1="360" y1="430" x2="360" y2="950" stroke={s} strokeWidth="5" />
      <line x1="540" y1="540" x2="540" y2="950" stroke={sm} strokeWidth="4" />

      {/* Center column */}
      <line x1="720" y1="170" x2="720" y2="950" stroke={s} strokeWidth="5" />

      {/* Right cluster — mirror */}
      <line x1="900" y1="540" x2="900" y2="950" stroke={sm} strokeWidth="4" />
      <line x1="1080" y1="430" x2="1080" y2="950" stroke={s} strokeWidth="5" />
      <line x1="1240" y1="280" x2="1240" y2="950" stroke={s} strokeWidth="6" />
      <line x1="1247" y1="280" x2="1247" y2="950" stroke={sm} strokeWidth="2" />
      <line x1="1233" y1="280" x2="1233" y2="950" stroke={sm} strokeWidth="2" />
      <line x1="1380" y1="0" x2="1380" y2="950" stroke={sw} strokeWidth="9" />
      <line x1="1388" y1="0" x2="1388" y2="950" stroke={s} strokeWidth="3" />
      <line x1="1372" y1="0" x2="1372" y2="950" stroke={s} strokeWidth="3" />

      {/* Horizontal beams */}
      <line x1="0" y1="180" x2="1440" y2="180" stroke={sm} strokeWidth="4" />
      <line x1="0" y1="186" x2="1440" y2="186" stroke={sm} strokeWidth="2" />
      <line x1="0" y1="420" x2="1440" y2="420" stroke={sm} strokeWidth="3" />
      <line x1="0" y1="600" x2="1440" y2="600" stroke={sm} strokeWidth="3" />
      <line x1="0" y1="700" x2="1440" y2="700" stroke={s} strokeWidth="5" />
      <line x1="0" y1="706" x2="1440" y2="706" stroke={sm} strokeWidth="2" />

      {/* X-bracing between columns */}
      <line x1="60" y1="420" x2="200" y2="600" stroke={sm} strokeWidth="2.5" />
      <line x1="200" y1="420" x2="60" y2="600" stroke={sm} strokeWidth="2.5" />
      <line x1="200" y1="420" x2="360" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="360" y1="420" x2="200" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="360" y1="420" x2="540" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="540" y1="420" x2="360" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="540" y1="420" x2="720" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="720" y1="420" x2="540" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="720" y1="420" x2="900" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="900" y1="420" x2="720" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="900" y1="420" x2="1080" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="1080" y1="420" x2="900" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="1080" y1="420" x2="1240" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="1240" y1="420" x2="1080" y2="600" stroke={sm} strokeWidth="2" />
      <line x1="1240" y1="420" x2="1380" y2="600" stroke={sm} strokeWidth="2.5" />
      <line x1="1380" y1="420" x2="1240" y2="600" stroke={sm} strokeWidth="2.5" />

      {/* Truss verticals along arch */}
      {[200, 360, 540, 720, 900, 1080, 1240].map((x, i) => {
        const archY = 950 - 1030 * Math.sin(Math.PI * (x / 1440));
        return (
          <line key={`tv${i}`} x1={x} y1={archY + 8} x2={x} y2="420"
            stroke={sm} strokeWidth="2" strokeDasharray="8 6" />
        );
      })}

      {/* I-beam cap flanges at major column tops */}
      {[60, 200, 360, 540, 720, 900, 1080, 1240, 1380].map((x, i) => (
        <g key={`ib${i}`}>
          <line x1={x - 14} y1="420" x2={x + 14} y2="420" stroke={s} strokeWidth="3" />
          <line x1={x - 14} y1="600" x2={x + 14} y2="600" stroke={s} strokeWidth="3" />
        </g>
      ))}

      {/* Far-back depth columns (very faint) */}
      {[150, 420, 660, 780, 1020, 1290].map((x, i) => (
        <line key={`dc${i}`} x1={x} y1="600" x2={x} y2="900"
          stroke="rgba(220,220,220,0.02)" strokeWidth="2" />
      ))}
    </svg>
  );
}

export default function Login() {
  const [lang, setLang] = useState('th');
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = LANGS[lang];

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wms_remember');
      if (saved) {
        const { username, password } = JSON.parse(saved);
        setForm({ username, password });
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error(t.errRequired);
      return;
    }
    if (rememberMe) {
      localStorage.setItem('wms_remember', JSON.stringify({ username: form.username, password: form.password }));
    } else {
      localStorage.removeItem('wms_remember');
    }
    setLoading(true);
    try {
      const result = await login(form.username, form.password);
      if (result.success) {
        toast.success(`ยินดีต้อนรับ / Welcome ${result.user.fullName}`);
        navigate('/');
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด / Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0505 50%, #0d0d0d 100%)' }}>

      {/* Steel architecture background */}
      <SteelBackground />

      {/* Subtle red corner glows */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(185,28,28,0.08) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(185,28,28,0.06) 0%, transparent 70%)' }} />

      {/* Language switcher */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        {(['th', 'en', 'my']).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              lang === l
                ? 'bg-red-700 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
            }`}
          >
            {l === 'th' ? 'ไทย' : l === 'en' ? 'EN' : 'MM'}
          </button>
        ))}
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm relative z-10">

        {/* Logo & header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 40px rgba(185,28,28,0.35)' }}>
              <img src={logoImg} alt="CS Steel Logo" className="w-20 h-20 object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">{t.title}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t.subtitle}</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 shadow-2xl border"
          style={{
            background: 'rgba(10,10,10,0.82)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(185,28,28,0.4)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(185,28,28,0.15)',
          }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.username}</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all"
                  placeholder={t.userPlaceholder}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.password}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 pr-10 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all"
                  placeholder={t.passPlaceholder}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember me + Reset password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-white/5 accent-red-700 cursor-pointer"
                />
                <span className="text-sm text-gray-400">{t.rememberMe}</span>
              </label>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-sm text-red-500 hover:text-red-400 transition-colors"
              >
                {t.resetPwd}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: loading ? '#7f1d1d' : 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)', boxShadow: '0 4px 20px rgba(185,28,28,0.4)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.loggingIn}
                </span>
              ) : t.login}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-5">{t.footer}</p>
      </div>

      {/* Reset Password modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowReset(false)}>
          <div
            className="w-full max-w-xs rounded-2xl p-6 border relative"
            style={{
              background: 'rgba(15,15,15,0.95)',
              borderColor: 'rgba(185,28,28,0.5)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowReset(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-700/20 mb-3">
                <Lock size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t.resetTitle}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{t.resetBody}</p>
              <p className="text-gray-500 text-xs mt-2">admin@cssteelproducts.co.th</p>
            </div>
            <button
              onClick={() => setShowReset(false)}
              className="w-full mt-5 py-2.5 rounded-lg font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)' }}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
