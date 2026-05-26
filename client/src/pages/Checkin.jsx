import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { trucksApi } from '../api';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const WAREHOUSES   = ['คลังสมุทรสาคร', 'คลังสุราษฎร์ธานี'];
const VEHICLE_TYPES = ['4 ล้อ', '6 ล้อ', '8 ล้อ', '10 ล้อ', '12 ล้อ', 'เทเลอร์', 'พ่วง'];
const TRANSPORTS   = ['CSS.', 'Customer', 'Sup.'];

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* pill button selector */
function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? '' : opt)}
            style={{
              padding:'6px 18px', borderRadius:20, fontSize:13, cursor:'pointer',
              border: `1.5px solid ${active ? '#CC0000' : '#d1d5db'}`,
              background: active ? '#CC0000' : '#fff',
              color: active ? '#fff' : '#374151',
              fontWeight: active ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* section label */
function Label({ children }) {
  return <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:8 }}>{children}</div>;
}

export default function Checkin() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const [form, setForm] = useState({
    date: todayStr(),
    checkinTime: nowTime(),
    warehouse: '',
    licensePlate: '',
    vehicleType: '',
    transport: '',
    arcode: '',
    arname: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ text:'', ok:false });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.vehicleType) { setMsg({ text:'กรุณาเลือกประเภทรถ', ok:false }); return; }
    setLoading(true); setMsg({ text:'', ok:false });
    try {
      const res = await trucksApi.checkin({
        licensePlate: form.licensePlate,
        vehicleType:  form.vehicleType,
        transport:    form.transport,
        arcode:       form.arcode,
        arname:       form.arname,
        warehouse:    form.warehouse,
        checkinTime:  form.checkinTime,
      });
      if (!res.success) { setMsg({ text: res.message, ok:false }); return; }
      setMsg({ text:`บันทึกสำเร็จ — ${form.licensePlate} เวลา ${form.checkinTime}`, ok:true });
      qc.invalidateQueries({ queryKey: ['trucks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setForm(f => ({ ...f, licensePlate:'', arcode:'', arname:'', vehicleType:'', transport:'' }));
    } catch { setMsg({ text:'ไม่สามารถเชื่อมต่อ Server ได้', ok:false }); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Page header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4 }}>
          <ArrowLeft size={20}/>
        </button>
        <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a' }}>รับรถเข้า</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:24, maxWidth:900 }}>

        {/* วันที่ + เวลาเข้า */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
          <div>
            <Label>วันที่</Label>
            <input value={form.date} onChange={e => set('date', e.target.value)} style={{ fontSize:14 }}/>
          </div>
          <div>
            <Label>เวลาเข้า</Label>
            <div style={{ position:'relative' }}>
              <input
                type="time"
                value={form.checkinTime}
                onChange={e => set('checkinTime', e.target.value)}
                style={{ fontSize:15, fontWeight:600, color:'#CC0000', paddingRight:40 }}
              />
            </div>
            <p style={{ fontSize:11, color:'#CC0000', marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
              ✏️ แก้ไขเวลาได้ก่อนบันทึก
            </p>
          </div>
        </div>

        {/* คลังสินค้า */}
        <div>
          <Label>คลังสินค้า</Label>
          <PillGroup options={WAREHOUSES} value={form.warehouse} onChange={v => set('warehouse', v)}/>
        </div>

        {/* ทะเบียนรถ */}
        <div>
          <Label>ทะเบียนรถ</Label>
          <input
            placeholder="เช่น กษ-1234"
            value={form.licensePlate}
            onChange={e => set('licensePlate', e.target.value)}
            required
            style={{ fontSize:14 }}
          />
        </div>

        {/* ประเภทรถ */}
        <div>
          <Label>ประเภทรถ</Label>
          <PillGroup options={VEHICLE_TYPES} value={form.vehicleType} onChange={v => set('vehicleType', v)}/>
        </div>

        {/* ขนส่ง */}
        <div>
          <Label>ขนส่ง</Label>
          <PillGroup options={TRANSPORTS} value={form.transport} onChange={v => set('transport', v)}/>
        </div>

        {/* ลูกค้า */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <Label>ลูกค้า</Label>
          <input
            placeholder="ARCODE หรือชื่อลูกค้า"
            value={form.arcode}
            onChange={e => set('arcode', e.target.value)}
            style={{ fontSize:14 }}
          />
          <input
            placeholder="ชื่อลูกค้า (auto)"
            value={form.arname}
            onChange={e => set('arname', e.target.value)}
            style={{ fontSize:14, color:'#6b7280' }}
          />
        </div>

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
          type="submit"
          disabled={loading}
          style={{
            width:'100%', padding:'15px',
            background: loading ? '#999' : '#CC0000',
            color:'#fff', border:'none', borderRadius:10,
            fontSize:16, fontWeight:700, cursor: loading ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:'0 4px 14px rgba(204,0,0,.3)',
          }}
        >
          <CheckCircle size={18}/> {loading ? 'กำลังบันทึก...' : 'บันทึกรับรถ'}
        </button>
      </form>
    </div>
  );
}
