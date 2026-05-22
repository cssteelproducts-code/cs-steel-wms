import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import {
  Truck, LogIn, FileText, Database, Network, LogOut,
  BarChart2, Clock, Building2, Users, Menu,
} from 'lucide-react';

const NAV = [
  { path: '/checkin',     label: 'รับรถเข้า',       icon: LogIn     },
  { path: '/loading',     label: 'Pick',            icon: FileText  },
  { path: '/datastation', label: 'สถานีขึ้นสินค้า', icon: Network   },
  { path: '/checkout',    label: 'บันทึกออก',       icon: LogOut    },
  { path: '/warehouse',   label: 'คลังสำเร็จรูป',   icon: Building2 },
  { path: '/delivery',    label: 'จัดส่ง',          icon: Truck     },
  { path: '/dashboard',   label: 'เมนู',            icon: BarChart2 },
  { path: '/stdmonitor',  label: 'ติดตาม STD',      icon: Clock     },
  { path: '/data',        label: 'Data',            icon: Database  },
  { path: '/users',       label: 'จัดการผู้ใช้',    icon: Users     },
];

export default function Layout() {
  const [open, setOpen] = useState(true);
  const loc = useLocation();
  const nav = useNavigate();

  const displayName = localStorage.getItem('displayName') || '';
  const role        = localStorage.getItem('role') || '';

  async function logout() {
    await authApi.logout().catch(() => {});
    ['token','role','displayName'].forEach(k => localStorage.removeItem(k));
    nav('/login');
  }

  const isActive = (path) =>
    path === '/dashboard' ? loc.pathname === '/dashboard' : loc.pathname.startsWith(path);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: open ? 200 : 0, minWidth: open ? 200 : 0,
        background: 'var(--sidebar)',
        overflow: 'hidden', transition: 'width .2s, min-width .2s',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '2px 0 8px rgba(0,0,0,.15)',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 14px 14px', borderBottom:'1px solid rgba(255,255,255,.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <img src="/logo.png" alt="CS" style={{ width:38, height:38, objectFit:'contain', flexShrink:0, filter:'drop-shadow(0 1px 6px rgba(0,0,0,.25))' }}/>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.2 }}>CS.Smart</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', lineHeight:1.3 }}>Warehouse &amp; Transport</div>
            </div>
          </div>

        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
          {NAV.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path} style={{
                display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
                textDecoration:'none', fontSize:13,
                background: active ? 'rgba(0,0,0,.25)' : 'transparent',
                color: '#fff',
                borderLeft: `3px solid ${active ? '#fff' : 'transparent'}`,
                opacity: active ? 1 : 0.85,
                transition: 'background .15s, opacity .15s',
              }}>
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8}/>
                <span style={{ fontWeight: active ? 700 : 400 }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding:'10px 14px', fontSize:10, color:'rgba(255,255,255,.45)', borderTop:'1px solid rgba(255,255,255,.15)' }}>
          v1.0.0 · CS Steel 2026
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', gap:10, padding:'0 20px', height:52, background:'#fff', borderBottom:'2px solid #CC0000', flexShrink:0 }}>
          <button onClick={() => setOpen(o => !o)} style={{ background:'none', border:'none', color:'#CC0000', cursor:'pointer', display:'flex', padding:4 }}>
            <Menu size={20}/>
          </button>
          <div style={{ width:1, height:24, background:'#f0d0d0' }}/>
          <span style={{ fontWeight:700, fontSize:14, color:'#1a1a1a' }}>
            {NAV.find(n => isActive(n.path))?.label || 'CS Steel WMS'}
          </span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', lineHeight:1.3 }}>{displayName}</span>
              <span style={{ fontSize:11, color:'#888', lineHeight:1.3 }}>{role}</span>
            </div>
            <button onClick={logout} style={{
              display:'flex', alignItems:'center', gap:6,
              background:'#CC0000', color:'#fff', border:'none',
              borderRadius:7, padding:'6px 14px', fontSize:13, cursor:'pointer',
            }}>
              <LogOut size={14}/> ออก
            </button>
          </div>
        </header>

        <main style={{ flex:1, overflowY:'auto', background:'#fff' }}>
          <Outlet/>
        </main>
      </div>
    </div>
  );
}
