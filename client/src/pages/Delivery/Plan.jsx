import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, fleetApi, ordersApi } from '../../api';

const STATUS_COLOR = { 'ร่าง':'#7f8c8d','ยืนยัน':'#2980b9','กำลังจัดส่ง':'#f39c12','จัดส่งเสร็จ':'#27ae60','ยกเลิก':'#922b21' };

export default function Plan() {
  const qc = useQueryClient();
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: plansData } = useQuery({ queryKey: ['plans', planDate], queryFn: () => plansApi.getAll({ planDate }) });
  const { data: fleetData } = useQuery({ queryKey: ['fleet-avail'], queryFn: fleetApi.getAvailable });
  const { data: ordersData } = useQuery({ queryKey: ['unassigned'], queryFn: ordersApi.getUnassigned });

  const [showCreate, setShowCreate]   = useState(false);
  const [selectedFleet, setSelectedFleet] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [msg, setMsg] = useState('');
  const [detailPlan, setDetailPlan]   = useState(null);

  const create = useMutation({
    mutationFn: (d) => plansApi.add(d),
    onSuccess: (res) => {
      if (res.success) { setShowCreate(false); setSelectedFleet(''); setSelectedOrders([]); qc.invalidateQueries(['plans']); qc.invalidateQueries(['unassigned']); }
      else setMsg(res.message);
    },
  });

  const confirm  = useMutation({ mutationFn: plansApi.confirm,       onSuccess: () => { qc.invalidateQueries(['plans']); qc.invalidateQueries(['unassigned']); } });
  const start    = useMutation({ mutationFn: plansApi.startDelivery, onSuccess: () => qc.invalidateQueries(['plans']) });
  const complete = useMutation({ mutationFn: plansApi.complete,      onSuccess: () => qc.invalidateQueries(['plans']) });
  const cancel   = useMutation({ mutationFn: plansApi.cancel,        onSuccess: () => { qc.invalidateQueries(['plans']); qc.invalidateQueries(['unassigned']); } });
  const del      = useMutation({ mutationFn: plansApi.delete,        onSuccess: () => qc.invalidateQueries(['plans']) });

  const vrp = useMutation({
    mutationFn: plansApi.vrp,
    onSuccess: (res) => {
      if (res.success && res.routes?.length) {
        setMsg(`VRP คำนวณ ${res.routes.length} เส้นทาง`);
      }
    },
  });

  const vehicles = fleetData?.vehicles || [];
  const unassigned = ordersData?.orders || [];
  const plans = plansData?.plans || [];

  function toggleOrder(o) {
    setSelectedOrders(prev => prev.find(x => x.orderId === o.orderId) ? prev.filter(x => x.orderId !== o.orderId) : [...prev, o]);
  }

  function handleCreate() {
    const fleet = vehicles.find(v => v.fleetId === selectedFleet);
    if (!fleet) { setMsg('เลือกรถก่อน'); return; }
    const totalWeightKg = selectedOrders.reduce((s, o) => s + (o.weightKg || 0), 0);
    create.mutate({
      planDate, fleetId: fleet.fleetId, licensePlate: fleet.licensePlate,
      vehicleType: fleet.vehicleType, totalWeightKg,
      orders: selectedOrders.map(o => ({ orderId: o.orderId, arname: o.arname, deliveryZone: o.deliveryZone, weightKg: o.weightKg })),
    });
  }

  function handleVRP() {
    if (!unassigned.length || !vehicles.length) { setMsg('ไม่มีออเดอร์หรือรถ'); return; }
    vrp.mutate({ orders: unassigned, vehicles, depotLat: 13.7563, depotLng: 100.5018 });
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, alignItems:'center' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} style={{ width:160 }} />
          <span style={{ fontSize:13, color:'var(--muted)' }}>รอมอบหมาย: {unassigned.length}</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleVRP} disabled={vrp.isPending} style={{ background:'#2980b9', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', fontSize:13, cursor:'pointer' }}>
            🤖 VRP Auto
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ สร้าง Plan</button>
        </div>
      </div>
      {msg && <p style={{ color:'var(--muted)', fontSize:13, marginBottom:8 }}>{msg}</p>}

      {showCreate && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16 }}>
          <h4 style={{ marginBottom:12 }}>สร้าง Delivery Plan</h4>
          <select value={selectedFleet} onChange={e => setSelectedFleet(e.target.value)} style={{ marginBottom:10 }}>
            <option value="">เลือกรถ</option>
            {vehicles.map(v => <option key={v.fleetId} value={v.fleetId}>{v.licensePlate} ({v.vehicleType}) — {v.weightCapacityKg?.toLocaleString()} กก.</option>)}
          </select>
          <p style={{ fontSize:13, color:'var(--muted)', marginBottom:6 }}>เลือกออเดอร์ ({selectedOrders.length} รายการ — {selectedOrders.reduce((s,o)=>s+(o.weightKg||0),0).toLocaleString()} กก.)</p>
          <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
            {unassigned.map(o => (
              <label key={o.orderId} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', padding:'4px 8px', background: selectedOrders.find(x=>x.orderId===o.orderId)?'rgba(192,57,43,.2)':'transparent', borderRadius:4 }}>
                <input type="checkbox" checked={!!selectedOrders.find(x=>x.orderId===o.orderId)} onChange={() => toggleOrder(o)} style={{ width:'auto' }} />
                <span>{o.arname} — {o.deliveryZone} — {o.weightKg?.toLocaleString()} กก. {o.requiresHiab?'[Hiab]':''}</span>
              </label>
            ))}
            {unassigned.length === 0 && <p style={{ color:'var(--muted)', fontSize:13 }}>ไม่มีออเดอร์รอมอบหมาย</p>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={handleCreate} disabled={create.isPending}>สร้าง Plan</button>
            <button onClick={() => setShowCreate(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {plans.map(p => (
          <div key={p.planId} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <span style={{ fontWeight:600 }}>{p.licensePlate}</span>
                <span style={{ fontSize:13, color:'var(--muted)', marginLeft:8 }}>{p.vehicleType}</span>
                <span style={{ marginLeft:8, background:STATUS_COLOR[p.status]||'#7f8c8d', color:'#fff', borderRadius:4, padding:'2px 7px', fontSize:12 }}>{p.status}</span>
              </div>
              <span style={{ fontSize:12, color:'var(--muted)' }}>{p.planId}</span>
            </div>
            <div style={{ fontSize:13, marginTop:4, color:'var(--muted)' }}>
              {p.totalOrders} ออเดอร์ — {p.totalWeightKg?.toLocaleString()} กก.
            </div>
            {p.orders?.length > 0 && (
              <div style={{ fontSize:12, marginTop:6, color:'var(--muted)' }}>
                {p.orders.slice(0,3).map(o => o.arname || o.orderId).join(', ')}{p.orders.length>3?` +${p.orders.length-3} อื่นๆ`:''}
              </div>
            )}
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              {p.status==='ร่าง'        && <button onClick={() => { if(confirm('ยืนยัน?')) confirm.mutate(p.planId); }} style={{ fontSize:12, padding:'4px 10px', background:'#2980b9', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>ยืนยัน</button>}
              {p.status==='ยืนยัน'      && <button onClick={() => start.mutate(p.planId)} style={{ fontSize:12, padding:'4px 10px', background:'#f39c12', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>เริ่มส่ง</button>}
              {p.status==='กำลังจัดส่ง' && <button onClick={() => { if(confirm('ปิด plan?')) complete.mutate(p.planId); }} style={{ fontSize:12, padding:'4px 10px', background:'#27ae60', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>จัดส่งเสร็จ</button>}
              {(p.status==='ร่าง'||p.status==='ยืนยัน') && <button onClick={() => { if(confirm('ยกเลิก?')) cancel.mutate(p.planId); }} style={{ fontSize:12, padding:'4px 10px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, cursor:'pointer' }}>ยกเลิก</button>}
              {(p.status==='ร่าง'||p.status==='ยกเลิก') && <button onClick={() => { if(confirm('ลบ?')) del.mutate(p.planId); }} style={{ fontSize:12, padding:'4px 10px', background:'#922b21', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>ลบ</button>}
              <button onClick={() => setDetailPlan(detailPlan===p.planId?null:p.planId)} style={{ fontSize:12, padding:'4px 10px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, cursor:'pointer' }}>รายละเอียด</button>
            </div>
            {detailPlan===p.planId && p.orders?.length>0 && (
              <div style={{ marginTop:10, background:'var(--bg)', borderRadius:6, padding:10 }}>
                {p.orders.map((o,i) => (
                  <div key={i} style={{ fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--border)', color:'var(--muted)' }}>
                    {i+1}. {o.arname} — {o.deliveryZone} — {o.weightKg?.toLocaleString()} กก.
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {plans.length===0 && <p style={{ color:'var(--muted)', fontSize:13 }}>ไม่มี Plan สำหรับวันที่เลือก</p>}
      </div>
    </div>
  );
}
