import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, fleetApi } from '../../api';

const VT = ['4 ล้อ','6 ล้อ','8 ล้อ','10 ล้อ','12 ล้อ','เทเลอร์','พ่วง'];
const EMP_EMPTY = { empName:'', nickName:'', position:'คนขับ', phone:'', status:'พร้อม' };
const POSITIONS = ['คนขับ','ผู้ช่วย','ทั้งคู่'];

export default function Trip() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState('emp');
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date(); return String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  });

  // employees
  const { data: empData } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.getAll });
  const [empForm, setEmpForm] = useState(EMP_EMPTY);
  const [editEmp, setEditEmp] = useState(null);
  const [showEmpForm, setShowEmpForm] = useState(false);

  const upsertEmp = useMutation({
    mutationFn: (d) => editEmp ? employeesApi.update(d) : employeesApi.add(d),
    onSuccess:  (res) => { if (res.success) { setShowEmpForm(false); setEditEmp(null); setEmpForm(EMP_EMPTY); qc.invalidateQueries(['employees']); } },
  });
  const delEmp = useMutation({ mutationFn: employeesApi.delete, onSuccess: () => qc.invalidateQueries(['employees']) });

  // trip rates
  const { data: ratesData } = useQuery({ queryKey: ['trip-rates'], queryFn: employeesApi.getTripRates });
  const [rates, setRates] = useState(null);
  const saveRates = useMutation({
    mutationFn: employeesApi.saveTripRates,
    onSuccess: () => qc.invalidateQueries(['trip-rates']),
  });

  const displayRates = rates || ratesData?.rates || [];

  // trip logs
  const { data: logsData } = useQuery({ queryKey: ['trip-logs', yearMonth], queryFn: () => employeesApi.getTripLogs({ yearMonth }) });
  const { data: fleetData } = useQuery({ queryKey: ['fleet-avail'], queryFn: fleetApi.getAvailable });
  const [logForm, setLogForm] = useState({ planId:'', planDate:'', fleetId:'', licensePlate:'', vehicleType:'', driverEmpId:'', driverEmpName:'', assistantEmpId:'', assistantEmpName:'', driverFee:'', assistantFee:'', remark:'' });
  const [showLogForm, setShowLogForm] = useState(false);

  const saveLog = useMutation({
    mutationFn: employeesApi.saveTripLog,
    onSuccess: (res) => { if (res.success) { setShowLogForm(false); qc.invalidateQueries(['trip-logs']); } },
  });
  const delLog = useMutation({ mutationFn: employeesApi.deleteTripLog, onSuccess: () => qc.invalidateQueries(['trip-logs']) });

  const employees = empData?.employees || [];
  const logs = logsData?.logs || [];
  const vehicles = fleetData?.vehicles || [];

  function setLogField(k) { return e => setLogForm(f => ({ ...f, [k]: e.target.value })); }

  function handleVehicleSelect(e) {
    const v = vehicles.find(x => x.fleetId === e.target.value);
    if (v) {
      const vt = v.vehicleType;
      const rate = displayRates.find(r => r.vehicleType === vt);
      setLogForm(f => ({
        ...f, fleetId: v.fleetId, licensePlate: v.licensePlate, vehicleType: vt,
        driverFee: rate?.driverRate || '', assistantFee: rate?.assistantRate || '',
      }));
    }
  }

  function handleDriverSelect(e) {
    const emp = employees.find(x => x.empId === e.target.value);
    setLogForm(f => ({ ...f, driverEmpId: e.target.value, driverEmpName: emp?.empName || '' }));
  }

  function handleAssistSelect(e) {
    const emp = employees.find(x => x.empId === e.target.value);
    setLogForm(f => ({ ...f, assistantEmpId: e.target.value, assistantEmpName: emp?.empName || '' }));
  }

  const SUBTABS = [['emp','พนักงาน'],['rates','อัตราค่าเที่ยว'],['logs','บันทึกเที่ยว']];

  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {SUBTABS.map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)}
            style={{ background:subTab===k?'var(--accent2)':'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px', fontSize:13, cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {subTab === 'emp' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <h4>พนักงาน ({employees.length})</h4>
            <button className="btn-primary" onClick={() => { setEmpForm(EMP_EMPTY); setEditEmp(null); setShowEmpForm(true); }}>+ เพิ่ม</button>
          </div>
          {showEmpForm && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                <input placeholder="ชื่อ-นามสกุล" value={empForm.empName} onChange={e=>setEmpForm(f=>({...f,empName:e.target.value}))} />
                <input placeholder="ชื่อเล่น" value={empForm.nickName} onChange={e=>setEmpForm(f=>({...f,nickName:e.target.value}))} />
                <select value={empForm.position} onChange={e=>setEmpForm(f=>({...f,position:e.target.value}))}>
                  {POSITIONS.map(p=><option key={p}>{p}</option>)}
                </select>
                <input placeholder="เบอร์โทร" value={empForm.phone} onChange={e=>setEmpForm(f=>({...f,phone:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button className="btn-primary" onClick={() => upsertEmp.mutate({ ...empForm, empId: editEmp })} disabled={upsertEmp.isPending}>บันทึก</button>
                <button onClick={() => setShowEmpForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
              </div>
            </div>
          )}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'var(--surface)' }}>
              {['ชื่อ','ชื่อเล่น','ตำแหน่ง','เบอร์','สถานะ',''].map(h=>(
                <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.empId} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px' }}>{e.empName}</td>
                  <td style={{ padding:'7px 10px' }}>{e.nickName}</td>
                  <td style={{ padding:'7px 10px' }}>{e.position}</td>
                  <td style={{ padding:'7px 10px' }}>{e.phone}</td>
                  <td style={{ padding:'7px 10px' }}>{e.status}</td>
                  <td style={{ padding:'7px 4px', display:'flex', gap:4 }}>
                    <button onClick={() => { setEmpForm({...e}); setEditEmp(e.empId); setShowEmpForm(true); }} style={{ fontSize:12, padding:'2px 7px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4 }}>แก้ไข</button>
                    <button onClick={() => { if(confirm('ลบ?')) delEmp.mutate(e.empId); }} style={{ fontSize:12, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'rates' && (
        <div>
          <h4 style={{ marginBottom:12 }}>อัตราค่าเที่ยว</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxWidth:500 }}>
            {VT.map(vt => {
              const r = displayRates.find(x => x.vehicleType === vt) || { vehicleType: vt, driverRate: 0, assistantRate: 0 };
              return (
                <div key={vt} style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:13 }}>{vt}</span>
                  <input type="number" placeholder="คนขับ (บ.)" value={r.driverRate}
                    onChange={e => {
                      const newRates = VT.map(v => {
                        const cur = displayRates.find(x=>x.vehicleType===v) || { vehicleType:v, driverRate:0, assistantRate:0 };
                        return v===vt ? { ...cur, driverRate: parseFloat(e.target.value)||0 } : cur;
                      });
                      setRates(newRates);
                    }} />
                  <input type="number" placeholder="ผู้ช่วย (บ.)" value={r.assistantRate}
                    onChange={e => {
                      const newRates = VT.map(v => {
                        const cur = displayRates.find(x=>x.vehicleType===v) || { vehicleType:v, driverRate:0, assistantRate:0 };
                        return v===vt ? { ...cur, assistantRate: parseFloat(e.target.value)||0 } : cur;
                      });
                      setRates(newRates);
                    }} />
                </div>
              );
            })}
          </div>
          <button className="btn-primary" style={{ marginTop:14 }}
            onClick={() => saveRates.mutate(VT.map(vt => displayRates.find(x=>x.vehicleType===vt) || { vehicleType:vt, driverRate:0, assistantRate:0 }))}
            disabled={saveRates.isPending}>บันทึกอัตรา</button>
        </div>
      )}

      {subTab === 'logs' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, alignItems:'center' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <h4>บันทึกเที่ยว</h4>
              <input placeholder="MM/YYYY" value={yearMonth} onChange={e => setYearMonth(e.target.value)} style={{ width:100 }} />
            </div>
            <button className="btn-primary" onClick={() => setShowLogForm(true)}>+ บันทึกเที่ยว</button>
          </div>
          {showLogForm && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                <input placeholder="Plan ID (ถ้ามี)" value={logForm.planId} onChange={setLogField('planId')} />
                <input type="date" value={logForm.planDate} onChange={setLogField('planDate')} title="วันที่" />
                <select onChange={handleVehicleSelect}>
                  <option value="">เลือกรถ</option>
                  {vehicles.map(v=><option key={v.fleetId} value={v.fleetId}>{v.licensePlate} ({v.vehicleType})</option>)}
                </select>
                <select onChange={handleDriverSelect}>
                  <option value="">คนขับ</option>
                  {employees.filter(e=>e.position!=='ผู้ช่วย').map(e=><option key={e.empId} value={e.empId}>{e.empName} ({e.nickName})</option>)}
                </select>
                <input type="number" placeholder="ค่าเที่ยวคนขับ" value={logForm.driverFee} onChange={setLogField('driverFee')} />
                <select onChange={handleAssistSelect}>
                  <option value="">ผู้ช่วย</option>
                  {employees.filter(e=>e.position!=='คนขับ').map(e=><option key={e.empId} value={e.empId}>{e.empName} ({e.nickName})</option>)}
                </select>
                <input type="number" placeholder="ค่าเที่ยวผู้ช่วย" value={logForm.assistantFee} onChange={setLogField('assistantFee')} />
                <input placeholder="หมายเหตุ" value={logForm.remark} onChange={setLogField('remark')} />
              </div>
              <div style={{ fontSize:13, marginTop:8, color:'var(--muted)' }}>
                รวม: {((parseFloat(logForm.driverFee)||0)+(parseFloat(logForm.assistantFee)||0)).toLocaleString()} บ.
              </div>
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button className="btn-primary" onClick={() => saveLog.mutate({ ...logForm, totalFee:(parseFloat(logForm.driverFee)||0)+(parseFloat(logForm.assistantFee)||0) })} disabled={saveLog.isPending}>บันทึก</button>
                <button onClick={() => setShowLogForm(false)} style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)' }}>ยกเลิก</button>
              </div>
            </div>
          )}
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
            รวม {logs.length} เที่ยว | ค่าเที่ยวรวม: {logs.reduce((s,l)=>s+(l.totalFee||0),0).toLocaleString()} บ.
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'var(--surface)' }}>
              {['วันที่','ทะเบียน','คนขับ','ผู้ช่วย','ค่าเที่ยว',''].map(h=>(
                <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.logId} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px' }}>{l.planDate}</td>
                  <td style={{ padding:'7px 10px' }}>{l.licensePlate}</td>
                  <td style={{ padding:'7px 10px' }}>{l.driverEmpName}</td>
                  <td style={{ padding:'7px 10px' }}>{l.assistantEmpName || '-'}</td>
                  <td style={{ padding:'7px 10px' }}>{l.totalFee?.toLocaleString()} บ.</td>
                  <td style={{ padding:'7px 4px' }}>
                    <button onClick={() => { if(confirm('ลบ?')) delLog.mutate(l.logId); }} style={{ fontSize:11, padding:'2px 7px', background:'#922b21', border:'none', color:'#fff', borderRadius:4 }}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
