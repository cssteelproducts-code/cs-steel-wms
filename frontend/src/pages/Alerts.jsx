import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, CheckCircle, Settings, RefreshCw, CheckCheck, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const SEVERITY_STYLE = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-600',
  WARNING: 'bg-amber-50 border-amber-200 text-amber-600',
  INFO: 'bg-blue-50 border-blue-200 text-blue-600'
};

const TYPE_LABEL = {
  OVERSTAY: 'รถอยู่นานเกิน',
  OVERWEIGHT: 'น้ำหนักเกินพิกัด'
};

export default function Alerts() {
  const [tab, setTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [cfgForm, setCfgForm] = useState({ alertType: 'OVERSTAY', thresholdValue: 240, warehouseId: '', vehicleTypeId: '', isActive: true });

  useEffect(() => {
    fetchAlerts();
    fetchConfigs();
    fetchWarehouses();
    fetchVehicleTypes();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/alerts?limit=200');
      setAlerts(res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/alerts/config');
      setConfigs(res.data.data || []);
    } catch {}
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/master/warehouses');
      setWarehouses(res.data.data || []);
    } catch {}
  };

  const fetchVehicleTypes = async () => {
    try {
      const res = await api.get('/master/vehicle-types');
      setVehicleTypes(res.data.data || []);
    } catch {}
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await api.post('/alerts/check');
      toast.success(`ตรวจสอบเสร็จ: พบการแจ้งเตือนใหม่ ${res.data.newAlerts} รายการ`);
      fetchAlerts();
    } catch { toast.error('ตรวจสอบไม่สำเร็จ'); } finally { setChecking(false); }
  };

  const markRead = async (id) => {
    await api.put(`/alerts/${id}/read`);
    setAlerts(prev => prev.map(a => a.AlertID === id ? { ...a, IsRead: true } : a));
  };

  const resolve = async (id) => {
    await api.put(`/alerts/${id}/resolve`);
    setAlerts(prev => prev.map(a => a.AlertID === id ? { ...a, IsResolved: true, IsRead: true } : a));
    toast.success('แก้ไขแล้ว');
  };

  const readAll = async () => {
    await api.put('/alerts/read-all');
    setAlerts(prev => prev.map(a => ({ ...a, IsRead: true })));
    toast.success('อ่านทั้งหมดแล้ว');
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.post('/alerts/config', editingConfig
        ? { ...cfgForm, configId: editingConfig.ConfigID }
        : cfgForm);
      toast.success('บันทึกการตั้งค่าแล้ว');
      setShowAddConfig(false);
      setEditingConfig(null);
      fetchConfigs();
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSavingConfig(false); }
  };

  const startEdit = (cfg) => {
    setEditingConfig(cfg);
    setCfgForm({ alertType: cfg.AlertType, thresholdValue: cfg.ThresholdValue, warehouseId: cfg.WarehouseID || '', vehicleTypeId: cfg.VehicleTypeID || '', isActive: cfg.IsActive });
    setShowAddConfig(true);
  };

  const unread = alerts.filter(a => !a.IsRead && !a.IsResolved).length;
  const active = alerts.filter(a => !a.IsResolved);
  const resolved = alerts.filter(a => a.IsResolved);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('alerts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'alerts' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Bell size={14} />การแจ้งเตือน {unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>}
        </button>
        <button onClick={() => setTab('config')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'config' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Settings size={14} />ตั้งค่าเกณฑ์
        </button>
      </div>

      {tab === 'alerts' && (
        <div className="card space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-red-500" />
              <span className="font-semibold text-slate-900">การแจ้งเตือนทั้งหมด</span>
              <span className="text-slate-500 text-sm">({active.length} ที่ยังไม่แก้ไข)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={runCheck} disabled={checking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50">
                <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                {checking ? 'กำลังตรวจ...' : 'ตรวจสอบตอนนี้'}
              </button>
              {unread > 0 && (
                <button onClick={readAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg font-medium transition-colors hover:bg-slate-50">
                  <CheckCheck size={13} />อ่านทั้งหมด
                </button>
              )}
              <button onClick={fetchAlerts}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400 opacity-50" />
              ไม่มีการแจ้งเตือน
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.AlertID}
                  className={`border rounded-xl p-3.5 flex items-start justify-between gap-3 transition-opacity ${SEVERITY_STYLE[alert.Severity] || SEVERITY_STYLE.WARNING} ${alert.IsResolved ? 'opacity-40' : ''} ${!alert.IsRead && !alert.IsResolved ? 'ring-1 ring-amber-300' : ''}`}>
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">
                      {alert.Severity === 'CRITICAL' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          {TYPE_LABEL[alert.AlertType] || alert.AlertType}
                        </span>
                        {!alert.IsRead && !alert.IsResolved && (
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        )}
                        {alert.IsResolved && (
                          <span className="text-xs text-emerald-500 font-medium">✓ แก้ไขแล้ว</span>
                        )}
                      </div>
                      <div className="text-sm font-medium mt-0.5 text-slate-900">{alert.Message}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {alert.WarehouseName && `${alert.WarehouseName} · `}
                        {dayjs(alert.CreatedAt).format('DD/MM/YY HH:mm')}
                      </div>
                    </div>
                  </div>
                  {!alert.IsResolved && (
                    <div className="flex gap-1 flex-shrink-0">
                      {!alert.IsRead && (
                        <button onClick={() => markRead(alert.AlertID)} title="อ่านแล้ว"
                          className="p-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors">
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button onClick={() => resolve(alert.AlertID)} title="แก้ไขแล้ว"
                        className="p-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-red-500" />
              <span className="font-semibold text-slate-900">ตั้งค่าเกณฑ์การแจ้งเตือน</span>
            </div>
            <button onClick={() => { setShowAddConfig(true); setEditingConfig(null); setCfgForm({ alertType: 'OVERSTAY', thresholdValue: 240, warehouseId: '', vehicleTypeId: '', isActive: true }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium">
              + เพิ่มเกณฑ์
            </button>
          </div>

          {showAddConfig && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{editingConfig ? 'แก้ไขเกณฑ์' : 'เพิ่มเกณฑ์ใหม่'}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ประเภทการแจ้งเตือน</label>
                  <select value={cfgForm.alertType} onChange={e => setCfgForm(p => ({ ...p, alertType: e.target.value }))}
                    className="input-field" disabled={!!editingConfig}>
                    <option value="OVERSTAY">รถอยู่นานเกิน (นาที)</option>
                    <option value="OVERWEIGHT">น้ำหนักเกินพิกัด (กก.)</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    {cfgForm.alertType === 'OVERSTAY' ? 'เกณฑ์ (นาที)' : 'เกณฑ์ (กิโลกรัม)'}
                  </label>
                  <input type="number" value={cfgForm.thresholdValue}
                    onChange={e => setCfgForm(p => ({ ...p, thresholdValue: e.target.value }))}
                    className="input-field" />
                </div>
                {cfgForm.alertType === 'OVERSTAY' && (
                  <div>
                    <label className="label">ประเภทรถ (ว่าง = ทุกประเภท)</label>
                    <select value={cfgForm.vehicleTypeId} onChange={e => setCfgForm(p => ({ ...p, vehicleTypeId: e.target.value }))}
                      className="input-field" disabled={!!editingConfig}>
                      <option value="">ทุกประเภท</option>
                      {vehicleTypes.map(vt => <option key={vt.TypeID} value={vt.TypeID}>{vt.TypeName}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">คลังสินค้า (ว่าง = ทุกคลัง)</label>
                  <select value={cfgForm.warehouseId} onChange={e => setCfgForm(p => ({ ...p, warehouseId: e.target.value }))}
                    className="input-field" disabled={!!editingConfig}>
                    <option value="">ทุกคลัง</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="cfg-active" checked={cfgForm.isActive}
                    onChange={e => setCfgForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-red-600" />
                  <label htmlFor="cfg-active" className="text-sm text-slate-600">เปิดใช้งาน</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveConfig} disabled={savingConfig} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {savingConfig ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {savingConfig ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => { setShowAddConfig(false); setEditingConfig(null); }} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {configs.map(cfg => (
              <div key={cfg.ConfigID} className={`flex items-center justify-between p-3.5 rounded-xl border ${cfg.IsActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div>
                  <div className="text-sm font-medium text-slate-900">{TYPE_LABEL[cfg.AlertType] || cfg.AlertType}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    เกณฑ์: <span className="text-red-500 font-semibold">{cfg.ThresholdValue}</span>
                    {cfg.AlertType === 'OVERSTAY' ? ' นาที' : ' กก.'}
                    {cfg.VehicleTypeName ? ` · ${cfg.VehicleTypeName}` : cfg.AlertType === 'OVERSTAY' ? ' · ทุกประเภทรถ' : ''}
                    {cfg.WarehouseName ? ` · ${cfg.WarehouseName}` : ' · ทุกคลัง'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {cfg.IsActive ? 'เปิด' : 'ปิด'}
                  </span>
                  <button onClick={() => startEdit(cfg)} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                    <Settings size={14} />
                  </button>
                </div>
              </div>
            ))}
            {configs.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">ยังไม่มีการตั้งค่า</div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 mb-1">หมายเหตุ</div>
            <div>• <b>รถอยู่นานเกิน</b>: ระบบจะแจ้งเตือนเมื่อรถที่ยังอยู่ในคลังเกินเวลาที่กำหนด (หน่วย: นาที)</div>
            <div>• <b>น้ำหนักเกินพิกัด</b>: แจ้งเตือนเมื่อน้ำหนักสุทธิของรถที่ชั่งออกเกินค่าที่กำหนด (หน่วย: กิโลกรัม)</div>
            <div>• กด "ตรวจสอบตอนนี้" หรือระบบจะตรวจอัตโนมัติทุก 30 วินาที</div>
          </div>
        </div>
      )}
    </div>
  );
}
