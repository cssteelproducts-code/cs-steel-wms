import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, UserX, Shield, Save, X, Trash2, Pencil, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

const MENUS = [
  { code: 'DASHBOARD', name: 'Dashboard' },
  { code: 'TRIP_MONITOR', name: 'Monitor รถ' },
  { code: 'WEIGH_IN', name: 'สถานีชั่งเข้า' },
  { code: 'DATA_STATION', name: 'สถานี Data' },
  { code: 'LOADING_STATION', name: 'สถานีขึ้นสินค้า' },
  { code: 'WEIGH_OUT', name: 'สถานีชั่งออก' },
  { code: 'CHECKER', name: 'เช็คเกอร์' },
  { code: 'ETA', name: 'ETA / GPS' },
  { code: 'USERS', name: 'จัดการผู้ใช้' },
  { code: 'MASTER', name: 'ข้อมูลหลัก' },
  { code: 'REPORTS', name: 'รายงาน' }
];

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
  const [pageLoading, setPageLoading] = useState(true);
  const [roleForm, setRoleForm] = useState({ roleName: '', description: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [uRes, rRes, wRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/master/warehouses')
      ]);
      setUsers(uRes.data.data || []);
      setRoles(rRes.data.data || []);
      setWarehouses(wRes.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const fetchPermissions = async (roleId) => {
    try {
      const res = await api.get(`/users/permissions/${roleId}`);
      const perms = {};
      MENUS.forEach(m => {
        const p = res.data.data?.find(p => p.MenuCode === m.code);
        perms[m.code] = { canView: p?.CanView || 0, canCreate: p?.CanCreate || 0, canEdit: p?.CanEdit || 0, canDelete: p?.CanDelete || 0 };
      });
      setPermissions(perms);
    } catch {}
  };

  const openCreate = () => {
    setForm({ username: '', password: '', fullName: '', email: '', roleId: '', warehouseId: '', isActive: 1 });
    setSelectedUser(null);
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({ ...user, password: '', roleId: user.RoleID, warehouseId: user.WarehouseID, isActive: user.IsActive, fullName: user.FullName, email: user.Email || '', username: user.Username });
    setSelectedUser(user);
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

  const [editingRole, setEditingRole] = useState(null);

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ roleName: role.RoleName, description: role.Description || '' });
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
        setRoleForm({ roleName: '', description: '' });
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
      const permsArr = MENUS.map(m => ({ menuCode: m.code, menuName: m.name, ...permissions[m.code] }));
      const res = await api.post('/users/permissions', { roleId: selectedRole.RoleID, permissions: permsArr });
      if (res.data.success) { toast.success(res.data.message); setModal(null); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const togglePerm = (menuCode, action) => {
    setPermissions(p => ({
      ...p,
      [menuCode]: { ...p[menuCode], [action]: p[menuCode]?.[action] ? 0 : 1 }
    }));
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">ผู้ใช้งานทั้งหมด</h3>
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} />เพิ่มผู้ใช้
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header text-left px-4 py-2">ชื่อผู้ใช้</th>
                  <th className="table-header text-left px-4 py-2">ชื่อ-นามสกุล</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">บทบาท</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
                  <th className="table-header text-center px-4 py-2">สถานะ</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">เข้าสู่ระบบล่าสุด</th>
                  <th className="table-header px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.UserID} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-cell font-mono text-blue-500">{u.Username}</td>
                    <td className="table-cell text-slate-900">{u.FullName}</td>
                    <td className="table-cell hide-mobile">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{u.RoleName}</span>
                    </td>
                    <td className="table-cell hide-mobile">{u.WarehouseName || '-'}</td>
                    <td className="table-cell text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                        {u.IsActive ? 'ใช้งาน' : 'ระงับ'}
                      </span>
                    </td>
                    <td className="table-cell hide-mobile text-slate-400 text-xs">{formatDateTime(u.LastLogin) || 'ยังไม่เคย'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-field" />
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 my-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">กำหนดสิทธิ์: {selectedRole?.RoleName}</h3>
            <p className="text-slate-500 text-sm mb-4">{selectedRole?.Description}</p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">เมนู</th>
                    <th className="table-header text-center px-3 py-2">ดู</th>
                    <th className="table-header text-center px-3 py-2">สร้าง</th>
                    <th className="table-header text-center px-3 py-2">แก้ไข</th>
                    <th className="table-header text-center px-3 py-2">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {MENUS.map(menu => (
                    <tr key={menu.code} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-sm text-slate-700">{menu.name}</td>
                      {['canView', 'canCreate', 'canEdit', 'canDelete'].map(action => (
                        <td key={action} className="px-3 py-2 text-center">
                          <input type="checkbox"
                            checked={!!permissions[menu.code]?.[action]}
                            onChange={() => togglePerm(menu.code, action)}
                            className="w-4 h-4 cursor-pointer rounded accent-red-600" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-6">
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
