import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksApi } from '../api';
import { ArrowLeft, Search, Clock, CheckCircle, RotateCcw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function elapsedMinutes(checkinTime) {
  if (!checkinTime) return null;
  const [h, m] = checkinTime.split(':').map(Number);
  const now = new Date();
  const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
  return diff > 0 ? diff : null;
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:8, padding:'7px 0', borderBottom:'1px solid #f5f5f5' }}>
      <span style={{ fontSize:12, color:'#9ca3af' }}>{label}</span>
      <span style={{ fontSize:13, color:'#1a1a1a', fontWeight:500, ...valueStyle }}>{value || '-'}</span>
    </div>
  );
}

export default function Checkout() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const [search, setSearch]         = useState('');
  const [searched, setSearched]     = useState('');
  const [checkoutTime, setCheckoutTime] = useState(nowTime());
  const [netWeight, setNetWeight]   = useState('');
  const [msg, setMsg]               = useState({ text:'', ok:false });
  const [completedOpen, setCompletedOpen] = useState(true);

  const { data } = useQuery({ queryKey:['trucks'], queryFn: trucksApi.getAll });
  const allTrucks = data?.trucks || [];

  const found = searched
    ? allTrucks.find(t =>
        t.licensePlate?.toLowerCase() === searched.toLowerCase() ||
        t.licensePlate?.toLowerCase().includes(searched.toLowerCase())
      )
    : null;

  const completedToday = allTrucks.filter(t => t.status === 'ดำเนินการเสร็จสิ้น');

  const checkout = useMutation({
    mutationFn: () => trucksApi.checkout({ truckId: found.truckId, checkoutTime, netWeight: parseFloat(netWeight) || 0 }),
    onSuccess: (res) => {
      if (res.success) {
        setMsg({ text:`บันทึกสำเร็จ — ${found.licensePlate} ออก ${checkoutTime}`, ok:true });
        qc.invalidateQueries(['trucks']);
        setSearched(''); setSearch(''); setNetWeight(''); setCheckoutTime(nowTime());
      } else setMsg({ text: res.message || 'เกิดข้อผิดพลาด', ok:false });
    },
    onError: () => setMsg({ text:'ไม่สามารถเชื่อมต่อ Server ได้', ok:false }),
  });

  function doSearch() { setSearched(search); setMsg({ text:'', ok:false }); setNetWeight(''); setCheckoutTime(nowTime()); }
  const elapsed = found ? elapsedMinutes(found.checkinTime) : null;

  return (
    <div style={{ minHeight:'100%', background:'#f9fafb', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px', borderBottom:'1px solid #f0d0d0', background:'#fff' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', lineHeight:1.3, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>⚖️</span> บันทึกออก
          </h2>
          <p style={{ fontSize:11, color:'#9ca3af' }}>ชั่งน้ำหนักขาออก</p>
        </div>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14, maxWidth:900 }}>

        {/* Search */}
        <div>
          <p style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>ค้นหาทะเบียน</p>
          <div style={{ display:'flex', gap:0, borderRadius:8, overflow:'hidden', border:'1px solid #e5e7eb', background:'#fff' }}>
            <input
              placeholder="ทะเบียน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              style={{ flex:1, border:'none', fontSize:14, padding:'10px 14px', outline:'none' }}
            />
            <button type="button" onClick={doSearch} style={{ background:'#CC0000', border:'none', padding:'0 16px', cursor:'pointer', display:'flex', alignItems:'center' }}>
              <Search size={17} color="#fff"/>
            </button>
          </div>
        </div>

        {searched && !found && (
          <div style={{ textAlign:'center', padding:'24px', color:'#bbb', fontSize:13, background:'#fff', borderRadius:10, border:'1px solid #f0d0d0' }}>
            ไม่พบทะเบียน "{searched}"
          </div>
        )}

        {found && (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>

            {/* Truck header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #f0f0f0' }}>
              <span style={{ fontSize:18, fontWeight:800, color:'#1a1a1a' }}>{found.licensePlate}</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {elapsed !== null && (
                  <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 10px' }}>
                    {elapsed} นาที
                  </span>
                )}
              </div>
            </div>

            {/* Truck details */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
              <div style={{ padding:'12px 16px', borderRight:'1px solid #f5f5f5' }}>
                <InfoRow label="Arcode"   value={found.arcode}/>
                <InfoRow label="ลูกค้า"   value={found.arname}/>
                <InfoRow label="ประเภท"   value={found.vehicleType}/>
                <InfoRow label="คลัง"     value={found.warehouse}/>
                <InfoRow label="ขนส่ง"    value={found.transport}/>
                <InfoRow label="เวลาเข้า" value={found.checkinTime} valueStyle={{ color:'#CC0000', fontWeight:700 }}/>
              </div>
              <div style={{ padding:'16px' }}>

                {/* เวลาออก */}
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>เวลาบันทึกออก</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', background:'#fafafa' }}>
                    <Clock size={15} color="#6b7280"/>
                    <input
                      type="time"
                      value={checkoutTime}
                      onChange={e => setCheckoutTime(e.target.value)}
                      style={{ flex:1, border:'none', background:'transparent', fontSize:15, fontWeight:700, color:'#1a1a1a', outline:'none' }}
                    />
                    <button type="button" onClick={() => setCheckoutTime(nowTime())} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex' }}>
                      <RotateCcw size={14}/>
                    </button>
                  </div>
                  <p style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>แก้ไขได้หากต้องการบันทึกย้อนหลัง</p>
                </div>

                {/* น้ำหนักสุทธิ */}
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>น้ำหนักสุทธิ (กก.)</p>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={netWeight}
                    onChange={e => setNetWeight(e.target.value)}
                    style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none', boxSizing:'border-box' }}
                  />
                </div>

                {/* Message */}
                {msg.text && (
                  <div style={{ marginBottom:10, background: msg.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`, borderRadius:8, padding:'10px 12px', fontSize:13, color: msg.ok?'#16a34a':'#dc2626', display:'flex', alignItems:'center', gap:6 }}>
                    {msg.ok && <CheckCircle size={14}/>} {msg.text}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending}
                  style={{ width:'100%', padding:'13px', background: checkout.isPending ? '#ccc' : '#f59e0b', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor: checkout.isPending ? 'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                >
                  ⊳ {checkout.isPending ? 'กำลังบันทึก...' : 'บันทึกชั่งออก'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Completed today */}
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <button
            type="button"
            onClick={() => setCompletedOpen(o => !o)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'12px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}
          >
            <CheckCircle size={15} color="#16a34a"/>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', flex:1 }}>
              รถที่ดำเนินการเสร็จแล้ววันนี้
              <span style={{ fontSize:11, color:'#6b7280', fontWeight:400, marginLeft:8 }}>(แก้ไขน้ำหนัก / ลูกค้า / ทะเบียนได้)</span>
            </span>
            <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'2px 8px' }}>{completedToday.length}</span>
            {completedOpen ? <ChevronUp size={15} color="#888"/> : <ChevronDown size={15} color="#888"/>}
          </button>

          {completedOpen && (
            <div style={{ borderTop:'1px solid #f0f0f0' }}>
              {completedToday.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'#bbb', fontSize:13 }}>ยังไม่มีรถที่เสร็จสิ้น</div>
              ) : completedToday.map((t, i) => (
                <div key={t.truckId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', borderBottom: i < completedToday.length-1 ? '1px solid #f5f5f5':'none' }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{t.licensePlate}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {t.checkoutTime && (
                      <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 10px' }}>
                        เสร็จสิ้น {t.checkoutTime}
                      </span>
                    )}
                    <span style={{ fontSize:11, color:'#6b7280' }}>{t.vehicleType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
