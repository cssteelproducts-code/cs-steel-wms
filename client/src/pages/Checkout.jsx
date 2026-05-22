import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksApi } from '../api';
import { ArrowLeft, Search, Clock, CheckCircle, Scale } from 'lucide-react';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function Checkout() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const [search, setSearch]   = useState('');
  const [searched, setSearched] = useState('');
  const [checkoutTime, setCheckoutTime] = useState(nowTime());
  const [weightOut, setWeightOut]       = useState('');
  const [msg, setMsg] = useState({ text:'', ok:false });

  const { data } = useQuery({ queryKey:['trucks'], queryFn: trucksApi.getAll });
  const allTrucks = data?.trucks || [];

  const found = searched
    ? allTrucks.find(t => t.licensePlate?.toLowerCase() === searched.toLowerCase() || t.licensePlate?.toLowerCase().includes(searched.toLowerCase()))
    : null;

  const checkout = useMutation({
    mutationFn: () => trucksApi.checkout({ truckId: found.truckId, checkoutTime, weightOut: parseFloat(weightOut) || 0 }),
    onSuccess: (res) => {
      if (res.success) {
        setMsg({ text: `บันทึกสำเร็จ — ${found.licensePlate} ออก ${checkoutTime}`, ok: true });
        qc.invalidateQueries(['trucks']);
        setSearched(''); setSearch(''); setWeightOut(''); setCheckoutTime(nowTime());
      } else {
        setMsg({ text: res.message || 'เกิดข้อผิดพลาด', ok: false });
      }
    },
    onError: () => setMsg({ text: 'ไม่สามารถเชื่อมต่อ Server ได้', ok: false }),
  });

  function doSearch() { setSearched(search); setMsg({ text:'', ok:false }); setWeightOut(''); setCheckoutTime(nowTime()); }

  const weightIn  = found?.weightIn  || 0;
  const netWeight = weightIn && weightOut ? Math.abs(parseFloat(weightOut) - parseFloat(weightIn)).toFixed(2) : '-';

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>⚖️ บันทึกออก</h2>
          <p style={{ fontSize:11, color:'#b09898' }}>ชั่งน้ำหนักขาออก</p>
        </div>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:20, maxWidth:720 }}>

        {/* Search */}
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:4 }}>
            ทะเบียนรถ <span style={{ fontSize:11, color:'#b09898', fontWeight:400 }}>ကားဆိုင်ရာနံပါတ်</span>
          </p>
          <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
            <input
              placeholder="ค้นหาทะเบียนรถ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              style={{ flex:1, border:'none', borderRadius:0, fontSize:14, padding:'11px 16px', outline:'none' }}
            />
            <button
              type="button"
              onClick={doSearch}
              style={{ background:'#CC0000', border:'none', padding:'0 18px', cursor:'pointer', display:'flex', alignItems:'center' }}
            >
              <Search size={18} color="#fff"/>
            </button>
          </div>
        </div>

        {searched && !found && (
          <div style={{ textAlign:'center', padding:'32px', color:'#bbb', fontSize:14 }}>
            ไม่พบทะเบียนรถ "{searched}"
          </div>
        )}

        {found && (
          <>
            {/* Truck info */}
            <div style={{ border:'1px solid #f0d0d0', borderRadius:12, padding:'16px 18px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a', marginBottom:4 }}>{found.licensePlate}</div>
                  <div style={{ fontSize:12, color:'#888' }}>
                    {[found.transport, found.vehicleType, found.warehouse].filter(Boolean).join(' · ')}
                  </div>
                  {found.arname && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{found.arname}</div>}
                  {found.checkinTime && (
                    <div style={{ fontSize:12, color:'#888', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                      <Clock size={12}/> เข้า {found.checkinTime}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:12, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:20, padding:'4px 12px', whiteSpace:'nowrap', flexShrink:0 }}>
                  {found.status || 'กำลังดำเนินการ'}
                </span>
              </div>
            </div>

            {/* Checkout form */}
            <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden', background:'#fff' }}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid #f0d0d0', display:'flex', alignItems:'center', gap:8 }}>
                <Scale size={15} color="#CC0000"/>
                <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>ข้อมูลขาออก</span>
              </div>

              <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>

                {/* Exit time */}
                <div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
                    เวลาออก <span style={{ fontSize:11, color:'#b09898' }}>ထွက်ချိန်</span>
                  </div>
                  <input
                    type="time"
                    value={checkoutTime}
                    onChange={e => setCheckoutTime(e.target.value)}
                    style={{ fontSize:15, fontWeight:600, color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:8, padding:'10px 14px', width:'100%', outline:'none', boxSizing:'border-box' }}
                  />
                  <p style={{ fontSize:11, color:'#CC0000', marginTop:4 }}>✏️ แก้ไขเวลาได้ก่อนบันทึก</p>
                </div>

                {/* Weight section */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>น้ำหนักเข้า (กก.)</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a', padding:'10px 14px', background:'#fafafa', borderRadius:8, border:'1px solid #f0d0d0' }}>
                      {weightIn ? weightIn.toLocaleString() : '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
                      น้ำหนักออก (กก.) <span style={{ fontSize:11, color:'#b09898' }}>ထွက်အချိန်အလေးချိန်</span>
                    </div>
                    <input
                      type="number"
                      placeholder="0"
                      value={weightOut}
                      onChange={e => setWeightOut(e.target.value)}
                      style={{ fontSize:15, fontWeight:600, border:'1px solid #f0d0d0', borderRadius:8, padding:'10px 14px', width:'100%', outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                </div>

                {/* Net weight */}
                {weightOut && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'#374151' }}>น้ำหนักสุทธิ</span>
                    <span style={{ fontSize:20, fontWeight:800, color:'#16a34a' }}>{netWeight} กก.</span>
                  </div>
                )}

                {/* Message */}
                {msg.text && (
                  <div style={{
                    background: msg.ok ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 10, padding:'12px 16px',
                    fontSize: 14, color: msg.ok ? '#16a34a' : '#dc2626',
                    display:'flex', alignItems:'center', gap:8,
                  }}>
                    {msg.ok && <CheckCircle size={16}/>} {msg.text}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending}
                  style={{
                    width:'100%', padding:'15px',
                    background: checkout.isPending ? '#999' : '#CC0000',
                    color:'#fff', border:'none', borderRadius:10,
                    fontSize:16, fontWeight:700, cursor: checkout.isPending ? 'default' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    boxShadow:'0 4px 14px rgba(204,0,0,.3)',
                  }}
                >
                  <CheckCircle size={18}/>
                  {checkout.isPending ? 'กำลังบันทึก...' : 'บันทึกออก'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
