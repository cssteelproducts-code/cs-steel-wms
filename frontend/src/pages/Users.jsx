import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, UserX, Shield, Save, X, Trash2, Pencil, RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLang } from '../context/LanguageContext';

const MENUS = [
  { code: 'DASHBOARD', nameKey: 'nav.dashboard' },
  { code: 'TRIP_MONITOR', nameKey: 'nav.monitor' },
  { code: 'FORECAST', nameKey: 'nav.forecast' },
  { divider: true, sectionKey: 'section.station' },
  { code: 'WEIGH_IN', nameKey: 'nav.weighIn' },
  { code: 'DATA_STATION', nameKey: 'nav.dataStation' },
  { code: 'LOADING_STATION', nameKey: 'nav.loadingStation' },
  { code: 'WEIGH_OUT', nameKey: 'nav.weighOut' },
  { code: 'CHECKER', nameKey: 'nav.checker' },
  { code: 'RECORDS', nameKey: 'nav.records' },
  { divider: true, sectionKey: 'section.warehouse' },
  { code: 'STOCK', nameKey: 'nav.locationCheck' },
  { code: 'TRANSFER', nameKey: 'nav.transfer', children: [
    { code: 'TRANSFER_JOBS', nameKey: 'transfer.tabJobs' },
    { code: 'TRANSFER_STATIONS', nameKey: 'transfer.tabStations' },
    { code: 'TRANSFER_VEHICLES', nameKey: 'transfer.tabVehicles' },
    { code: 'TRANSFER_REPORTS', nameKey: 'transfer.tabReport' },
  ]},
  { code: 'TRANSFER_DRIVER', nameKey: 'nav.transferDriver' },
  { code: 'STOCKCOUNT_OFFICE', nameKey: 'nav.stockCount', children: [
    { code: 'STOCKCOUNT_FIELD', nameKey: 'stockCount.fieldTab' },
  ]},
  { divider: true, sectionKey: 'section.logistics' },
  { code: 'ETA', nameKey: 'nav.eta' },
  { code: 'TMS',           nameKey: 'nav.tms' },
  { code: 'DELIVERY_PLAN', nameKey: 'nav.delivery' },
  { divider: true, sectionKey: 'section.system' },
  { code: 'ALERTS', nameKey: 'nav.alerts' },
  { code: 'USERS', nameKey: 'nav.users' },
  { code: 'MASTER', nameKey: 'nav.master' },
  { divider: true, sectionKey: 'section.tools' },
  { code: 'SHIFT_PLANNING', nameKey: 'nav.shiftPlanning' },
  { code: 'FREIGHT_CALC', nameKey: 'nav.freightCalc' },
];

const ALL_MENU_CODES = MENUS.filter(m => !m.divider).flatMap(m => [m, ...(m.children || [])]);

export default function Users() {
  const { t } = useLang();
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
  const [expandedMenus, setExpandedMenus] = useState(new Set());
  const [editingRole, setEditingRole] = useState(null);

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
      if (res.data.success) { toast.success(res.data.message); setModal(null); fetchAll(); }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm(t('users.deactivateConfirm'))) return;
    try {
      const res = await api.delete(`/users/${userId}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
    } catch (err) { toast.error(err.response?.data?.message || t('common.noData')); }
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ roleName: role.RoleName, description: role.Description || '', sortOrder: role.SortOrder || 0 });
    setModal('role');
  };

  const handleSaveRole = async () => {
    if (!roleForm.roleName.trim()) return toast.error(t('users.roleNameLabel'));
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
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setSaving(false); }
  };

  const handleDeleteRole = async (role) => {
    if (!confirm(`${t('common.delete')} "${role.RoleName}" ?`)) return;
    try {
      const res = await api.delete(`/users/roles/${role.RoleID}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
    } catch (err) { toast.error(err.response?.data?.message || t('common.noData')); }
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      const v = (m) => permissions[m.code] ? 1 : 0;
      const permsArr = ALL_MENU_CODES.map(m => ({ menuCode: m.code, menuName: t(m.nameKey), canView: v(m), canCreate: v(m), canEdit: v(m), canDelete: v(m) }));
      const res = await api.post('/users/permissions', { roleId: selectedRole.RoleID, permissions: permsArr });
      if (res.data.success) { toast.success(res.data.message); setModal(null); }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
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
      if (children.length) children.forEach(c => { next[c.code] = willEnable ? 1 : 0; });
      return next;
    });
    if (children.length) {
      setExpandedMenus(prev => {
        const next = new Set(prev);
        if (willEnable) next.add(menuCode); else next.delete(menuCode);
        return next;
      });
    }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
          <button onClick={() => setTab('users')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <UsersIcon size={14} />{t('users.usersTab')} ({users.length})
          </button>
          <button onClick={() => setTab('roles')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'roles' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Shield size={14} />{t('users.rolesTab')}
          </button>
        </div>
        <button onClick={fetchAll}
          className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
          <RefreshCw size={14} />
        </button>
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="card-header mb-0">{t('users.allUsers')}</h3>
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} />{t('users.addUser')}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs font-semibold whitespace-nowrap" style={{ color: '#64748b' }}>{t('common.role')}</label>
            <select value={roleFilter ?? ''}
              onChange={e => setRoleFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="h-8 px-3 rounded-xl text-xs font-semibold outline-none"
              style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e293b', minWidth: 200 }}>
              <option value="">{t('common.total')} ({users.length})</option>
              {[...roles].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0) || (a.RoleName || '').localeCompare(b.RoleName || '', 'th')).map(r => {
                const count = users.filter(u => u.RoleID === r.RoleID).length;
                return <option key={r.RoleID} value={r.RoleID}>{r.RoleName} ({count})</option>;
              })}
            </select>
            {roleFilter && (
              <button onClick={() => setRoleFilter(null)} className="text-xs font-semibold" style={{ color: '#ef4444' }}>{t('common.clearForm')}</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header text-left px-4 py-2">{t('users.username')}</th>
                  <th className="table-header text-left px-4 py-2">{t('users.fullName')}</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">{t('users.roleLabel')}</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">{t('common.warehouse')}</th>
                  <th className="table-header text-center px-4 py-2">{t('common.status')}</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">{t('users.lastLogin')}</th>
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
                        {u.IsActive ? t('users.activeStatus') : t('users.suspendedStatus')}
                      </span>
                    </td>
                    <td className="table-cell hide-mobile text-slate-400 text-xs whitespace-nowrap">
                      {formatDateTime(u.LastLogin) || t('users.neverLoggedIn')}
                    </td>
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
            <Plus size={14} />{t('users.addRole')}
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
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDeleteRole(role)}
                    className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-400 mb-3">
                {users.filter(u => u.RoleID === role.RoleID).length} {t('users.userCount')}
              </div>
              <button onClick={() => openPermissions(role)} className="btn-secondary w-full text-sm py-2">
                <Shield size={13} />{t('users.setPermissions')}
              </button>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Role Modal */}
      {modal === 'role' && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{editingRole ? t('users.editRole') : t('users.newRole')}</h3>
              <button onClick={() => { setModal(null); setEditingRole(null); }} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('users.roleNameLabel')}</label>
                <input value={roleForm.roleName} onChange={e => setRoleForm(p => ({ ...p, roleName: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">{t('users.descriptionLabel')}</label>
                <input value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))}
                  className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveRole} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />{t('common.save')}</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {modal === 'create' ? t('users.newUser') : t('users.editUser')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">{t('users.username')}</label>
                <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="input-field" disabled={modal === 'edit'} />
              </div>
              <div>
                <label className="label">{modal === 'edit' ? t('users.newPassword') : t('users.password')}</label>
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
                <label className="label">{t('users.fullName')}</label>
                <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">{t('users.email')}</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('users.roleLabel')}</label>
                  <select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))} className="input-field">
                    <option value="">-- {t('common.select')} --</option>
                    {roles.map(r => <option key={r.RoleID} value={r.RoleID}>{r.RoleName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('users.warehouseLabel')}</label>
                  <select value={form.warehouseId} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">{t('users.allWarehouses')}</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
              </div>
              {modal === 'edit' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked ? 1 : 0 }))} />
                  <label htmlFor="isActive" className="text-slate-600 text-sm cursor-pointer">{t('users.enabledLabel')}</label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveUser} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />{t('common.save')}</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {modal === 'permissions' && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl flex flex-col" style={{ maxHeight: 'calc(92vh - 5rem)' }}>
            <div className="px-6 pt-6 pb-3 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t('users.permissionsTitle')} {selectedRole?.RoleName}</h3>
              <p className="text-slate-500 text-sm">{selectedRole?.Description}</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">{t('users.menu')}</th>
                    <th className="table-header text-center px-3 py-2 w-20">{t('users.view')}</th>
                  </tr>
                </thead>
                <tbody>
                  {MENUS.map((menu, idx) => {
                    if (menu.divider) {
                      return (
                        <tr key={`divider-${idx}`}>
                          <td colSpan={2} className="px-3 pt-4 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t(menu.sectionKey)}</span>
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
                                  {expandedMenus.has(menu.code) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              ) : <span className="w-[17px]" />}
                              <span
                                className={`text-sm font-medium text-slate-800 leading-snug ${menu.children?.length ? 'cursor-pointer hover:text-red-500 transition-colors' : ''}`}
                                onClick={() => menu.children?.length && toggleMenuExpand(menu.code)}>
                                {t(menu.nameKey)}
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
                                <span>{t(child.nameKey)}</span>
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
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />{t('users.savePermissions')}</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
