import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from '../api';

export default function Warehouse() {
  const [tab, setTab] = useState('stock');
  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {[['stock','📊 สต็อก'],['locations','📍 ตำแหน่ง'],['skus','📦 SKU'],['audit','📝 Audit']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background:tab===k?'var(--accent)':'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'stock'     && <StockCount />}
      {tab === 'locations' && <Locations />}
      {tab === 'skus'      && <SKUs />}
      {tab === 'audit'     && <Audit />}
    </div>
  );
}

function StockCount() {
  const { data } = useQuery({ queryKey: ['stock-count'], queryFn: warehouseApi.getStockCount });
  const [search, setSearch] = useState('');
  const stock = (data?.stock || []).filter(s =>
    !search || s.skuCode.toLowerCase().includes(search.toLowerCase()) ||
    s.skuName.toLowerCase().includes(search.toLowerCase()) || s.zone.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <h3>สต็อกสินค้า ({stock.length})</h3>
        <input placeholder="ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:200 }} />
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--surface)' }}>
            {['Zone','Rack','Shelf','SKU','ชื่อสินค้า','จำนวน','หน่วย','อัปเดต'].map(h=>(
              <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {stock.map(s => (
              <tr key={s.recordId} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'7px 10px' }}>{s.zone}</td>
                <td style={{ padding:'7px 10px' }}>{s.rack}</td>
                <td style={{ padding:'7px 10px' }}>{s.shelf}</td>
                <td style={{ padding:'7px 10px', fontFamily:'monospace' }}>{s.skuCode}</td>
                <td style={{ padding:'7px 10px' }}>{s.skuName}</td>
                <td style={{ padding:'7px 10px', fontWeight:600 }}>{s.quantity?.toLocaleString()}</td>
                <td style={{ padding:'7px 10px' }}>{s.unit}</td>
                <td style={{ padding:'7px 10px', color:'var(--muted)', fontSize:12 }}>{s.updatedAt?.slice(0,10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Locations() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['locations'], queryFn: warehouseApi.getLocations });
  const [form, setForm]       = useState({ zone:'', rack:'', shelf:'', description:'', maxWeightKg:'', status:'ว่าง' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: (d) => editing ? warehouseApi.updateLocation(d) : warehouseApi.addLocation(d),
    onSuccess: (res) => { if (res.success) { setShowForm(false); setEditing(null); qc.invalidateQueries(['locations']); } },
  });
  const del = useMutation({ mutationFn: warehouseApi.deleteLocation, onSuccess: () => qc.invalidateQueries(['locations']) });

  function set(k) { return e => setForm(f=>({...f,[k]:e.target.value})); }
  const locations = data?.locations || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <h3>ตำแหน่ง ({locations.length})</h3>
        <button className="btn-primary" onClick={() => { setForm({ zone:'', rack:'', shelf:'', description:'', maxWeightKg:'', status:'ว่าง' }); setEditing(null); setShowForm(true); }}>+ เพิ่ม</button>
      </div>
      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
            <input placeholder="Zone" value={form.zone} onChange={set('zone')} />
            <input placeholder="Rack" value={form.rack} onChange={set('rack')} />
            <input placeholder="Shelf" value={form.shelf} onChange={set('shelf')} />
            <input placeholder="คำอธิบาย" value={form.description} onChange={set('description')} />
            <input type="number" placeholder="น้ำหนักสูงสุด กก." value={form.maxWeightKg} onChange={set('maxWeightKg')} />
            <select value={form.status} onChange={set('status')}>
              {['ว่าง','ใช้งาน','เต็ม','ปิด'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={() => upsert.mutate({ ...form, locationId: editing })} disabled={upsert.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr style={{ background:'var(--surface)' }}>
          {['Zone','Rack','Shelf','คำอธิบาย','น้ำหนักสูงสุด','สถานะ',''].map(h=>(
            <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {locations.map(l => (
            <tr key={l.locationId} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'7px 10px' }}>{l.zone}</td>
              <td style={{ padding:'7px 10px' }}>{l.rack}</td>
              <td style={{ padding:'7px 10px' }}>{l.shelf}</td>
              <td style={{ padding:'7px 10px', color:'var(--muted)' }}>{l.description}</td>
              <td style={{ padding:'7px 10px' }}>{l.maxWeightKg?.toLocaleString()} กก.</td>
              <td style={{ padding:'7px 10px' }}>{l.status}</td>
              <td style={{ padding:'7px 4px', display:'flex', gap:4 }}>
                <button onClick={() => { setForm({...l}); setEditing(l.locationId); setShowForm(true); }} style={{ fontSize:11, padding:'2px 7px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>แก้ไข</button>
                <button onClick={() => { if(confirm('ลบ?')) del.mutate(l.locationId); }} style={{ fontSize:11, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SKUs() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['skus'], queryFn: warehouseApi.getSkus });
  const [form, setForm] = useState({ skuCode:'', skuName:'', category:'', unit:'', remark:'' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: (d) => editing ? warehouseApi.updateSku(d) : warehouseApi.addSku(d),
    onSuccess: (res) => { if (res.success) { setShowForm(false); setEditing(null); qc.invalidateQueries(['skus']); } },
  });
  const del = useMutation({ mutationFn: warehouseApi.deleteSku, onSuccess: () => qc.invalidateQueries(['skus']) });

  function set(k) { return e => setForm(f=>({...f,[k]:e.target.value})); }
  const skus = data?.skus || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <h3>ประเภท SKU ({skus.length})</h3>
        <button className="btn-primary" onClick={() => { setForm({ skuCode:'', skuName:'', category:'', unit:'', remark:'' }); setEditing(null); setShowForm(true); }}>+ เพิ่ม</button>
      </div>
      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
            <input placeholder="รหัส SKU" value={form.skuCode} onChange={set('skuCode')} disabled={!!editing} />
            <input placeholder="ชื่อ SKU" value={form.skuName} onChange={set('skuName')} />
            <input placeholder="หมวดหมู่" value={form.category} onChange={set('category')} />
            <input placeholder="หน่วย (ชิ้น/กก./ม้วน...)" value={form.unit} onChange={set('unit')} />
            <input placeholder="หมายเหตุ" value={form.remark} onChange={set('remark')} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={() => upsert.mutate({ ...form, skuCode: editing || form.skuCode })} disabled={upsert.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr style={{ background:'var(--surface)' }}>
          {['รหัส','ชื่อ','หมวดหมู่','หน่วย',''].map(h=>(
            <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {skus.map(s => (
            <tr key={s.skuCode} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'7px 10px', fontFamily:'monospace' }}>{s.skuCode}</td>
              <td style={{ padding:'7px 10px' }}>{s.skuName}</td>
              <td style={{ padding:'7px 10px' }}>{s.category}</td>
              <td style={{ padding:'7px 10px' }}>{s.unit}</td>
              <td style={{ padding:'7px 4px', display:'flex', gap:4 }}>
                <button onClick={() => { setForm({...s}); setEditing(s.skuCode); setShowForm(true); }} style={{ fontSize:11, padding:'2px 7px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>แก้ไข</button>
                <button onClick={() => { if(confirm('ลบ?')) del.mutate(s.skuCode); }} style={{ fontSize:11, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Audit() {
  const qc = useQueryClient();
  const { data: locData } = useQuery({ queryKey: ['locations'], queryFn: warehouseApi.getLocations });
  const { data: skuData } = useQuery({ queryKey: ['skus'], queryFn: warehouseApi.getSkus });
  const [filter, setFilter] = useState({ locationId:'', skuCode:'', date:'' });
  const { data } = useQuery({ queryKey: ['audit', filter], queryFn: () => warehouseApi.getAudit(filter) });
  const [form, setForm] = useState({ locationId:'', skuCode:'', beforeQty:'', afterQty:'', reason:'' });
  const [showForm, setShowForm] = useState(false);

  const addAudit = useMutation({
    mutationFn: warehouseApi.addAudit,
    onSuccess: (res) => { if (res.success) { setShowForm(false); qc.invalidateQueries(['audit']); qc.invalidateQueries(['stock-count']); } },
  });

  function set(k) { return e => setForm(f=>({...f,[k]:e.target.value})); }
  const logs = data?.logs || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <h3>Audit Log ({logs.length})</h3>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ บันทึก Audit</button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <select value={filter.locationId} onChange={e=>setFilter(f=>({...f,locationId:e.target.value}))} style={{ width:160 }}>
          <option value="">ทุกตำแหน่ง</option>
          {(locData?.locations||[]).map(l=><option key={l.locationId} value={l.locationId}>{l.zone}-{l.rack}-{l.shelf}</option>)}
        </select>
        <select value={filter.skuCode} onChange={e=>setFilter(f=>({...f,skuCode:e.target.value}))} style={{ width:160 }}>
          <option value="">ทุก SKU</option>
          {(skuData?.skus||[]).map(s=><option key={s.skuCode} value={s.skuCode}>{s.skuCode}</option>)}
        </select>
        <input type="date" value={filter.date} onChange={e=>setFilter(f=>({...f,date:e.target.value}))} style={{ width:140 }} />
      </div>
      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
            <select value={form.locationId} onChange={set('locationId')}>
              <option value="">เลือกตำแหน่ง</option>
              {(locData?.locations||[]).map(l=><option key={l.locationId} value={l.locationId}>{l.zone}-{l.rack}-{l.shelf}</option>)}
            </select>
            <select value={form.skuCode} onChange={set('skuCode')}>
              <option value="">เลือก SKU</option>
              {(skuData?.skus||[]).map(s=><option key={s.skuCode} value={s.skuCode}>{s.skuCode} {s.skuName}</option>)}
            </select>
            <input type="number" placeholder="จำนวนก่อน" value={form.beforeQty} onChange={set('beforeQty')} />
            <input type="number" placeholder="จำนวนหลัง" value={form.afterQty} onChange={set('afterQty')} />
            <input placeholder="เหตุผล" value={form.reason} onChange={set('reason')} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={() => addAudit.mutate(form)} disabled={addAudit.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr style={{ background:'var(--surface)' }}>
          {['วันที่','ตำแหน่ง','SKU','ก่อน','หลัง','เปลี่ยน','เหตุผล','ผู้บันทึก'].map(h=>(
            <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.auditId} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'7px 10px', fontSize:12 }}>{l.auditDate?.slice(0,10)}</td>
              <td style={{ padding:'7px 10px' }}>{l.locationId}</td>
              <td style={{ padding:'7px 10px', fontFamily:'monospace' }}>{l.skuCode}</td>
              <td style={{ padding:'7px 10px' }}>{l.beforeQty}</td>
              <td style={{ padding:'7px 10px' }}>{l.afterQty}</td>
              <td style={{ padding:'7px 10px', color: (l.afterQty-l.beforeQty)>=0?'#2ecc71':'#e74c3c' }}>
                {(l.afterQty-l.beforeQty)>=0?'+':''}{l.afterQty-l.beforeQty}
              </td>
              <td style={{ padding:'7px 10px', color:'var(--muted)' }}>{l.reason}</td>
              <td style={{ padding:'7px 10px', color:'var(--muted)', fontSize:12 }}>{l.auditBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
