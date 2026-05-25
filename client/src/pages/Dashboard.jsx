import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, trucksApi } from '../api';
import { Truck, Calendar, BarChart2, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

const VT_ORDER = ['4 ล้อ','6 ล้อ','8 ล้อ','10 ล้อ','12 ล้อ','เทเลอร์','พ่วง'];
const VT_COLORS = { '4 ล้อ':'#3b82f6','6 ล้อ':'#10b981','8 ล้อ':'#f59e0b','10 ล้อ':'#8b5cf6','12 ล้อ':'#ef4444','เทเลอร์':'#06b6d4','พ่วง':'#f97316' };

function StatCard({ icon: Icon, label, value, sub, color = '#CC0000' }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #f0d0d0', borderRadius:12, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={22} color={color}/>
      </div>
      <div>
        <div style={{ fontSize:26, fontWeight:800, color:'#1a1a1a', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:'#888', marginTop:3 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function VBreak({ data, label }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <div>
      <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>{label} — รวม <span style={{ fontWeight:700, color:'#CC0000' }}>{total}</span> คัน</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {VT_ORDER.filter(v => data[v]).map(v => (
          <span key={v} style={{ fontSize:12, padding:'4px 12px', borderRadius:20, background:`${VT_COLORS[v]}18`, color: VT_COLORS[v], border:`1px solid ${VT_COLORS[v]}40`, fontWeight:600 }}>
            {v} <span style={{ fontWeight:800 }}>{data[v]}</span>
          </span>
        ))}
        {total === 0 && <span style={{ fontSize:12, color:'#bbb' }}>ยังไม่มีข้อมูล</span>}
      </div>
    </div>
  );
}

function PieChart({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:20 }}>ยังไม่มีข้อมูล</div>;
  let angle = 0;
  const slices = VT_ORDER.filter(v => data[v]).map(v => {
    const pct = (data[v] / total) * 360;
    const slice = { v, count: data[v], start: angle, end: angle + pct, color: VT_COLORS[v] };
    angle += pct;
    return slice;
  });
  function polarToXY(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {slices.map(s => {
          const p1 = polarToXY(s.start, 52);
          const p2 = polarToXY(s.end, 52);
          const large = s.end - s.start > 180 ? 1 : 0;
          return (
            <path key={s.v}
              d={`M60,60 L${p1.x},${p1.y} A52,52 0 ${large},1 ${p2.x},${p2.y} Z`}
              fill={s.color} stroke="#fff" strokeWidth="1.5"
            />
          );
        })}
        <circle cx="60" cy="60" r="28" fill="#fff"/>
        <text x="60" y="57" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1a1a1a">{total}</text>
        <text x="60" y="69" textAnchor="middle" fontSize="9" fill="#888">คัน</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {slices.map(s => (
          <div key={s.v} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:s.color, flexShrink:0 }}/>
            <span style={{ color:'#374151' }}>{s.v}</span>
            <span style={{ fontWeight:700, color:'#1a1a1a' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      <div style={{ width:4, height:18, background:'#CC0000', borderRadius:2 }}/>
      <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{children}</span>
    </div>
  );
}

export default function Dashboard() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [searched, setSearched] = useState(false);

  const { data: dash, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  dashboardApi.getStats,
    refetchInterval: 120_000,
  });
  const { data: trucksData } = useQuery({ queryKey:['trucks'], queryFn: trucksApi.getAll });

  const trucks    = trucksData?.trucks || [];
  const atStation = trucks.filter(t => t.status === 'กำลังดำเนินการ');
  const history   = searched && dateFrom
    ? trucks.filter(t => {
        const d = t.date || t.checkinDate || '';
        return d >= dateFrom && d <= (dateTo || dateFrom);
      })
    : [];

  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#bbb', flexDirection:'column', gap:12 }}>
      <RefreshCw size={32} color="#f0d0d0" style={{ animation:'spin 1s linear infinite' }}/>
      <span>กำลังโหลด Dashboard...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const d = dash || {};

  return (
    <div style={{ padding:'20px 24px', background:'#f9fafb', minHeight:'100%', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#1a1a1a' }}>Dashboard</h2>
          <p style={{ fontSize:12, color:'#888' }}>ภาพรวมการขนส่ง · {d.today || ''}</p>
        </div>
        <button onClick={() => refetch()} style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #f0d0d0', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'#CC0000', fontSize:12 }}>
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }}/> รีเฟรช
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard icon={Truck}    label="รถวันนี้"    value={d.todayCount  ?? '–'} sub={`เดือนนี้ ${d.monthCount ?? '–'} คัน`}/>
        <StatCard icon={Calendar} label="รถเดือนนี้"  value={d.monthCount  ?? '–'} sub={`ปีนี้ ${d.yearCount ?? '–'} คัน`} color="#2563eb"/>
        <StatCard icon={BarChart2} label="รถปีนี้"   value={d.yearCount   ?? '–'} sub={d.year || ''} color="#059669"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* ── ประเภทรถวันนี้ ── */}
        <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', border:'1px solid #f0d0d0' }}>
          <SectionTitle>ประเภทรถวันนี้</SectionTitle>
          <PieChart data={d.vehicleBreakToday || {}}/>
        </div>

        {/* ── เวลาเข้า วันนี้ ── */}
        <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', border:'1px solid #f0d0d0' }}>
          <SectionTitle>เวลาเข้า — วันนี้</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <CheckCircle size={18} color="#16a34a"/>
              <span style={{ fontSize:13, color:'#374151' }}>ในเวลา</span>
              <span style={{ fontSize:22, fontWeight:800, color:'#16a34a', marginLeft:'auto' }}>{d.timingToday?.inTime ?? '–'}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <AlertTriangle size={18} color="#dc2626"/>
              <span style={{ fontSize:13, color:'#374151' }}>นอกเวลา</span>
              <span style={{ fontSize:22, fontWeight:800, color:'#dc2626', marginLeft:'auto' }}>{d.timingToday?.outOfTime ?? '–'}</span>
            </div>
            <div style={{ borderTop:'1px solid #f0d0d0', paddingTop:10, marginTop:4 }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>เดือนนี้: ในเวลา {d.timingMonth?.inTime ?? '–'} / นอกเวลา {d.timingMonth?.outOfTime ?? '–'}</div>
              <div style={{ fontSize:11, color:'#888' }}>ปีนี้: ในเวลา {d.timingYear?.inTime ?? '–'} / นอกเวลา {d.timingYear?.outOfTime ?? '–'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ปริมาณรถ breakdown ── */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', border:'1px solid #f0d0d0', marginBottom:16, display:'flex', flexDirection:'column', gap:16 }}>
        <SectionTitle>ปริมาณรถ / สถิติ</SectionTitle>
        <VBreak data={d.vehicleBreakToday  || {}} label="วันนี้"/>
        <VBreak data={d.vehicleBreakMonth  || {}} label="เดือนนี้"/>
        <VBreak data={d.vehicleBreakYear   || {}} label="ปีนี้"/>
      </div>

      {/* ── รถสะสมที่สถานี ── */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', border:'1px solid #f0d0d0', marginBottom:16 }}>
        <SectionTitle>รถสะสมที่สถานีขึ้นสินค้า ({atStation.length})</SectionTitle>
        {atStation.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px', color:'#bbb', fontSize:13 }}>ไม่มีรถในสถานีขณะนี้</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {atStation.map((t, i) => (
              <div key={t.truckId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i < atStation.length-1 ? '1px solid #f5e0e0' : 'none' }}>
                <div>
                  <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{t.licensePlate}</span>
                  <span style={{ fontSize:12, color:'#888', marginLeft:10 }}>{t.vehicleType} · {t.transport || '-'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:'#888' }}>เข้า {t.checkinTime || '-'}</span>
                  <span style={{ fontSize:11, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:6, padding:'2px 8px' }}>กำลังดำเนินการ</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ค้นหาประวัติ ── */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', border:'1px solid #f0d0d0' }}>
        <SectionTitle>ค้นหาประวัติรถ</SectionTitle>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>วันที่เริ่ม</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize:13, border:'1px solid #f0d0d0', borderRadius:8, padding:'8px 12px', outline:'none' }}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>วันที่สิ้นสุด</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize:13, border:'1px solid #f0d0d0', borderRadius:8, padding:'8px 12px', outline:'none' }}/>
          </div>
          <button onClick={() => setSearched(true)} style={{ alignSelf:'flex-end', background:'#CC0000', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            ค้นหา
          </button>
        </div>
        {searched && (
          history.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px', color:'#bbb', fontSize:13 }}>ไม่พบข้อมูลในช่วงวันที่เลือก</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#fff0f0' }}>
                  {['วันที่','ทะเบียน','ประเภท','ขนส่ง','เวลาเข้า','เวลาออก','สถานะ'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'1px solid #f0d0d0', fontWeight:700, color:'#374151' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((t, i) => (
                    <tr key={t.truckId} style={{ borderBottom: i < history.length-1 ? '1px solid #f5e0e0' : 'none' }}>
                      <td style={{ padding:'8px 12px' }}>{t.date || '-'}</td>
                      <td style={{ padding:'8px 12px', fontWeight:700 }}>{t.licensePlate}</td>
                      <td style={{ padding:'8px 12px', color:'#6b7280' }}>{t.vehicleType}</td>
                      <td style={{ padding:'8px 12px', color:'#6b7280' }}>{t.transport || '-'}</td>
                      <td style={{ padding:'8px 12px' }}>{t.checkinTime || '-'}</td>
                      <td style={{ padding:'8px 12px' }}>{t.checkoutTime || '-'}</td>
                      <td style={{ padding:'8px 12px' }}>
                        <span style={{ fontSize:11, background: t.status==='ดำเนินการเสร็จสิ้น'?'#f0fdf4':'#fff0f0', color: t.status==='ดำเนินการเสร็จสิ้น'?'#16a34a':'#CC0000', border:`1px solid ${t.status==='ดำเนินการเสร็จสิ้น'?'#bbf7d0':'#f0d0d0'}`, borderRadius:6, padding:'2px 8px' }}>
                          {t.status || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
