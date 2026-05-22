import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api';

const EMPTY = { arcode:'', arname:'', deliveryZone:'', productType:'', weightKg:'', quantityPieces:'', deadlineDate:'', priority:2, remark:'', requiresHiab:false, isLongDistance:false };
const STATUS_COLOR = { 'รอมอบหมาย':'#f39c12','มอบหมายแล้ว':'#2980b9','จัดส่งแล้ว':'#27ae60','ยกเลิก':'#7f8c8d' };

export default function Orders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ status:'', zone:'' });
  const { data } = useQuery({
    queryKey: ['orders', filter],
    queryFn:  () => ordersApi.getAll(filter),
  });
  const { data: suggData } = useQuery({ queryKey: ['suggestions'], queryFn: ordersApi.getSuggestions });

  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg]         = useState('');
  const fileRef = useRef();

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value })); }

  const upsert = useMutation({
    mutationFn: (d) => editing ? ordersApi.update(d) : ordersApi.add(d),
    onSuccess: (res) => {
      if (res.success) { setShowForm(false); setEditing(null); setForm(EMPTY); qc.invalidateQueries(['orders']); }
      else setMsg(res.message);
    },
  });

  const cancel = useMutation({ mutationFn: ordersApi.cancel, onSuccess: () => qc.invalidateQueries(['orders']) });
  const del    = useMutation({ mutationFn: ordersApi.delete, onSuccess: () => qc.invalidateQueries(['orders']) });

  const bulk = useMutation({
    mutationFn: ordersApi.bulk,
    onSuccess: (res) => { setMsg(res.message); qc.invalidateQueries(['orders']); },
  });

  function startEdit(o) { setForm({ ...o }); setEditing(o.orderId); setShowForm(true); }
  function handleSave() { upsert.mutate({ ...form, orderId: editing }); }

  async function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const orders = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
      return Object.fromEntries(headers.map((h,i) => [h, vals[i] || '']));
    });
    bulk.mutate(orders);
    fileRef.current.value = '';
  }

  const orders = data?.orders || [];
  const summary = data?.summary || {};
  const customers = suggData?.customers || [];
  const zones = suggData?.zones || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <h3>ออเดอร์ ({summary.total || 0})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <input type="file" accept=".csv" ref={fileRef} style={{ display:'none' }} onChange={handleCSV} />
          <button onClick={() => fileRef.current.click()} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'6px 12px', fontSize:13 }}>นำเข้า CSV</button>
          <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}>+ เพิ่มออเดอร์</button>
        </div>
      </div>
      <div style={{ display:'flex', gap:24, marginBottom:12, fontSize:13 }}>
        {[['รอมอบหมาย',summary.pendingCount],['มอบหมายแล้ว',summary.assignedCount],['จัดส่งแล้ว',summary.deliveredCount]].map(([l,c]) => (
          <span key={l}><span style={{ color:STATUS_COLOR[l] }}>●</span> {l}: <strong>{c||0}</strong></span>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <select value={filter.status} onChange={e => setFilter(f=>({...f,status:e.target.value}))} style={{ width:160 }}>
          <option value="">ทุกสถานะ</option>
          {['รอมอบหมาย','มอบหมายแล้ว','จัดส่งแล้ว','ยกเลิก'].map(s=><option key={s}>{s}</option>)}
        </select>
        <input placeholder="ค้นหาโซน..." value={filter.zone} onChange={e => setFilter(f=>({...f,zone:e.target.value}))} style={{ width:160 }} />
      </div>
      {msg && <p style={{ color:'var(--muted)', fontSize:13, marginBottom:8 }}>{msg}</p>}

      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16 }}>
          <h4 style={{ marginBottom:12 }}>{editing ? 'แก้ไขออเดอร์' : 'เพิ่มออเดอร์'}</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            <select value={form.arcode} onChange={e => {
              const c = customers.find(c => c.Arcode === e.target.value);
              setForm(f => ({ ...f, arcode: e.target.value, arname: c?.Arname || f.arname }));
            }}>
              <option value="">เลือกลูกค้า</option>
              {customers.map(c => <option key={c.Arcode} value={c.Arcode}>{c.Arcode} — {c.Arname}</option>)}
            </select>
            <input placeholder="ชื่อลูกค้า" value={form.arname} onChange={set('arname')} />
            <select value={form.deliveryZone} onChange={set('deliveryZone')}>
              <option value="">โซนจัดส่ง</option>
              {zones.map(z => <option key={z}>{z}</option>)}
              <option value="__custom">อื่นๆ</option>
            </select>
            {form.deliveryZone === '__custom' && <input placeholder="โซนจัดส่ง (พิมพ์)" onChange={e=>setForm(f=>({...f,deliveryZone:e.target.value}))} />}
            <input placeholder="ประเภทสินค้า" value={form.productType} onChange={set('productType')} />
            <input placeholder="น้ำหนัก (กก.)" type="number" value={form.weightKg} onChange={set('weightKg')} />
            <input placeholder="จำนวน (ชิ้น)" type="number" value={form.quantityPieces} onChange={set('quantityPieces')} />
            <input type="date" value={form.deadlineDate} onChange={set('deadlineDate')} title="วันสุดท้ายที่ต้องส่ง" />
            <select value={form.priority} onChange={set('priority')}>
              <option value={1}>1 - ด่วนมาก</option>
              <option value={2}>2 - ปกติ</option>
              <option value={3}>3 - ไม่ด่วน</option>
            </select>
            <input placeholder="หมายเหตุ" value={form.remark} onChange={set('remark')} />
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
              <input type="checkbox" checked={form.requiresHiab} onChange={set('requiresHiab')} style={{ width:'auto' }} /> ต้องการ Hiab
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
              <input type="checkbox" checked={form.isLongDistance} onChange={set('isLongDistance')} style={{ width:'auto' }} /> ไกล (&gt;200 กม.)
            </label>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button className="btn-primary" onClick={handleSave} disabled={upsert.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--surface)' }}>
              {['ออเดอร์','ลูกค้า','โซน','น้ำหนัก','Deadline','สถานะ',''].map(h=>(
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.orderId} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 10px', fontSize:11, color:'var(--muted)' }}>{o.orderId}</td>
                <td style={{ padding:'8px 10px' }}>{o.arname || o.arcode}</td>
                <td style={{ padding:'8px 10px' }}>{o.deliveryZone}</td>
                <td style={{ padding:'8px 10px' }}>{o.weightKg?.toLocaleString()} กก.</td>
                <td style={{ padding:'8px 10px' }}>{o.deadlineDate || '-'}</td>
                <td style={{ padding:'8px 10px' }}><span style={{ background:STATUS_COLOR[o.status]||'#7f8c8d', color:'#fff', borderRadius:4, padding:'2px 7px', fontSize:11 }}>{o.status}</span></td>
                <td style={{ padding:'8px 4px', whiteSpace:'nowrap' }}>
                  <button onClick={() => startEdit(o)} style={{ fontSize:11, padding:'2px 7px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, marginRight:3 }}>แก้ไข</button>
                  {o.status !== 'ยกเลิก' && <button onClick={() => { if (confirm('ยกเลิก?')) cancel.mutate(o.orderId); }} style={{ fontSize:11, padding:'2px 7px', background:'#7f8c8d', border:'none', color:'#fff', borderRadius:4, marginRight:3 }}>ยกเลิก</button>}
                  <button onClick={() => { if (confirm('ลบ?')) del.mutate(o.orderId); }} style={{ fontSize:11, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
