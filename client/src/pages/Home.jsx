import { useNavigate } from 'react-router-dom';
import {
  LogIn, FileText, Network, LogOut, BarChart2,
  Clock, Navigation, Building2, Truck, Database, Users,
} from 'lucide-react';

const MENUS = [
  {
    path: '/checkin',
    label: 'รับรถเข้า',
    desc: 'บันทึกรถเข้าคลัง',
    icon: LogIn,
    color: '#CC0000',
    bg: '#fff0f0',
    roles: ['manager','dept_head','section_chief','weight_officer'],
  },
  {
    path: '/loading',
    label: 'สถานี Data / Pick',
    desc: 'ออกใบ Pick Slip',
    icon: FileText,
    color: '#2563eb',
    bg: '#eff6ff',
    roles: ['manager','dept_head','section_chief','data_officer'],
  },
  {
    path: '/datastation',
    label: 'สถานีขึ้นสินค้า',
    desc: 'บันทึกเวลาเข้า-ออกสถานี',
    icon: Network,
    color: '#7c3aed',
    bg: '#f5f3ff',
    roles: ['manager','dept_head','section_chief','unit_chief','locker_officer','checker_officer'],
  },
  {
    path: '/checkout',
    label: 'บันทึกออก',
    desc: 'ชั่งน้ำหนักขาออก',
    icon: LogOut,
    color: '#d97706',
    bg: '#fffbeb',
    roles: ['manager','dept_head','section_chief','weight_officer'],
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    desc: 'ภาพรวมการขนส่ง',
    icon: BarChart2,
    color: '#059669',
    bg: '#f0fdf4',
    roles: ['manager','dept_head','section_chief','unit_chief','checker_officer','warehouse_admin','sales','weight_officer'],
  },
  {
    path: '/stdmonitor',
    label: 'ติดตาม STD',
    desc: 'ตรวจสอบเวลามาตรฐาน',
    icon: Clock,
    color: '#CC0000',
    bg: '#fff0f0',
    roles: ['manager','dept_head','section_chief'],
  },
  {
    path: '/eta',
    label: 'ETA ติดตามรถ',
    desc: 'GPS Live / เวลาถึง',
    icon: Navigation,
    color: '#0891b2',
    bg: '#ecfeff',
    roles: ['manager','dept_head','section_chief','unit_chief','checker_officer','warehouse_admin','weight_officer','data_officer'],
  },
  {
    path: '/warehouse',
    label: 'คลังสินค้า',
    desc: 'จัดการสต็อก',
    icon: Building2,
    color: '#4f46e5',
    bg: '#eef2ff',
    roles: ['manager','dept_head','section_chief','unit_chief'],
  },
  {
    path: '/delivery',
    label: 'จัดส่ง',
    desc: 'แผนและต้นทุนการจัดส่ง',
    icon: Truck,
    color: '#0f766e',
    bg: '#f0fdfa',
    roles: ['manager','dept_head','section_chief','unit_chief','locker_officer','checker_officer','data_officer','warehouse_admin','sales','weight_officer'],
  },
  {
    path: '/data',
    label: 'ข้อมูล',
    desc: 'สินค้า / ลูกค้า',
    icon: Database,
    color: '#64748b',
    bg: '#f8fafc',
    roles: ['manager','dept_head','section_chief','unit_chief','locker_officer','checker_officer','data_officer','warehouse_admin','sales','weight_officer'],
  },
  {
    path: '/users',
    label: 'ผู้ใช้งาน',
    desc: 'จัดการบัญชีผู้ใช้',
    icon: Users,
    color: '#374151',
    bg: '#f9fafb',
    roles: ['manager','dept_head'],
  },
];

export default function Home() {
  const nav  = useNavigate();
  const role = localStorage.getItem('role') || '';
  const displayName = localStorage.getItem('displayName') || '';

  const visible = MENUS.filter(m => m.roles.includes(role));

  return (
    <div style={{ minHeight:'100%', background:'#f9fafb', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #f0d0d0', padding:'20px 28px' }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#1a1a1a', marginBottom:4 }}>
          สวัสดี, {displayName || 'ผู้ใช้'} 👋
        </h1>
        <p style={{ fontSize:13, color:'#888' }}>เลือกเมนูที่ต้องการใช้งาน</p>
      </div>

      {/* Menu Grid */}
      <div style={{ padding:'24px 28px' }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',
          gap:16,
          maxWidth:960,
        }}>
          {visible.map(({ path, label, desc, icon: Icon, color, bg }) => (
            <button
              key={path}
              type="button"
              onClick={() => nav(path)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'flex-start',
                gap:12, padding:'20px', background:'#fff',
                border:'1.5px solid #f0d0d0', borderRadius:14,
                cursor:'pointer', textAlign:'left',
                transition:'box-shadow .15s, border-color .15s',
                boxShadow:'0 1px 4px rgba(0,0,0,.05)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,.1)`;
                e.currentTarget.style.borderColor = color;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)';
                e.currentTarget.style.borderColor = '#f0d0d0';
              }}
            >
              <div style={{
                width:44, height:44, borderRadius:12,
                background:bg, display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Icon size={22} color={color}/>
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
