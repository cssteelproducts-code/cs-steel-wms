import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transferApi } from '../api';

const STATUS_COLOR = { 'รอดำเนินการ':'#f39c12','กำลังโอน':'#2980b9','เสร็จสิ้น':'#27ae60','ยกเลิก':'#7f8c8d' };
const TASK_EMPTY = { fromLocationId:'', toLocationId:'', skuCode:'', skuName:'', quantity:'', unit:'ชิ้น', priority:2, remark:'' };

export default function Transfer() {
  const [tab, setTab] = useState('tasks');
  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {[['tasks','📋 งานโอน'],['vehicles','🚛 ยานพาหนะ']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background:tab===k?'var(--accent)':'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 14px', fontSize:13, cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'tasks'    && <Tasks />}
      {tab === 'vehicles' && <Vehicles />}
    </div>
  );
}

function Tasks() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ status:'' });
  const { data } = useQuery({ queryKey: ['transfer-tasks', filter], queryFn: () => transferApi.getTasks(filter) });
  const { data: vehData } = useQuery({ queryKey: ['transfer-vehicles'], queryFn: transferApi.getVehicles });
  const [form, setForm]       = useState(TASK_EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg]         = useState('');

  const upsert = useMutation({
    mutationFn: (d) => editing ? transferApi.updateTask(d) : transferApi.addTask(d),
    onSuccess: (res) => { if (res.success) { setShowForm(false); setEditing(null); setForm(TASK_EMPTY); qc.invalidateQueries(['transfer-tasks']); } else setMsg(res.message); },
  });
  const start    = useMutation({ mutationFn: ({ taskId, veh }) => transferApi.startTask({ taskId, assignedVehicle: veh }), onSuccess: () => qc.invalidateQueries(['transfer-tasks']) });
  const complete = useMutation({ mutationFn: ({ taskId }) => transferApi.completeTask({ taskId }), onSuccess: () => qc.invalidateQueries(['transfer-tasks']) });
  const cancel   = useMutation({ mutationFn: transferApi.cancelTask,  onSuccess: () => qc.invalidateQueries(['transfer-tasks']) });
  const del      = useMutation({ mutationFn: transferApi.deleteTask,  onSuccess: () => qc.invalidateQueries(['transfer-tasks']) });

  function set(k) { return e => setForm(f=>({...f,[k]:e.target.value})); }
  const tasks = data?.tasks || [];
  const vehicles = vehData?.vehicles || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <h3>งานโอน ({tasks.length})</h3>
          <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))} style={{ width:140 }}>
            <option value="">ทุกสถานะ</option>
            {['รอดำเนินการ','กำลังโอน','เสร็จสิ้น','ยกเลิก'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { setForm(TASK_EMPTY); setEditing(null); setShowForm(true); }}>+ สร้างงาน</button>
      </div>
      {msg && <p style={{ color:'#e74c3c', fontSize:13, marginBottom:8 }}>{msg}</p>}
      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
            <input placeholder="จากตำแหน่ง" value={form.fromLocationId} onChange={set('fromLocationId')} />
            <input placeholder="ไปตำแหน่ง" value={form.toLocationId} onChange={set('toLocationId')} />
            <input placeholder="รหัส SKU" value={form.skuCode} onChange={set('skuCode')} />
            <input placeholder="ชื่อสินค้า" value={form.skuName} onChange={set('skuName')} />
            <input type="number" placeholder="จำนวน" value={form.quantity} onChange={set('quantity')} />
            <input placeholder="หน่วย" value={form.unit} onChange={set('unit')} />
            <select value={form.priority} onChange={set('priority')}>
              <option value={1}>1 - ด่วน</option>
              <option value={2}>2 - ปกติ</option>
              <option value={3}>3 - ไม่เร่ง</option>
            </select>
            <input placeholder="หมายเหตุ" value={form.remark} onChange={set('remark')} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={() => upsert.mutate({ ...form, taskId: editing })} disabled={upsert.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {tasks.map(t => (
          <div key={t.taskId} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <span style={{ fontWeight:600 }}>{t.skuName || t.skuCode}</span>
                <span style={{ fontSize:13, color:'var(--muted)', marginLeft:8 }}>{t.quantity} {t.unit}</span>
                <span style={{ marginLeft:8, background:STATUS_COLOR[t.status]||'#7f8c8d', color:'#fff', borderRadius:4, padding:'2px 7px', fontSize:12 }}>{t.status}</span>
              </div>
              <span style={{ fontSize:12, color:'var(--muted)' }}>P{t.priority}</span>
            </div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{t.fromLocationId} → {t.toLocationId}</div>
            {t.assignedVehicle && <div style={{ fontSize:12, color:'var(--muted)' }}>รถ: {t.assignedVehicle}</div>}
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {t.status==='รอดำเนินการ' && (
                <>
                  <button onClick={() => { setForm({...t}); setEditing(t.taskId); setShowForm(true); }} style={{ fontSize:12, padding:'3px 8px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, cursor:'pointer' }}>แก้ไข</button>
                  <select defaultValue="" onChange={e => { if(e.target.value) start.mutate({ taskId:t.taskId, veh:e.target.value }); }} style={{ fontSize:12, padding:'2px 6px', width:'auto' }}>
                    <option value="">เลือกรถ+เริ่ม</option>
                    {vehicles.map(v=><option key={v.vehicleId} value={v.licensePlate}>{v.licensePlate}</option>)}
                  </select>
                  <button onClick={() => { if(confirm('ยกเลิก?')) cancel.mutate(t.taskId); }} style={{ fontSize:12, padding:'3px 8px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, cursor:'pointer' }}>ยกเลิก</button>
                </>
              )}
              {t.status==='กำลังโอน' && <button onClick={() => { if(confirm('เสร็จสิ้น?')) complete.mutate({ taskId:t.taskId }); }} style={{ fontSize:12, padding:'3px 8px', background:'#27ae60', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>เสร็จสิ้น</button>}
              {(t.status==='เสร็จสิ้น'||t.status==='ยกเลิก') && <button onClick={() => { if(confirm('ลบ?')) del.mutate(t.taskId); }} style={{ fontSize:12, padding:'3px 8px', background:'#922b21', border:'none', color:'#fff', borderRadius:4, cursor:'pointer' }}>ลบ</button>}
            </div>
          </div>
        ))}
        {tasks.length===0 && <p style={{ color:'var(--muted)', fontSize:13 }}>ไม่มีงานโอน</p>}
      </div>
    </div>
  );
}

function Vehicles() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['transfer-vehicles'], queryFn: transferApi.getVehicles });
  const [form, setForm]       = useState({ licensePlate:'', vehicleType:'', driverName:'', phone:'', status:'ว่าง', remark:'' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: (d) => editing ? transferApi.updateVehicle(d) : transferApi.addVehicle(d),
    onSuccess: (res) => { if (res.success) { setShowForm(false); setEditing(null); qc.invalidateQueries(['transfer-vehicles']); } },
  });
  const del = useMutation({ mutationFn: transferApi.deleteVehicle, onSuccess: () => qc.invalidateQueries(['transfer-vehicles']) });

  function set(k) { return e => setForm(f=>({...f,[k]:e.target.value})); }
  const vehicles = data?.vehicles || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <h3>ยานพาหนะในโรงงาน ({vehicles.length})</h3>
        <button className="btn-primary" onClick={() => { setForm({ licensePlate:'', vehicleType:'', driverName:'', phone:'', status:'ว่าง', remark:'' }); setEditing(null); setShowForm(true); }}>+ เพิ่ม</button>
      </div>
      {showForm && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
            <input placeholder="ทะเบียน" value={form.licensePlate} onChange={set('licensePlate')} />
            <input placeholder="ประเภท" value={form.vehicleType} onChange={set('vehicleType')} />
            <input placeholder="ชื่อผู้ขับ" value={form.driverName} onChange={set('driverName')} />
            <input placeholder="เบอร์โทร" value={form.phone} onChange={set('phone')} />
            <select value={form.status} onChange={set('status')}>
              {['ว่าง','กำลังใช้งาน','ซ่อม'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={() => upsert.mutate({ ...form, vehicleId: editing })} disabled={upsert.isPending}>บันทึก</button>
            <button onClick={() => setShowForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
          </div>
        </div>
      )}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr style={{ background:'var(--surface)' }}>
          {['ทะเบียน','ประเภท','ผู้ขับ','เบอร์','สถานะ',''].map(h=>(
            <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {vehicles.map(v => (
            <tr key={v.vehicleId} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'7px 10px' }}>{v.licensePlate}</td>
              <td style={{ padding:'7px 10px' }}>{v.vehicleType}</td>
              <td style={{ padding:'7px 10px' }}>{v.driverName}</td>
              <td style={{ padding:'7px 10px' }}>{v.phone}</td>
              <td style={{ padding:'7px 10px' }}>{v.status}</td>
              <td style={{ padding:'7px 4px', display:'flex', gap:4 }}>
                <button onClick={() => { setForm({...v}); setEditing(v.vehicleId); setShowForm(true); }} style={{ fontSize:11, padding:'2px 7px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>แก้ไข</button>
                <button onClick={() => { if(confirm('ลบ?')) del.mutate(v.vehicleId); }} style={{ fontSize:11, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
