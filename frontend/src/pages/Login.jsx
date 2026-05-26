import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, User, X, ChevronLeft } from 'lucide-react';
import logoImg from '../assets/Logo.png';

const LANGS = {
  th: {
    flag: '🇹🇭',
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
    footer: 'CS Steel WMS v1.0 | สงวนสิทธิ์สำหรับพนักงาน',
    errRequired: 'กรุณากรอก Username และ Password',
    // Reset modal
    resetTitle: 'รีเซ็ตรหัสผ่าน',
    step1Title: 'ยืนยันตัวตน',
    step1Desc: 'กรอก Username และ ชื่อ-นามสกุล ที่ลงทะเบียนไว้ในระบบ',
    step2Title: 'ตั้งรหัสผ่านใหม่',
    fullName: 'ชื่อ-นามสกุล (ในระบบ)',
    fullNamePlaceholder: 'กรอกชื่อ-นามสกุลตามที่ลงทะเบียน',
    newPassword: 'รหัสผ่านใหม่',
    newPassPlaceholder: 'อย่างน้อย 6 ตัวอักษร',
    confirmPassword: 'ยืนยันรหัสผ่านใหม่',
    confirmPassPlaceholder: 'กรอกรหัสผ่านอีกครั้ง',
    next: 'ถัดไป',
    back: 'ย้อนกลับ',
    resetBtn: 'รีเซ็ตรหัสผ่าน',
    resetting: 'กำลังรีเซ็ต...',
    errPassMismatch: 'รหัสผ่านไม่ตรงกัน',
    errPassLength: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    close: 'ปิด',
  },
  en: {
    flag: '🇬🇧',
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
    footer: 'CS Steel WMS v1.0 | Authorized personnel only',
    errRequired: 'Please enter Username and Password',
    resetTitle: 'Reset Password',
    step1Title: 'Verify Identity',
    step1Desc: 'Enter your Username and Full Name as registered in the system.',
    step2Title: 'Set New Password',
    fullName: 'Full Name (as registered)',
    fullNamePlaceholder: 'Enter your registered full name',
    newPassword: 'New Password',
    newPassPlaceholder: 'At least 6 characters',
    confirmPassword: 'Confirm New Password',
    confirmPassPlaceholder: 'Re-enter new password',
    next: 'Next',
    back: 'Back',
    resetBtn: 'Reset Password',
    resetting: 'Resetting...',
    errPassMismatch: 'Passwords do not match',
    errPassLength: 'Password must be at least 6 characters',
    close: 'Close',
  },
  my: {
    flag: '🇲🇲',
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
    footer: 'CS Steel WMS v1.0 | ဝန်ထမ်းများအတွက်သာ',
    errRequired: 'Username နှင့် Password ထည့်ပါ',
    resetTitle: 'စကားဝှက် ပြန်သတ်မှတ်ရန်',
    step1Title: 'အထောက်အထားစစ်ဆေးခြင်း',
    step1Desc: 'စနစ်တွင် မှတ်ပုံတင်ထားသော Username နှင့် အမည်အပြည့်အစုံ ထည့်ပါ။',
    step2Title: 'စကားဝှက်အသစ် သတ်မှတ်ရန်',
    fullName: 'အမည်အပြည့်အစုံ (မှတ်ပုံတင်ထားသည့်)',
    fullNamePlaceholder: 'မှတ်ပုံတင်ထားသော အမည်ထည့်ပါ',
    newPassword: 'စကားဝှက်အသစ်',
    newPassPlaceholder: 'အနည်းဆုံး ၆ လုံး',
    confirmPassword: 'စကားဝှက်အသစ် အတည်ပြုရန်',
    confirmPassPlaceholder: 'စကားဝှက်ထပ်မံထည့်ပါ',
    next: 'ဆက်လက်',
    back: 'နောက်သို့',
    resetBtn: 'စကားဝှက်ပြန်သတ်မှတ်',
    resetting: 'ပြန်သတ်မှတ်နေသည်...',
    errPassMismatch: 'စကားဝှက်များ မတိုက်ကိုက်ပါ',
    errPassLength: 'စကားဝှက် အနည်းဆုံး ၆ လုံး လိုသည်',
    close: 'ပိတ်ရန်',
  },
};

// Steel architecture SVG background
function SteelBackground() {
  const s  = 'rgba(220,220,220,0.055)';
  const sm = 'rgba(220,220,220,0.035)';
  const sw = 'rgba(220,220,220,0.08)';
  const rd = 'rgba(185,28,28,0.12)';
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Floor perspective grid */}
      {[0,120,240,360,480,600,720,840,960,1080,1200,1320,1440].map(x => (
        <line key={`vg${x}`} x1={x} y1="700" x2={(x+720)%1440} y2="900" stroke={sm} strokeWidth="1"/>
      ))}
      {[720,810,900].map((y,i) => (
        <line key={`hg${i}`} x1="0" y1={y} x2="1440" y2={y} stroke={sm} strokeWidth="1"/>
      ))}
      {/* Outer arch + red glow */}
      <path d="M -60 950 Q 720 -80 1500 950" fill="none" stroke={rd} strokeWidth="14"/>
      <path d="M -60 950 Q 720 -80 1500 950" fill="none" stroke={sw} strokeWidth="12"/>
      <path d="M 60 950 Q 720 60 1380 950"   fill="none" stroke={s}  strokeWidth="7"/>
      <path d="M 160 950 Q 720 200 1280 950"  fill="none" stroke={sm} strokeWidth="5"/>
      <path d="M 300 950 Q 720 360 1140 950"  fill="none" stroke={sm} strokeWidth="3"/>
      {/* Left columns (I-beam profile) */}
      <line x1="60" y1="0" x2="60" y2="950"   stroke={sw} strokeWidth="9"/>
      <line x1="68" y1="0" x2="68" y2="950"   stroke={s}  strokeWidth="3"/>
      <line x1="52" y1="0" x2="52" y2="950"   stroke={s}  strokeWidth="3"/>
      <line x1="200" y1="280" x2="200" y2="950" stroke={s} strokeWidth="6"/>
      <line x1="207" y1="280" x2="207" y2="950" stroke={sm} strokeWidth="2"/>
      <line x1="193" y1="280" x2="193" y2="950" stroke={sm} strokeWidth="2"/>
      <line x1="360" y1="430" x2="360" y2="950" stroke={s}  strokeWidth="5"/>
      <line x1="540" y1="540" x2="540" y2="950" stroke={sm} strokeWidth="4"/>
      {/* Center */}
      <line x1="720" y1="170" x2="720" y2="950" stroke={s} strokeWidth="5"/>
      {/* Right columns (mirror) */}
      <line x1="900"  y1="540" x2="900"  y2="950" stroke={sm} strokeWidth="4"/>
      <line x1="1080" y1="430" x2="1080" y2="950" stroke={s}  strokeWidth="5"/>
      <line x1="1240" y1="280" x2="1240" y2="950" stroke={s}  strokeWidth="6"/>
      <line x1="1247" y1="280" x2="1247" y2="950" stroke={sm} strokeWidth="2"/>
      <line x1="1233" y1="280" x2="1233" y2="950" stroke={sm} strokeWidth="2"/>
      <line x1="1380" y1="0"   x2="1380" y2="950" stroke={sw} strokeWidth="9"/>
      <line x1="1388" y1="0"   x2="1388" y2="950" stroke={s}  strokeWidth="3"/>
      <line x1="1372" y1="0"   x2="1372" y2="950" stroke={s}  strokeWidth="3"/>
      {/* Horizontal beams */}
      <line x1="0" y1="180" x2="1440" y2="180" stroke={sm} strokeWidth="4"/>
      <line x1="0" y1="186" x2="1440" y2="186" stroke={sm} strokeWidth="2"/>
      <line x1="0" y1="420" x2="1440" y2="420" stroke={sm} strokeWidth="3"/>
      <line x1="0" y1="600" x2="1440" y2="600" stroke={sm} strokeWidth="3"/>
      <line x1="0" y1="700" x2="1440" y2="700" stroke={s}  strokeWidth="5"/>
      <line x1="0" y1="706" x2="1440" y2="706" stroke={sm} strokeWidth="2"/>
      {/* X-bracing panels */}
      {[[60,200],[200,360],[360,540],[540,720],[720,900],[900,1080],[1080,1240],[1240,1380]].map(([a,b],i)=>(
        <g key={`xb${i}`}>
          <line x1={a} y1="420" x2={b} y2="600" stroke={sm} strokeWidth="2"/>
          <line x1={b} y1="420" x2={a} y2="600" stroke={sm} strokeWidth="2"/>
        </g>
      ))}
      {/* Truss pendants from arch */}
      {[200,360,540,720,900,1080,1240].map((x,i)=>{
        const ay = 950 - 1030*Math.sin(Math.PI*(x/1440));
        return <line key={`tv${i}`} x1={x} y1={ay+8} x2={x} y2="420" stroke={sm} strokeWidth="2" strokeDasharray="8 6"/>;
      })}
      {/* I-beam flanges at joints */}
      {[60,200,360,540,720,900,1080,1240,1380].map((x,i)=>(
        <g key={`fl${i}`}>
          <line x1={x-14} y1="420" x2={x+14} y2="420" stroke={s} strokeWidth="3"/>
          <line x1={x-14} y1="600" x2={x+14} y2="600" stroke={s} strokeWidth="3"/>
        </g>
      ))}
    </svg>
  );
}

// Reusable password input
function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange}
        className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 pr-10 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all"
        placeholder={placeholder} autoComplete="new-password"/>
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
        {show ? <EyeOff size={15}/> : <Eye size={15}/>}
      </button>
    </div>
  );
}

// ─── Reset Password Modal ────────────────────────────────────────────────────
function ResetModal({ t, onClose }) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const goStep2 = () => {
    if (!username.trim() || !fullName.trim()) {
      toast.error(t.errRequired); return;
    }
    setStep(2);
  };

  const handleReset = async () => {
    if (newPass.length < 6) { toast.error(t.errPassLength); return; }
    if (newPass !== confirmPass) { toast.error(t.errPassMismatch); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { username: username.trim(), fullName: fullName.trim(), newPassword: newPass });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 border relative"
        style={{ background: 'rgba(12,12,12,0.97)', borderColor: 'rgba(185,28,28,0.45)',
                 boxShadow: '0 8px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(185,28,28,0.1)' }}
        onClick={e => e.stopPropagation()}>

        <button onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors">
          <X size={18}/>
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          {step === 2 && !done && (
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-300 transition-colors mr-1">
              <ChevronLeft size={20}/>
            </button>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">
              {done ? '✅ ' : ''}{t.resetTitle}
            </h3>
            {!done && (
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 1 ? t.step1Title : t.step2Title}
              </p>
            )}
          </div>
          {/* Step indicator */}
          {!done && (
            <div className="flex gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${step >= 1 ? 'bg-red-600' : 'bg-gray-700'}`}/>
              <div className={`w-2 h-2 rounded-full transition-colors ${step >= 2 ? 'bg-red-600' : 'bg-gray-700'}`}/>
            </div>
          )}
        </div>

        {/* Done state */}
        {done ? (
          <div className="text-center py-2">
            <p className="text-gray-300 text-sm mb-5">
              {t.lang === 'my'
                ? 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။'
                : 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'}
            </p>
            <button onClick={onClose} className="w-full py-2.5 rounded-lg font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)' }}>
              {t.close}
            </button>
          </div>
        ) : step === 1 ? (
          /* Step 1 — identity */
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed -mt-2">{t.step1Desc}</p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t.username}</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all text-sm"
                  placeholder={t.userPlaceholder} autoFocus/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t.fullName}</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all text-sm"
                  placeholder={t.fullNamePlaceholder}
                  onKeyDown={e => e.key === 'Enter' && goStep2()}/>
              </div>
            </div>
            <button onClick={goStep2}
              className="w-full py-2.5 rounded-lg font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)' }}>
              {t.next} →
            </button>
          </div>
        ) : (
          /* Step 2 — new password */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t.newPassword}</label>
              <PasswordInput value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder={t.newPassPlaceholder} id="new-pass"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t.confirmPassword}</label>
              <PasswordInput value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                placeholder={t.confirmPassPlaceholder} id="confirm-pass"/>
              {confirmPass && newPass !== confirmPass && (
                <p className="text-xs text-red-500 mt-1">{t.errPassMismatch}</p>
              )}
            </div>
            <button onClick={handleReset} disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  {t.resetting}
                </span>
              ) : t.resetBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Login Page ─────────────────────────────────────────────────────────
export default function Login() {
  const [lang, setLang] = useState('th');
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = { ...LANGS[lang], lang };

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
    if (!form.username || !form.password) { toast.error(t.errRequired); return; }
    if (rememberMe) {
      localStorage.setItem('wms_remember', JSON.stringify({ username: form.username, password: form.password }));
    } else {
      localStorage.removeItem('wms_remember');
    }
    setLoading(true);
    try {
      const result = await login(form.username, form.password);
      if (result.success) {
        toast.success(`ยินดีต้อนรับ ${result.user.fullName}`);
        navigate('/');
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0505 50%, #0d0d0d 100%)' }}>

      <SteelBackground/>

      {/* Corner glows */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(185,28,28,0.08) 0%, transparent 70%)' }}/>
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(185,28,28,0.06) 0%, transparent 70%)' }}/>

      {/* Language switcher — flag buttons */}
      <div className="absolute top-4 right-4 flex gap-1.5 z-10">
        {(['th','en','my']).map(l => (
          <button key={l} onClick={() => setLang(l)}
            className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
              lang === l
                ? 'bg-red-700/60 ring-1 ring-red-500 scale-110 shadow-lg'
                : 'bg-white/8 hover:bg-white/15 opacity-60 hover:opacity-100'
            }`}
            title={l === 'th' ? 'ภาษาไทย' : l === 'en' ? 'English' : 'မြန်မာဘာသာ'}>
            {LANGS[l].flag}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo — frameless, direct with glow */}
        <div className="text-center mb-6">
          <div className="inline-block mb-3">
            <img
              src={logoImg}
              alt="CS Steel"
              className="w-28 h-28 object-contain rounded-2xl"
              style={{ filter: 'drop-shadow(0 0 24px rgba(185,28,28,0.55)) drop-shadow(0 4px 16px rgba(0,0,0,0.7))' }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">{t.title}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t.subtitle}</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 shadow-2xl border"
          style={{ background: 'rgba(10,10,10,0.82)', backdropFilter: 'blur(16px)',
                   borderColor: 'rgba(185,28,28,0.4)',
                   boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(185,28,28,0.15)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.username}</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input type="text" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all"
                  placeholder={t.userPlaceholder} autoComplete="username" autoFocus/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.password}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 pl-9 pr-10 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent transition-all"
                  placeholder={t.passPlaceholder} autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Remember me + Reset */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-white/5 accent-red-700 cursor-pointer"/>
                <span className="text-sm text-gray-400">{t.rememberMe}</span>
              </label>
              <button type="button" onClick={() => setShowReset(true)}
                className="text-sm text-red-500 hover:text-red-400 transition-colors">
                {t.resetPwd}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: loading ? '#7f1d1d' : 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
                       boxShadow: '0 4px 20px rgba(185,28,28,0.4)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  {t.loggingIn}
                </span>
              ) : t.login}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-5">{t.footer}</p>
      </div>

      {showReset && <ResetModal t={t} onClose={() => setShowReset(false)}/>}
    </div>
  );
}
