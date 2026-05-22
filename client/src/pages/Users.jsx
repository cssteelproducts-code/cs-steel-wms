import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api';
import { ArrowLeft, Plus, Edit2, Trash2, X, KeyRound, CheckCircle, Eye, EyeOff } from 'lucide-react';

const ROLES = [
  { value:'viewer',       label:'ดูข้อมูล',       color:'#6b7280' },
  { value:'operator',     label:'บันทึก',          color:'#2563eb' },
  { value:'section_chief',label:'หัวหน้าแผนก',     color:'#7c3aed' },
  { value:'dept_head',    label:'ผู้จัดการแผนก',   color:'#db2777' },
  { value:'manager',      label:'ผู้จัดการ',        color:'#d97706' },
  { value:'admin',        label:'แอดมิน',           color:'#CC0000' },
];
const USER_EMPTY = { username:'', displayName:'', role:'operator', password:'' };

function inputStyle() {
  return { fontSize:14, border:'1px solid #f0d0d0', borderRadius:8, padding:'10px 13px', width:'100%', outline:'none', boxSizing:'border-box' };
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:460, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f0d0d0' }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', display:'flex', padding:4 }}><X size={18}/></button>
        </div>
        <div style={{ padding:'20px' }}>{children}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const def = ROLES.find(r => r.value === role) || { label: role, color:'#888' };
  return (
    <span style={{ fontSize:11, fontWeight:600, color:'#fff', background: def.color, borderRadius:6, padding:'3px 10px' }}>
      {def.label || def.value}
    </span>
  );
}

export default function Users() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const { data } = useQuery({ queryKey:['users'], queryFn: authApi.getUsers });

  const [form, setForm]       = useState(USER_EMPTY);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const [resetTarget, setResetTarget] = useState('');
  const [resetPw, setResetPw]         = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMsg, setResetMsg] = useState({ text:'', ok:false });

  const [msg, setMsg] = useState({ text:'', ok:false });

  const create = useMutation({
    mutationFn: authApi.createUser,
    onSuccess: (res) => { if (res.success) { setShowModal(false); setForm(USER_EMPTY); qc.invalidateQueries(['users']); setMsg({ text:'', ok:false }); } else setMsg({ text: res.message, ok:false }); },
  });
  const update = useMutation({
    mutationFn: authApi.updateUser,
    onSuccess: (res) => { if (res.success) { setShowModal(false); setEditing(null); setForm(USER_EMPTY); qc.invalidateQueries(['users']); } else setMsg({ text: res.message, ok:false }); },
  });
  const del = useMutation({ mutationFn: authApi.deleteUser, onSuccess: () => qc.invalidateQueries(['users']) });
  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: (res) => {
      if (res.success) { setResetMsg({ text:'รีเซ็ตรหัสผ่านสำเร็จ', ok:true }); setTimeout(() => { setShowResetModal(false); setResetMsg({ text:'', ok:false }); setResetPw(''); setResetTarget(''); }, 1500); }
      else setResetMsg({ text: res.message || 'ไม่สำเร็จ', ok:false });
    },
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function openAdd()  { setForm(USER_EMPTY); setEditing(null); setShowPw(false); setMsg({ text:'', ok:false }); setShowModal(true); }
  function openEdit(u){ setForm({ username:u.username, displayName:u.displayName||'', role:u.role, password:'' }); setEditing(u.username); setShowPw(false); setMsg({ text:'', ok:false }); setShowModal(true); }

  const users = data?.users || [];

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>👥 จัดการผู้ใช้งาน</h2>
          <p style={{ fontSize:11, color:'#b09898' }}>User Management</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => { setResetTarget(''); setResetPw(''); setResetMsg({ text:'', ok:false }); setShowResetModal(true); }}
            style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}
          >
            <KeyRound size={14}/> รีเซ็ตรหัสผ่าน
          </button>
          <button
            onClick={openAdd}
            style={{ display:'flex', alignItems:'center', gap:6, background:'#CC0000', color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700 }}
          >
            <Plus size={15}/> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div style={{ padding:'20px 24px', maxWidth:960 }}>

        {/* User table */}
        <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#fff0f0' }}>
                {['Username','ชื่อที่แสดง','สิทธิ์','สร้างเมื่อ',''].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', borderBottom:'1px solid #f0d0d0', fontWeight:700, color:'#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#bbb' }}>ยังไม่มีผู้ใช้งาน</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.username} style={{ borderBottom: i < users.length-1 ? '1px solid #f5e0e0' : 'none', background:'#fff' }}>
                  <td style={{ padding:'12px 16px', fontFamily:'monospace', fontWeight:700, color:'#1a1a1a' }}>{u.username}</td>
                  <td style={{ padding:'12px 16px', color:'#374151' }}>{u.displayName || '-'}</td>
                  <td style={{ padding:'12px 16px' }}><RoleBadge role={u.role}/></td>
                  <td style={{ padding:'12px 16px', color:'#9ca3af', fontSize:12 }}>{u.createdAt?.slice(0,10) || '-'}</td>
                  <td style={{ padding:'12px 10px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => openEdit(u)} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'5px 10px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:6, cursor:'pointer' }}>
                        <Edit2 size={11}/> แก้ไข
                      </button>
                      <button onClick={() => { if(window.confirm(`ลบผู้ใช้ ${u.username}?`)) del.mutate(u.username); }} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'5px 10px', background:'#fef2f2', border:'none', color:'#dc2626', borderRadius:6, cursor:'pointer' }}>
                        <Trash2 size={11}/> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Role legend */}
        <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:6 }}>
          {ROLES.map(r => (
            <span key={r.value} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background: r.color, color:'#fff', opacity:.85 }}>{r.value}: {r.label}</span>
          ))}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <Modal title={editing ? `แก้ไข: ${editing}` : 'เพิ่มผู้ใช้ใหม่'} onClose={() => setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Username *</div>
              <input placeholder="username" value={form.username} onChange={e => set('username', e.target.value)} disabled={!!editing} style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>ชื่อที่แสดง</div>
              <input placeholder="ชื่อ-นามสกุล" value={form.displayName} onChange={e => set('displayName', e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>สิทธิ์การใช้งาน</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set('role', r.value)}
                    style={{ padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:`1.5px solid ${form.role===r.value ? r.color : '#e5e7eb'}`, background: form.role===r.value ? r.color : '#fff', color: form.role===r.value ? '#fff' : '#374151', fontWeight: form.role===r.value ? 700 : 400 }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {!editing && (
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>รหัสผ่านเริ่มต้น *</div>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="รหัสผ่าน"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    style={{ ...inputStyle(), paddingRight:44 }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#888', display:'flex' }}>
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
            )}
            {msg.text && (
              <div style={{ fontSize:13, color: msg.ok ? '#16a34a' : '#dc2626', background: msg.ok ? '#f0fdf4' : '#fef2f2', borderRadius:8, padding:'10px 14px', border:`1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
                {msg.text}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => {
                  if (editing) update.mutate({ targetUsername: editing, displayName: form.displayName, role: form.role });
                  else create.mutate(form);
                }}
                disabled={create.isPending || update.isPending}
                style={{ flex:1, padding:'13px', background:'#CC0000', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}
              >
                {(create.isPending || update.isPending) ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ padding:'13px 20px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:10, fontSize:14, cursor:'pointer' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {showResetModal && (
        <Modal title="รีเซ็ตรหัสผ่าน" onClose={() => setShowResetModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>เลือกผู้ใช้</div>
              <select value={resetTarget} onChange={e => setResetTarget(e.target.value)} style={{ ...inputStyle(), background:'#fff' }}>
                <option value="">-- เลือกผู้ใช้ --</option>
                {users.map(u => <option key={u.username} value={u.username}>{u.displayName || u.username} ({u.username})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>
                รหัสผ่านใหม่
                <br/><span style={{ fontSize:11, color:'#b09898' }}>စကားဝှက်အသစ်</span>
              </div>
              <div style={{ position:'relative' }}>
                <input
                  type={showResetPw ? 'text' : 'password'}
                  placeholder="รหัสผ่านใหม่"
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  style={{ ...inputStyle(), paddingRight:44 }}
                />
                <button type="button" onClick={() => setShowResetPw(p => !p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#888', display:'flex' }}>
                  {showResetPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            {resetMsg.text && (
              <div style={{ fontSize:13, color: resetMsg.ok ? '#16a34a' : '#dc2626', background: resetMsg.ok ? '#f0fdf4' : '#fef2f2', borderRadius:8, padding:'10px 14px', border:`1px solid ${resetMsg.ok ? '#bbf7d0' : '#fecaca'}`, display:'flex', alignItems:'center', gap:8 }}>
                {resetMsg.ok && <CheckCircle size={15}/>} {resetMsg.text}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => reset.mutate({ targetUsername: resetTarget, newPassword: resetPw })}
                disabled={reset.isPending || !resetTarget || !resetPw}
                style={{ flex:1, padding:'13px', background: (!resetTarget||!resetPw) ? '#e5e7eb' : '#CC0000', color: (!resetTarget||!resetPw) ? '#9ca3af' : '#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor: (!resetTarget||!resetPw) ? 'default' : 'pointer' }}
              >
                {reset.isPending ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}
              </button>
              <button onClick={() => setShowResetModal(false)} style={{ padding:'13px 20px', background:'#fff', border:'1px solid #f0d0d0', color:'#374151', borderRadius:10, fontSize:14, cursor:'pointer' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
