import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

/* ── DB Stats ── */
function DbStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch('/api/utils/db-stats').then(r => r.json()).then(d => { if (d.success) setStats(d); }).catch(() => {});
  }, []);
  if (!stats) return null;
  const pct   = stats.usedPct;
  const color = pct >= 85 ? '#dc2626' : pct >= 60 ? '#d97706' : '#16a34a';
  return (
    <div style={{ marginTop:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>🗄️ {stats.dbName}</span>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>{stats.server}</span>
      </div>
      <div style={{ background:'rgba(0,0,0,.2)', borderRadius:4, height:5, overflow:'hidden', marginBottom:5 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:'rgba(255,255,255,.8)', borderRadius:4, transition:'width .6s' }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(255,255,255,.6)' }}>
        <span>ใช้ {stats.usedMB.toFixed(1)} MB</span>
        <span style={{ fontWeight:700, color:'#fff' }}>{pct}%</span>
        <span>เหลือ {stats.freeMB.toFixed(1)} MB</span>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ── */
function ResetModal({ onClose }) {
  const [form, setForm]     = useState({ username:'', displayName:'', newPassword:'', confirm:'' });
  const [msg, setMsg]       = useState({ text:'', ok:false });
  const [loading, setLoading] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setMsg({ text:'รหัสผ่านไม่ตรงกัน', ok:false }); return; }
    if (form.newPassword.length < 4)       { setMsg({ text:'ต้องมีอย่างน้อย 4 ตัวอักษร', ok:false }); return; }
    setLoading(true); setMsg({ text:'', ok:false });
    try {
      const res = await authApi.resetPassword({ username:form.username, displayName:form.displayName, newPassword:form.newPassword });
      if (res.success) {
        setMsg({ text:'✓ รีเซ็ตสำเร็จ กรุณาเข้าสู่ระบบใหม่', ok:true });
        setForm({ username:'', displayName:'', newPassword:'', confirm:'' });
      } else { setMsg({ text:res.message, ok:false }); }
    } catch { setMsg({ text:'ไม่สามารถเชื่อมต่อ Server ได้', ok:false }); }
    finally { setLoading(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.5)', backdropFilter:'blur(4px)' }}>
      <div style={{ width:420, background:'#fff', borderRadius:16, padding:'28px', boxShadow:'0 20px 60px rgba(0,0,0,.2)', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'#f3f4f6', border:'none', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6b7280', fontSize:18, lineHeight:1 }}>
          ✕
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:40, height:40, background:'#ffebee', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <KeyRound size={20} color="#CC0000"/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#1f2937' }}>รีเซ็ตรหัสผ่าน</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>စကားဝှက်ပြန်လည်သတ်မှတ်ရန်</div>
          </div>
        </div>

        <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { key:'username',    label:'ชื่อผู้ใช้',                    mm:'· အသုံးပြုသူအမည်',           type:'text',     ph:'username'             },
            { key:'displayName', label:'ชื่อที่แสดงในระบบ',             mm:'· ပြသမည့်အမည် (ยืนยันตัวตน)', type:'text',     ph:'เช่น สมชาย ใจดี'       },
            { key:'newPassword', label:'รหัสผ่านใหม่',                  mm:'· စကားဝှက်အသစ်',              type:'password', ph:'อย่างน้อย 4 ตัวอักษร'  },
            { key:'confirm',     label:'ยืนยันรหัสผ่านใหม่',            mm:'· အတည်ပြုရန်',               type:'password', ph:'กรอกซ้ำอีกครั้ง'       },
          ].map(({ key, label, mm, type, ph }) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
                {label} <span style={{ fontSize:10, color:'#9ca3af', fontWeight:400 }}>{mm}</span>
              </label>
              <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]:e.target.value }))} required style={{ fontSize:13 }}/>
            </div>
          ))}

          {msg.text && (
            <div style={{ background:msg.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:msg.ok?'#16a34a':'#dc2626' }}>
              {msg.text}
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button type="submit" disabled={loading} style={{ flex:1, background:'#CC0000', color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:loading?0.7:1 }}>
              <div>{loading ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}</div>
              <div style={{ fontSize:10, fontWeight:400, opacity:0.8, marginTop:1 }}>{loading ? 'သတ်မှတ်နေသည်...' : 'စကားဝှက်ပြန်လည်သတ်မှတ်'}</div>
            </button>
            <button type="button" onClick={onClose} style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, cursor:'pointer' }}>
              <div>ยกเลิก</div>
              <div style={{ fontSize:10, opacity:0.7, marginTop:1 }}>မလုပ်တော့</div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Login ── */
export default function Login() {
  const nav = useNavigate();
  const [form, setForm]         = useState({ username:'', password:'' });
  const [remember, setRemember] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('savedUsername');
    if (saved) { setForm(f => ({ ...f, username:saved })); setRemember(true); }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await authApi.login(form.username, form.password);
      if (!res.success) { setError(res.message); return; }
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', res.role);
      localStorage.setItem('displayName', res.displayName);
      if (remember) localStorage.setItem('savedUsername', form.username);
      else localStorage.removeItem('savedUsername');
      nav('/dashboard');
    } catch { setError('ไม่สามารถเชื่อมต่อ Server ได้'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .login-brand { display: none !important; }
          .login-right { padding: 24px 16px !important; }
        }
      `}</style>

      {/* ── LEFT — Brand panel ── */}
      <div className="login-brand" style={{ flex:1, background:'#CC0000', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'52px 44px' }}>
        <div>
          <img src="/logo.png" alt="CS" style={{ width:72, height:72, objectFit:'contain', marginBottom:24, filter:'drop-shadow(0 2px 8px rgba(0,0,0,.2))' }}/>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.3, marginBottom:8, whiteSpace:'nowrap' }}>
            CS.Smart Warehouse &amp; Transport
          </h1>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.85)', marginBottom:4 }}>Operations Platform</p>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:4 }}>ระบบจัดการคลังสินค้าและการขนส่ง</p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>ဂိုဒေါင်စီမံခန့်ခွဲမှုနှင့် ပို့ဆောင်ရေးစနစ်</p>
        </div>
        <div>
          <DbStats/>
          <p style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:16 }}>v1.0.0 · CS Steel 2026</p>
        </div>
      </div>

      {/* ── RIGHT — Login form ── */}
      <div className="login-right" style={{ flex:1, background:'#f4f6f9', display:'flex', alignItems:'center', justifyContent:'center', padding:32 }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* Card */}
          <div style={{ background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:4 }}>เข้าสู่ระบบ</h2>
              <p style={{ fontSize:13, color:'#9ca3af' }}>
                ยินดีต้อนรับ · <span style={{ fontSize:12 }}>ကြိုဆိုပါသည်</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Username */}
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
                  User <span style={{ fontSize:10, color:'#9ca3af', fontWeight:400 }}>· အသုံးပြုသူအမည်</span>
                </label>
                <input
                  placeholder="กรอก username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username:e.target.value }))}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
                  Password <span style={{ fontSize:10, color:'#9ca3af', fontWeight:400 }}>· စကားဝှက်</span>
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password:e.target.value }))}
                    autoComplete="current-password"
                    required
                    style={{ paddingRight:44 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#9ca3af', cursor:'pointer', display:'flex', padding:4 }}>
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width:15, height:15, accentColor:'#CC0000' }}/>
                  <span style={{ fontSize:13, color:'#6b7280' }}>จดจำชื่อผู้ใช้</span>
                </label>
                <button type="button" onClick={() => setShowReset(true)} style={{ background:'none', border:'none', color:'#CC0000', fontSize:13, cursor:'pointer', fontWeight:600, padding:0 }}>
                  ลืมรหัสผ่าน?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding:'13px', fontSize:15, fontWeight:700, borderRadius:10, opacity:loading?0.7:1, marginTop:4, boxShadow:'0 4px 14px rgba(204,0,0,.35)' }}>
                {loading ? '⏳ Logging in...' : 'Login'}
              </button>
            </form>
          </div>

          <p style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#9ca3af' }}>
            CS.Smart WMS · Powered by CS Steel
          </p>
        </div>
      </div>

      {/* Reset Modal */}
      {showReset && <ResetModal onClose={() => setShowReset(false)}/>}
    </div>
  );
}
