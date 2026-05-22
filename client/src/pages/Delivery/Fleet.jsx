import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fleetApi } from '../../api';

const VT = ['4 ล้อ','6 ล้อ','8 ล้อ','10 ล้อ','12 ล้อ','เทเลอร์','พ่วง'];
const STATUSES = ['พร้อม','ไม่พร้อม','ซ่อม','จอด'];

const EMPTY = { licensePlate:'', vehicleType:'', weightCapacityKg:'', lengthCapacityM:'', widthCapacityM:'', heightCapacityM:'', homeZone:'', status:'พร้อม', remark:'', insuranceCompany:'', insuranceExpiry:'', prbaCompany:'', prbaExpiry:'', taxRenewalDate:'', hasHiab:false };

export default function Fleet() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['fleet'], queryFn: fleetApi.getAll });
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showMaint, setShowMaint] = useState(null);
  const [maintForm, setMaintForm] = useState({ type:'ซ่อม', symptom:'', startDate:'', expectedEndDate:'', status:'ซ่อม' });
  const [msg, setMsg] = useState('');

  const { data: maintData } = useQuery({
    queryKey: ['fleet-maint', showMaint],
    queryFn:  () => fleetApi.getMaintenance(showMaint),
    enabled:  !!showMaint,
  });

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); }

  const upsert = useMutation({
    mutationFn: (d) => editing ? fleetApi.update(d) : fleetApi.add(d),
    onSuccess: (res) => {
      if (res.success) { setShowForm(false); setEditing(null); setForm(EMPTY); qc.invalidateQueries(['fleet']); setMsg(''); }
      else setMsg(res.message);
    },
  });

  const del = useMutation({
    mutationFn: fleetApi.delete,
    onSuccess:  () => qc.invalidateQueries(['fleet']),
  });

  const addMaint = useMutation({
    mutationFn: (d) => fleetApi.addMaintenance(d),
    onSuccess: (res) => {
      if (res.success) { setShowMaint(null); qc.invalidateQueries(['fleet']); }
      else setMsg(res.message);
    },
  });

  const closeMaint = useMutation({
    mutationFn: (d) => fleetApi.closeMaintenance(d),
    onSuccess:  () => { qc.invalidateQueries(['fleet-maint', showMaint]); qc.invalidateQueries(['fleet']); },
  });

  function startEdit(v) { setForm({ ...v }); setEditing(v.fleetId); setShowForm(true); }
  function handleSave() { upsert.mutate({ ...form, fleetId: editing }); }

  const vehicles = data?.vehicles || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3>รถทั้งหมด ({vehicles.length})</h3>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}>+ เพิ่มรถ</button>
      </div>
      {msg && <p style={{ color:'#e74c3c', fontSize:13, marginBottom:8 }}>{msg}</p>}

      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16 }}>
          <h4 style={{ marginBottom:12 }}>{editing ? 'แก้ไขรถ' : 'เพิ่มรถ'}</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            <input placeholder="ทะเบียนรถ" value={form.licensePlate} onChange={set('licensePlate')} />
            <select value={form.vehicleType} onChange={set('vehicleType')}>
              <option value="">ประเภทรถ</option>
              {VT.map(v => <option key={v}>{v}</option>)}
            </select>
            <input placeholder="น้ำหนักบรรทุก (กก.)" type="number" value={form.weightCapacityKg} onChange={set('weightCapacityKg')} />
            <input placeholder="ความยาว (ม.)" type="number" step="0.01" value={form.lengthCapacityM} onChange={set('lengthCapacityM')} />
            <input placeholder="ความกว้าง (ม.)" type="number" step="0.01" value={form.widthCapacityM} onChange={set('widthCapacityM')} />
            <input placeholder="ความสูง (ม.)" type="number" step="0.01" value={form.heightCapacityM} onChange={set('heightCapacityM')} />
            <input placeholder="โซนประจำ" value={form.homeZone} onChange={set('homeZone')} />
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="บ. ประกัน" value={form.insuranceCompany} onChange={set('insuranceCompany')} />
            <input type="date" placeholder="วันหมดประกัน" value={form.insuranceExpiry} onChange={set('insuranceExpiry')} title="วันหมดประกัน" />
            <input placeholder="บ. พรบ." value={form.prbaCompany} onChange={set('prbaCompany')} />
            <input type="date" placeholder="วันหมด พรบ." value={form.prbaExpiry} onChange={set('prbaExpiry')} title="วันหมด พรบ." />
            <input type="date" placeholder="ต่อภาษีประจำปี" value={form.taxRenewalDate} onChange={set('taxRenewalDate')} title="ต่อภาษีประจำปี" />
            <input placeholder="หมายเหตุ" value={form.remark} onChange={set('remark')} />
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
              <input type="checkbox" checked={form.hasHiab} onChange={set('hasHiab')} style={{ width:'auto' }} /> มี Hiab
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
              {['ทะเบียน','ประเภท','น้ำหนัก','สถานะ','ประกัน','Hiab',''].map(h => (
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.fleetId} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 10px' }}>{v.licensePlate}</td>
                <td style={{ padding:'8px 10px' }}>{v.vehicleType}</td>
                <td style={{ padding:'8px 10px' }}>{v.weightCapacityKg?.toLocaleString()} กก.</td>
                <td style={{ padding:'8px 10px' }}>
                  <span style={{ background: v.status==='พร้อม'?'#27ae60':'#e74c3c', color:'#fff', borderRadius:4, padding:'2px 8px', fontSize:12 }}>{v.status}</span>
                </td>
                <td style={{ padding:'8px 10px', fontSize:12, color:'var(--muted)' }}>{v.insuranceExpiry || '-'}</td>
                <td style={{ padding:'8px 10px' }}>{v.hasHiab ? '✓' : ''}</td>
                <td style={{ padding:'8px 4px', display:'flex', gap:4 }}>
                  <button onClick={() => startEdit(v)} style={{ fontSize:12, padding:'3px 8px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>แก้ไข</button>
                  <button onClick={() => setShowMaint(v.fleetId)} style={{ fontSize:12, padding:'3px 8px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>ซ่อม</button>
                  <button onClick={() => { if (confirm('ลบรถ?')) del.mutate(v.fleetId); }} style={{ fontSize:12, padding:'3px 8px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showMaint && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:24, width:480, maxHeight:'80vh', overflowY:'auto' }}>
            <h4 style={{ marginBottom:12 }}>ประวัติ/บันทึกซ่อม — {vehicles.find(v=>v.fleetId===showMaint)?.licensePlate}</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              <select value={maintForm.type} onChange={e => setMaintForm(f=>({...f,type:e.target.value}))}>
                {['ซ่อม','บำรุง','จอดพัก','อื่นๆ'].map(t=><option key={t}>{t}</option>)}
              </select>
              <input placeholder="อาการ / รายละเอียด" value={maintForm.symptom} onChange={e=>setMaintForm(f=>({...f,symptom:e.target.value}))} />
              <input type="date" value={maintForm.startDate} onChange={e=>setMaintForm(f=>({...f,startDate:e.target.value}))} title="วันที่เริ่ม" />
              <input type="date" value={maintForm.expectedEndDate} onChange={e=>setMaintForm(f=>({...f,expectedEndDate:e.target.value}))} title="วันที่คาดว่าเสร็จ" />
              <button className="btn-primary" onClick={() => addMaint.mutate({ fleetId:showMaint, licensePlate: vehicles.find(v=>v.fleetId===showMaint)?.licensePlate, ...maintForm })} disabled={addMaint.isPending}>บันทึกการซ่อม</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(maintData?.records || []).map(r => (
                <div key={r.recordId} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:10, fontSize:13 }}>
                  <div><strong>{r.type}</strong> — {r.symptom}</div>
                  <div style={{ color:'var(--muted)' }}>เริ่ม: {r.startDate} | คาดเสร็จ: {r.expectedEndDate} | จริง: {r.actualEndDate || 'ยังไม่เสร็จ'}</div>
                  {!r.actualEndDate && (
                    <button onClick={() => closeMaint.mutate({ recordId:r.recordId, actualEndDate: new Date().toISOString().slice(0,10) })}
                      style={{ marginTop:6, fontSize:12, padding:'3px 10px', background:'#27ae60', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>
                      ปิดงาน
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setShowMaint(null)} style={{ marginTop:16, background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, padding:'6px 16px', cursor:'pointer' }}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}
