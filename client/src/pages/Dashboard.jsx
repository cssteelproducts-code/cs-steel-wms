import { useNavigate } from 'react-router-dom';
import {
  Truck, LogIn, FileText, Database, Network, LogOut,
  BarChart2, Clock, Building2, Users,
} from 'lucide-react';

const MENUS = [
  { icon: LogIn,     label: 'รับรถเข้า',        sub: 'ชั่งน้ำหนักขาเข้า',   path: '/checkin'     },
  { icon: FileText,  label: 'Pick',             sub: 'ออกใบ Pick',           path: '/loading'     },
  { icon: Network,   label: 'สถานีขึ้นสินค้า',  sub: 'บันทึกเวลา',           path: '/datastation' },
  { icon: LogOut,    label: 'บันทึกออก',        sub: 'ชั่งน้ำหนักขาออก',     path: '/checkout'    },
  { icon: Building2, label: 'คลังสำเร็จรูป',    sub: 'Warehouse',            path: '/warehouse'   },
  { icon: Truck,     label: 'จัดส่ง',           sub: 'Dispatch',             path: '/delivery'    },
  { icon: BarChart2, label: 'Dashboard',        sub: 'ภาพรวมคลัง',           path: '/dashboard'   },
  { icon: Clock,     label: 'ติดตาม STD',       sub: 'เวลาขึ้นสินค้า',       path: '/stdmonitor'  },
  { icon: Database,  label: 'Data',             sub: 'สินค้า / ลูกค้า',      path: '/data'        },
  { icon: Users,     label: 'จัดการผู้ใช้',     sub: 'User Management',      path: '/users'       },
];

export default function Dashboard() {
  const nav         = useNavigate();
  const displayName = localStorage.getItem('displayName') || '';
  const role        = localStorage.getItem('role') || '';

  return (
    <div style={{ padding:'32px 36px', minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Greeting */}
      <div style={{ marginBottom:32, paddingBottom:20, borderBottom:'2px solid #CC0000' }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#CC0000', marginBottom:3 }}>
          สวัสดี, {displayName}
        </h1>
        <p style={{ fontSize:13, color:'#888' }}>{role} · เลือกเมนูเพื่อเริ่มทำงาน</p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 14,
        maxWidth: 1060,
      }}>
        {MENUS.map(({ icon: Icon, label, sub, path }) => (
          <button
            key={path + label}
            onClick={() => nav(path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 14, padding: '28px 12px 22px',
              background: '#fff',
              border: '1.5px solid #f0d0d0',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all .16s ease',
              boxShadow: '0 1px 4px rgba(204,0,0,.06)',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background    = '#CC0000';
              e.currentTarget.style.borderColor   = '#CC0000';
              e.currentTarget.style.boxShadow     = '0 6px 20px rgba(204,0,0,.25)';
              e.currentTarget.style.transform     = 'translateY(-3px)';
              e.currentTarget.querySelector('.icon-wrap').style.background = 'rgba(255,255,255,.2)';
              e.currentTarget.querySelector('.lbl').style.color   = '#fff';
              e.currentTarget.querySelector('.sub').style.color   = 'rgba(255,255,255,.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background    = '#fff';
              e.currentTarget.style.borderColor   = '#f0d0d0';
              e.currentTarget.style.boxShadow     = '0 1px 4px rgba(204,0,0,.06)';
              e.currentTarget.style.transform     = 'none';
              e.currentTarget.querySelector('.icon-wrap').style.background = '#fff0f0';
              e.currentTarget.querySelector('.lbl').style.color   = '#1a1a1a';
              e.currentTarget.querySelector('.sub').style.color   = '#888';
            }}
          >
            <div className="icon-wrap" style={{ width:58, height:58, borderRadius:16, background:'#fff0f0', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .16s' }}>
              <Icon size={28} color="#CC0000" strokeWidth={1.7}/>
            </div>
            <div>
              <div className="lbl" style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:4, transition:'color .16s' }}>{label}</div>
              <div className="sub" style={{ fontSize:11, color:'#888', lineHeight:1.4, transition:'color .16s' }}>{sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
