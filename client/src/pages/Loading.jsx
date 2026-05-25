import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trucksApi, plansApi } from '../api';
import { ArrowLeft, Search, Network, Truck, ChevronUp, ChevronDown } from 'lucide-react';

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

/* collapsible section */
function Section({ title, icon: Icon, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'#fff', border:'none', cursor:'pointer', textAlign:'left' }}
      >
        <Icon size={16} color="#CC0000"/>
        <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', flex:1 }}>
          {title}
          {count > 0 && <span style={{ marginLeft:8, background:'#CC0000', color:'#fff', borderRadius:10, fontSize:11, padding:'1px 8px' }}>{count}</span>}
        </span>
        {open ? <ChevronUp size={16} color="#888"/> : <ChevronDown size={16} color="#888"/>}
      </button>
      {open && (
        <div style={{ borderTop:'1px solid #f0d0d0', background:'#fafafa' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* empty state */
function Empty({ icon: Icon, text, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px', gap:12 }}>
      <Icon size={48} color="#d1d5db" strokeWidth={1}/>
      <p style={{ fontSize:14, color:'#9ca3af' }}>{text}</p>
      {sub && <p style={{ fontSize:12, color:'#d1d5db' }}>{sub}</p>}
    </div>
  );
}

export default function Loading() {
  const nav        = useNavigate();
  const [search, setSearch] = useState('');
  const [searched, setSearched] = useState('');

  const { data: trucksData } = useQuery({ queryKey:['trucks'], queryFn: trucksApi.getAll });
  const { data: plansData  } = useQuery({ queryKey:['plans'],  queryFn: plansApi.getAll  });

  const today  = todayStr();

  // trucks currently active (checked in, not yet checked out)
  const atStation = (trucksData?.active || []);
  const filtered  = searched
    ? atStation.filter(t => t.licensePlate?.toLowerCase().includes(searched.toLowerCase()))
    : atStation;

  // confirmed plans for today
  const todayPlans = (plansData?.plans || []).filter(p => p.planDate === today && p.status === 'ยืนยันแล้ว');

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>📋 สถานี Data</h2>
          <p style={{ fontSize:12, color:'#888' }}>ออกใบ Pick</p>
        </div>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16, maxWidth:960 }}>

        {/* Search */}
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:8 }}>ค้นหาทะเบียน</p>
          <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
            <input
              placeholder="ทะเบียนรถ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearched(search)}
              style={{ flex:1, border:'none', borderRadius:0, fontSize:14, padding:'11px 16px', outline:'none' }}
            />
            <button
              type="button"
              onClick={() => setSearched(search)}
              style={{ background:'#CC0000', border:'none', padding:'0 18px', cursor:'pointer', display:'flex', alignItems:'center' }}
            >
              <Search size={18} color="#fff"/>
            </button>
          </div>
        </div>

        {/* Section 1 — ปริมาณรถสะสมที่สถานี */}
        <Section title="ปริมาณรถสะสมที่สถานี" icon={Network} count={filtered.length}>
          {filtered.length === 0 ? (
            <Empty icon={Network} text="ยังไม่มีรถสะสมที่สถานี"/>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {filtered.map((t, i) => (
                <div key={t.truckId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', borderBottom: i < filtered.length-1 ? '1px solid #f5e0e0' : 'none', background:'#fff' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{t.licensePlate}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{t.vehicleType} · {t.arname || '-'}</div>
                  </div>
                  <span style={{ fontSize:12, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:6, padding:'3px 10px' }}>
                    กำลังดำเนินการ
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Section 2 — แผนจัดส่งวันนี้ */}
        <Section title="แผนจัดส่งวันนี้ (ยืนยันแล้ว)" icon={Truck} count={todayPlans.length}>
          {todayPlans.length === 0 ? (
            <Empty icon={Truck} text={`ยังไม่มีแผนยืนยันสำหรับวันนี้`} sub={today}/>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {todayPlans.map((p, i) => (
                <div key={p.planId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', borderBottom: i < todayPlans.length-1 ? '1px solid #f5e0e0' : 'none', background:'#fff' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{p.licensePlate}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{p.vehicleType} · {p.totalOrders} ออเดอร์ · {p.totalWeightKg?.toLocaleString()} กก.</div>
                  </div>
                  <span style={{ fontSize:12, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 10px' }}>
                    ยืนยันแล้ว
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
