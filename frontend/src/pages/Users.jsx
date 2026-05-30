import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, UserX, Shield, Save, X, Trash2, Pencil, RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

const MENUS = [
  { code: 'DASHBOARD', name: 'Dashboard' },
  { code: 'TRIP_MONITOR', name: 'Monitor รถ' },
  { code: 'FORECAST', name: 'วิเคราะห์และวางแผน' },
  { divider: true, section: 'สถานี' },
  { code: 'WEIGH_IN', name: 'สถานีชั่งเข้า' },
  { code: 'DATA_STATION', name: 'สถานี Data' },
  { code: 'LOADING_STATION', name: 'สถานีขึ้นสินค้า' },
  { code: 'WEIGH_OUT', name: 'สถานีชั่งออก' },
  { code: 'CHECKER', name: 'เช็คเกอร์' },
  { code: 'RECORDS', name: 'บันทึกการขึ้นสินค้า' },
  { divider: true, section: 'คลังสินค้าสำเร็จรูป' },
  { code: 'STOCK', name: 'ตรวจสอบ Location' },
  { code: 'STOCKCOUNT_OFFICE', name: 'นับสต็อก (จัดการรอบ)', children: [
    { code: 'STOCKCOUNT_FIELD', name: 'ตรวจนับ (หน้างาน)' },
  ]},
  { code: 'TRANSFER', name: 'ย้ายสินค้าภายใน', children: [
    { code: 'TRANSFER_JOBS', name: 'งาน' },
    { code: 'TRANSFER_STATIONS', name: 'สถานี' },
    { code: 'TRANSFER_VEHICLES', name: 'รถ' },
    { code: 'TRANSFER_REPORTS', name: 'รายงาน' },
  ]},
  { divider: true, section: 'จัดส่ง' },
  { code: 'ETA', name: 'ETA / GPS' },
  { code: 'DELIVERY_PLAN', name: 'แผนจัดส่ง' },
  { divider: true, section: 'ระบบ' },
  { code: 'ALERTS', name: 'การแจ้งเตือน' },
  { code: 'USERS', name: 'จัดการผู้ใช้' },
  { code: 'MASTER', name: 'ข้อมูลหลัก' },
  { divider: true, section: 'เครื่องมือ' },
  { code: 'SHIFT_PLANNING', name: 'วางแผนกะพนักงาน' },
  { code: 'FREIGHT_CALC', name: 'คำนวณค่าขนส่ง' },
  { code: 'REPORTS', name: 'รายงาน' },
];

// Flatten only real menu items (no section dividers)
const ALL_MENU_CODES = MENUS.filter(m => !m.divider).flatMap(m => [m, ...(m.children || [])]);


export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [tab, setTab] = useState('users');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', roleId: '', warehouseId: '', isActive: 1 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [roleForm, setRoleForm] = useState({ roleName: '', description: '', sortOrder: 0 });
  const [roleFilter, setRoleFilter] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [uRes, rRes, wRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/master/warehouses')
      ]);
      if (uRes.status === 'fulfilled') setUsers(uRes.value.data.data || []);
      if (rRes.status === 'fulfilled') setRoles(rRes.value.data.data || []);
      if (wRes.status === 'fulfilled') setWarehouses(wRes.value.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const fetchPermissions = async (roleId) => {
    try {
      const res = await api.get(`/users/permissions/${roleId}`);
      const perms = {};
      ALL_MENU_CODES.forEach(m => {
        const p = res.data.data?.find(p => p.MenuCode === m.code);
        perms[m.code] = p?.CanView ? 1 : 0;
      });
      setPermissions(perms);
    } catch {}
  };

  const openCreate = () => {
    setForm({ username: '', password: '', fullName: '', email: '', roleId: '', warehouseId: '', isActive: 1, sessionDurationHours: '', userLevel: 0 });
    setSelectedUser(null);
    setShowPw(false);
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({ ...user, password: '', roleId: user.RoleID, warehouseId: user.WarehouseID, isActive: user.IsActive, fullName: user.FullName, email: user.Email || '', username: user.Username, sessionDurationHours: user.SessionDurationHours || '', userLevel: user.UserLevel ?? 0 });
    setSelectedUser(user);
    setShowPw(false);
    setModal('edit');
  };

  const openPermissions = async (role) => {
    setSelectedRole(role);
    await fetchPermissions(role.RoleID);
    setModal('permissions');
  };

  const handleSaveUser = async () => {
    setSaving(true);
    try {
      let res;
      if (modal === 'create') { res = await api.post('/users', form); }
      else { res = await api.put(`/users/${selectedUser.UserID}`, form); }
      if (res.data.success) {
        toast.success(res.data.message);
        setModal(null);
        fetchAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm('ต้องการระงับการใช้งานผู้ใช้นี้?')) return;
    try {
      const res = await api.delete(`/users/${userId}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const [expandedMenus, setExpandedMenus] = useState(new Set());
  const [editingRole, setEditingRole] = useState(null);

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ roleName: role.RoleName, description: role.Description || '', sortOrder: role.SortOrder || 0 });
    setModal('role');
  };

  const handleSaveRole = async () => {
    if (!roleForm.roleName.trim()) return toast.error('กรุณาระบุชื่อบทบาท');
    setSaving(true);
    try {
      const res = editingRole
        ? await api.put(`/users/roles/${editingRole.RoleID}`, roleForm)
        : await api.post('/users/roles', roleForm);
      if (res.data.success) {
        toast.success(res.data.message);
        setModal(null);
        setRoleForm({ roleName: '', description: '', sortOrder: 0 });
        setEditingRole(null);
        fetchAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const handleDeleteRole = async (role) => {
    if (!confirm(`ลบบทบาท "${role.RoleName}" ?`)) return;
    try {
      const res = await api.delete(`/users/roles/${role.RoleID}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
    } catch (err) { toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      const v = (m) => permissions[m.code] ? 1 : 0;
      const permsArr = ALL_MENU_CODES.map(m => ({ menuCode: m.code, menuName: m.name, canView: v(m), canCreate: v(m), canEdit: v(m), canDelete: v(m) }));
      const res = await api.post('/users/permissions', { roleId: selectedRole.RoleID, permissions: permsArr });
      if (res.data.success) { toast.success(res.data.message); setModal(null); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const toggleMenuExpand = (code) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const togglePerm = (menuCode, children = []) => {
    const willEnable = !permissions[menuCode];
    setPermissions(prev => {
      const next = { ...prev, [menuCode]: willEnable ? 1 : 0 };
      if (children.length) {
        children.forEach(c => { next[c.code] = willEnable ? 1 : 0; });
      }
      return next;
    });
    if (children.length) {
      setExpandedMenus(prev => {
        const next = new Set(prev);
        if (willEnable) next.add(menuCode);
        else next.delete(menuCode);
        return next;
      });
    }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดข้อมูลผู้ใช้..." />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 items-center">
        <button onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <UsersIcon size={14} className="inline mr-1" />ผู้ใช้งาน ({users.length})
        </button>
        <button onClick={() => setTab('roles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'roles' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Shield size={14} className="inline mr-1" />บทบาท / สิทธิ์
        </button>
        <button onClick={fetchAll}
          className="ml-auto p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
          <RefreshCw size={14} />
        </button>
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="card-header mb-0">ผู้ใช้งานทั้งหมด</h3>
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} />เพิ่มผู้ใช้
            </button>
          </div>
          {/* Role filter dropdown */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs font-semibold whitespace-nowrap" style={{ color: '#64748b' }}>กรองบทบาท</label>
            <select value={roleFilter ?? ''}
              onChange={e => setRoleFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="h-8 px-3 rounded-xl text-xs font-semibold outline-none"
              style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e293b', minWidth: 200 }}>
              <option value="">ทั้งหมด ({users.length})</option>
              {[...roles].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0) || (a.RoleName || '').localeCompare(b.RoleName || '', 'th')).map(r => {
                const count = users.filter(u => u.RoleID === r.RoleID).length;
                return <option key={r.RoleID} value={r.RoleID}>{r.RoleName} ({count})</option>;
              })}
            </select>
            {roleFilter && (
              <button onClick={() => setRoleFilter(null)} className="text-xs font-semibold" style={{ color: '#ef4444' }}>ล้าง</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header text-left px-4 py-2">ชื่อผู้ใช้</th>
                  <th className="table-header text-left px-4 py-2">ชื่อ-นามสกุล</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">บทบาท ↑</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
                  <th className="table-header text-center px-4 py-2">สถานะ</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">เข้าสู่ระบบล่าสุด</th>
                  <th className="table-header px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...users]
                  .filter(u => !roleFilter || u.RoleID === roleFilter)
                  .sort((a, b) => {
                    const lvl = (b.UserLevel ?? 0) - (a.UserLevel ?? 0);
                    if (lvl !== 0) return lvl;
                    const rA = roles.find(r => r.RoleID === a.RoleID);
                    const rB = roles.find(r => r.RoleID === b.RoleID);
                    const so = (rA?.SortOrder || 0) - (rB?.SortOrder || 0);
                    return so !== 0 ? so : (a.FullName || '').localeCompare(b.FullName || '', 'th');
                  })
                  .map(u => (
                  <tr key={u.UserID} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-cell font-mono text-blue-500 max-w-[100px]">
                      <div className="truncate">{u.Username}</div>
                    </td>
                    <td className="table-cell text-slate-900 max-w-[140px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{u.FullName}</span>
                        {(u.UserLevel ?? 0) > 0 && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: '#eff6ff', color: '#2563eb' }}>
                            Lv.{u.UserLevel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell hide-mobile">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs whitespace-nowrap">{u.RoleName}</span>
                    </td>
                    <td className="table-cell hide-mobile">{u.WarehouseName || '-'}</td>
                    <td className="table-cell text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${u.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                        {u.IsActive ? 'ใช้งาน' : 'ระงับ'}
                      </span>
                    </td>
                    <td className="table-cell hide-mobile text-slate-400 text-xs whitespace-nowrap">{formatDateTime(u.LastLogin) || 'ยังไม่เคย'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                          <Edit size={14} />
                        </button>
                        {u.IsActive ? (
                          <button onClick={() => handleDeactivate(u.UserID)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                            <UserX size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <>
        <div className="flex justify-end">
          <button onClick={() => { setRoleForm({ roleName: '', description: '' }); setEditingRole(null); setModal('role'); }}
            className="btn-primary text-sm">
            <Plus size={14} />เพิ่มบทบาท
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <div key={role.RoleID} className="card hover:border-red-300 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-slate-900 font-semibold">{role.RoleName}</h4>
                  <p className="text-slate-500 text-xs mt-0.5">{role.Description}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Shield size={16} className="text-red-400" />
                  <button onClick={() => openEditRole(role)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors"
                    title="แก้ไขบทบาท">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDeleteRole(role)}
                    className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                    title="ลบบทบาท">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-400 mb-3">
                {users.filter(u => u.RoleID === role.RoleID).length} ผู้ใช้
              </div>
              <button onClick={() => openPermissions(role)} className="btn-secondary w-full text-sm py-2">
                <Shield size={13} />กำหนดสิทธิ์
              </button>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Add Role Modal */}
      {modal === 'role' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{editingRole ? 'แก้ไขบทบาท' : 'เพิ่มบทบาทใหม่'}</h3>
              <button onClick={() => { setModal(null); setEditingRole(null); }} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">ชื่อบทบาท *</label>
                <input value={roleForm.roleName} onChange={e => setRoleForm(p => ({ ...p, roleName: e.target.value }))}
                  className="input-field" placeholder="เช่น Supervisor, Driver" />
              </div>
              <div>
                <label className="label">คำอธิบาย</label>
                <input value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))}
                  className="input-field" placeholder="หน้าที่ความรับผิดชอบ..." />
              </div>
              <div>
                <label className="label">ลำดับตำแหน่ง (น้อย = สูงกว่า)</label>
                <input type="number" value={roleForm.sortOrder} onChange={e => setRoleForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="input-field" placeholder="เช่น 1=Admin, 10=หัวหน้า, 50=พนักงาน" min="0" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveRole} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />บันทึก</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {modal === 'create' ? 'เพิ่มผู้ใช้ใหม่' : 'แก้ไขผู้ใช้'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">Username *</label>
                <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="input-field" disabled={modal === 'edit'} />
              </div>
              <div>
                <label className="label">{modal === 'edit' ? 'รหัสผ่านใหม่ (ว่างไว้=ไม่เปลี่ยน)' : 'รหัสผ่าน *'}</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="input-field pr-10" />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">ชื่อ-นามสกุล *</label>
                <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">บทบาท *</label>
                  <select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))} className="input-field">
                    <option value="">-- เลือก --</option>
                    {roles.map(r => <option key={r.RoleID} value={r.RoleID}>{r.RoleName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">คลังสินค้า</label>
                  <select value={form.warehouseId} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">-- ทุกคลัง --</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">เวลา Session (ชม.) — ว่างไว้ = 24 ชม.</label>
                  <input type="number" min="1" max="720" value={form.sessionDurationHours}
                    onChange={e => setForm(p => ({ ...p, sessionDurationHours: e.target.value }))}
                    className="input-field" placeholder="เช่น 1, 8, 24" />
                </div>
                <div>
                  <label className="label">เลเวล (ยิ่งมาก ยิ่งสูง)</label>
                  <input type="number" min="0" value={form.userLevel ?? 0}
                    onChange={e => setForm(p => ({ ...p, userLevel: e.target.value }))}
                    className="input-field" placeholder="0" />
                </div>
              </div>
              {modal === 'edit' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked ? 1 : 0 }))} />
                  <label htmlFor="isActive" className="text-slate-600 text-sm cursor-pointer">เปิดใช้งาน</label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveUser} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />บันทึก</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {modal === 'permissions' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="px-6 pt-6 pb-3 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900 mb-1">กำหนดสิทธิ์: {selectedRole?.RoleName}</h3>
              <p className="text-slate-500 text-sm">{selectedRole?.Description}</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">เมนู</th>
                    <th className="table-header text-center px-3 py-2 w-20">เข้าถึง</th>
                  </tr>
                </thead>
                <tbody>
                  {MENUS.map((menu, idx) => {
                    if (menu.divider) {
                      return (
                        <tr key={`divider-${idx}`}>
                          <td colSpan={2} className="px-3 pt-4 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{menu.section}</span>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <React.Fragment key={menu.code}>
                        <tr className={`border-b border-slate-100 ${permissions[menu.code] ? 'bg-red-50/30' : ''}`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {menu.children?.length ? (
                                <button onClick={() => toggleMenuExpand(menu.code)}
                                  className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0 p-0.5 rounded">
                                  {expandedMenus.has(menu.code)
                                    ? <ChevronDown size={13} />
                                    : <ChevronRight size={13} />}
                                </button>
                              ) : <span className="w-[17px]" />}
                              <span
                                className={`text-sm font-medium text-slate-800 leading-snug ${menu.children?.length ? 'cursor-pointer hover:text-red-500 transition-colors' : ''}`}
                                onClick={() => menu.children?.length && toggleMenuExpand(menu.code)}>
                                {menu.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox"
                              checked={!!permissions[menu.code]}
                              onChange={() => togglePerm(menu.code, menu.children || [])}
                              className="w-4 h-4 cursor-pointer rounded accent-red-600" />
                          </td>
                        </tr>
                        {expandedMenus.has(menu.code) && menu.children?.map(child => (
                          <tr key={child.code} className={`border-b border-slate-50 ${permissions[child.code] ? 'bg-red-50/20' : 'bg-slate-50/40'}`}>
                            <td className="pl-10 pr-3 py-1.5">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="text-slate-300">└</span>
                                <span>{child.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <input type="checkbox"
                                checked={!!permissions[child.code]}
                                onChange={() => togglePerm(child.code)}
                                className="w-3.5 h-3.5 cursor-pointer rounded accent-red-600" />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleSavePermissions} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />บันทึกสิทธิ์</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
