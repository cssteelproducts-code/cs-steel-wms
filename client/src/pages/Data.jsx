import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, customersApi } from '../api';
import { ArrowLeft, Search, Plus, Edit2, Trash2, X, Package, Users } from 'lucide-react';

const ITEM_EMPTY = { itemCode:'', itemName:'', weightKgPerUnit:'', lengthM:'', widthM:'', heightM:'', productType:'', weightPerPiece:'', piecesPerBundle:'', remark:'' };
const CUST_EMPTY = { arcode:'', arname:'', remark:'' };

function Field({ label, sub, children }) {
  return (
    <div>
      <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>
        {label} {sub && <span style={{ fontSize:11, color:'#b09898' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function inputStyle(extra = {}) {
  return { fontSize:14, border:'1px solid #f0d0d0', borderRadius:8, padding:'9px 13px', width:'100%', outline:'none', boxSizing:'border-box', ...extra };
}

/* ─── Modal ─── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:600, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f0d0d0' }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', display:'flex', padding:4 }}><X size={18}/></button>
        </div>
        <div style={{ padding:'20px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Items tab ─── */
function Items() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey:['items'], queryFn: itemsApi.getAll });
  const [form, setForm]       = useState(ITEM_EMPTY);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]   = useState('');

  const upsert = useMutation({
    mutationFn: (d) => editing ? itemsApi.update(d) : itemsApi.add(d),
    onSuccess: (res) => { if (res.success) { setShowModal(false); setEditing(null); setForm(ITEM_EMPTY); qc.invalidateQueries(['items']); } },
  });
  const del = useMutation({ mutationFn: itemsApi.delete, onSuccess: () => qc.invalidateQueries(['items']) });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function openAdd()  { setForm(ITEM_EMPTY); setEditing(null); setShowModal(true); }
  function openEdit(i){ setForm({...i}); setEditing(i.itemCode); setShowModal(true); }

  const items = (data?.items || []).filter(i =>
    !search || i.itemCode?.toLowerCase().includes(search.toLowerCase()) || i.itemName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Top bar */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <div style={{ flex:1, display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
          <input
            placeholder="ค้นหารหัส / ชื่อสินค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, border:'none', fontSize:14, padding:'10px 14px', outline:'none' }}
          />
          <div style={{ display:'flex', alignItems:'center', paddingRight:12, color:'#bbb' }}><Search size={15}/></div>
        </div>
        <button
          onClick={openAdd}
          style={{ display:'flex', alignItems:'center', gap:6, background:'#CC0000', color:'#fff', border:'none', borderRadius:10, padding:'0 18px', cursor:'pointer', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}
        >
          <Plus size={15}/> เพิ่มสินค้า
        </button>
      </div>

      {/* Table */}
      <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#fff0f0' }}>
                {['รหัสสินค้า','ชื่อสินค้า','ประเภท','น้ำหนัก/หน่วย (กก.)','ความยาว (ม.)','เส้น/มัด',''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #f0d0d0', fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#bbb' }}>
                  {search ? `ไม่พบ "${search}"` : 'ยังไม่มีข้อมูลสินค้า'}
                </td></tr>
              ) : items.map((i, idx) => (
                <tr key={i.itemCode} style={{ borderBottom: idx < items.length-1 ? '1px solid #f5e0e0' : 'none', background:'#fff' }}>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#CC0000', fontWeight:600 }}>{i.itemCode}</td>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:'#1a1a1a' }}>{i.itemName}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{i.productType || '-'}</td>
                  <td style={{ padding:'10px 14px', color:'#374151' }}>{i.weightKgPerUnit || '-'}</td>
                  <td style={{ padding:'10px 14px', color:'#374151' }}>{i.lengthM || '-'}</td>
                  <td style={{ padding:'10px 14px', color:'#374151' }}>{i.piecesPerBundle || '-'}</td>
                  <td style={{ padding:'10px 8px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => openEdit(i)} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, padding:'4px 8px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:6, cursor:'pointer' }}>
                        <Edit2 size={11}/> แก้ไข
                      </button>
                      <button onClick={() => { if(window.confirm(`ลบ ${i.itemCode}?`)) del.mutate(i.itemCode); }} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, padding:'4px 8px', background:'#fef2f2', border:'none', color:'#dc2626', borderRadius:6, cursor:'pointer' }}>
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? `แก้ไขสินค้า: ${editing}` : 'เพิ่มสินค้าใหม่'} onClose={() => setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="รหัสสินค้า *">
                <input placeholder="เช่น ST001" value={form.itemCode} onChange={e => set('itemCode', e.target.value)} disabled={!!editing} style={inputStyle()} />
              </Field>
              <Field label="ชื่อสินค้า *">
                <input placeholder="ชื่อสินค้า" value={form.itemName} onChange={e => set('itemName', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="ประเภทสินค้า">
                <input placeholder="เช่น เหล็กเส้น" value={form.productType} onChange={e => set('productType', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="น้ำหนัก/หน่วย (กก.)">
                <input type="number" step="0.001" placeholder="0.000" value={form.weightKgPerUnit} onChange={e => set('weightKgPerUnit', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="น้ำหนัก/เส้น (กก.)">
                <input type="number" step="0.001" placeholder="0.000" value={form.weightPerPiece} onChange={e => set('weightPerPiece', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="เส้น/มัด">
                <input type="number" placeholder="0" value={form.piecesPerBundle} onChange={e => set('piecesPerBundle', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="ความยาว (ม.)">
                <input type="number" step="0.01" placeholder="0.00" value={form.lengthM} onChange={e => set('lengthM', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="ความกว้าง (ม.)">
                <input type="number" step="0.01" placeholder="0.00" value={form.widthM} onChange={e => set('widthM', e.target.value)} style={inputStyle()} />
              </Field>
            </div>
            <Field label="หมายเหตุ">
              <input placeholder="หมายเหตุ (ถ้ามี)" value={form.remark} onChange={e => set('remark', e.target.value)} style={inputStyle()} />
            </Field>
            <div style={{ display:'flex', gap:8, paddingTop:4 }}>
              <button
                onClick={() => upsert.mutate({ ...form, itemCode: editing || form.itemCode })}
                disabled={upsert.isPending}
                style={{ flex:1, padding:'13px', background:'#CC0000', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}
              >
                {upsert.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ padding:'13px 20px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:10, fontSize:14, cursor:'pointer' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─── Customers tab ─── */
function Customers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey:['customers'], queryFn: customersApi.getAll });
  const [form, setForm]       = useState(CUST_EMPTY);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]   = useState('');

  const upsert = useMutation({
    mutationFn: (d) => editing ? customersApi.update(d) : customersApi.add(d),
    onSuccess: (res) => { if (res.success) { setShowModal(false); setEditing(null); setForm(CUST_EMPTY); qc.invalidateQueries(['customers']); } },
  });
  const del = useMutation({ mutationFn: (arcode) => customersApi.delete(arcode), onSuccess: () => qc.invalidateQueries(['customers']) });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function openAdd()  { setForm(CUST_EMPTY); setEditing(null); setShowModal(true); }
  function openEdit(c){ setForm({...c}); setEditing(c.arcode); setShowModal(true); }

  const customers = (data?.customers || []).filter(c =>
    !search || c.arcode?.toLowerCase().includes(search.toLowerCase()) || c.arname?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <div style={{ flex:1, display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
          <input
            placeholder="ค้นหา Arcode / ชื่อลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, border:'none', fontSize:14, padding:'10px 14px', outline:'none' }}
          />
          <div style={{ display:'flex', alignItems:'center', paddingRight:12, color:'#bbb' }}><Search size={15}/></div>
        </div>
        <button
          onClick={openAdd}
          style={{ display:'flex', alignItems:'center', gap:6, background:'#CC0000', color:'#fff', border:'none', borderRadius:10, padding:'0 18px', cursor:'pointer', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}
        >
          <Plus size={15}/> เพิ่มลูกค้า
        </button>
      </div>

      <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#fff0f0' }}>
                {['Arcode','ชื่อลูกค้า','หมายเหตุ','วันที่สร้าง',''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #f0d0d0', fontWeight:700, color:'#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#bbb' }}>
                  {search ? `ไม่พบ "${search}"` : 'ยังไม่มีข้อมูลลูกค้า'}
                </td></tr>
              ) : customers.map((c, idx) => (
                <tr key={c.arcode} style={{ borderBottom: idx < customers.length-1 ? '1px solid #f5e0e0' : 'none', background:'#fff' }}>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#CC0000', fontWeight:600 }}>{c.arcode}</td>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:'#1a1a1a' }}>{c.arname}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{c.remark || '-'}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{c.createdAt?.slice(0,10) || '-'}</td>
                  <td style={{ padding:'10px 8px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => openEdit(c)} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, padding:'4px 8px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:6, cursor:'pointer' }}>
                        <Edit2 size={11}/> แก้ไข
                      </button>
                      <button onClick={() => { if(window.confirm(`ลบ ${c.arcode}?`)) del.mutate(c.arcode); }} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, padding:'4px 8px', background:'#fef2f2', border:'none', color:'#dc2626', borderRadius:6, cursor:'pointer' }}>
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editing ? `แก้ไขลูกค้า: ${editing}` : 'เพิ่มลูกค้าใหม่'} onClose={() => setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Arcode (รหัสลูกค้า) *">
              <input placeholder="เช่น AR001" value={form.arcode} onChange={e => set('arcode', e.target.value)} disabled={!!editing} style={inputStyle()} />
            </Field>
            <Field label="ชื่อลูกค้า *">
              <input placeholder="ชื่อบริษัท / ลูกค้า" value={form.arname} onChange={e => set('arname', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="หมายเหตุ">
              <input placeholder="หมายเหตุ (ถ้ามี)" value={form.remark} onChange={e => set('remark', e.target.value)} style={inputStyle()} />
            </Field>
            <div style={{ display:'flex', gap:8, paddingTop:4 }}>
              <button
                onClick={() => upsert.mutate({ ...form, arcode: editing || form.arcode })}
                disabled={upsert.isPending}
                style={{ flex:1, padding:'13px', background:'#CC0000', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}
              >
                {upsert.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ padding:'13px 20px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:10, fontSize:14, cursor:'pointer' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─── Main ─── */
export default function Data() {
  const nav = useNavigate();
  const [tab, setTab] = useState('items');

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>🗄️ ข้อมูลหลัก</h2>
          <p style={{ fontSize:11, color:'#b09898' }}>Master Data</p>
        </div>
      </div>

      <div style={{ padding:'20px 24px', maxWidth:1100 }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #f0d0d0', paddingBottom:0 }}>
          {[['items','📦 สินค้า', Package],['customers','🏢 ลูกค้า', Users]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding:'10px 20px', border:'none', borderRadius:'8px 8px 0 0',
                background: tab === k ? '#CC0000' : '#fff',
                color: tab === k ? '#fff' : '#374151',
                fontWeight: tab === k ? 700 : 400,
                fontSize: 14, cursor:'pointer',
                borderBottom: tab === k ? '2px solid #CC0000' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'items'     && <Items />}
        {tab === 'customers' && <Customers />}
      </div>
    </div>
  );
}
