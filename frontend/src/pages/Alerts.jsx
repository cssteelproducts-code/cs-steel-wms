import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, CheckCircle, Settings, CheckCheck, X, Trash2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useLang } from '../context/LanguageContext';

const SEVERITY_STYLE = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-600',
  WARNING: 'bg-amber-50 border-amber-200 text-amber-600',
  INFO: 'bg-blue-50 border-blue-200 text-blue-600'
};

export default function Alerts() {
  const { t } = useLang();
  const [tab, setTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [cfgForm, setCfgForm] = useState({ alertType: 'OVERSTAY', thresholdValue: 240, warehouseId: '', vehicleTypeId: '', isActive: true });

  const TYPE_LABEL_KEYS = {
    OVERSTAY: 'alerts.noteOvStay',
    OVERWEIGHT: 'alerts.noteOvWeight',
    OVERTIME_ENTRY: 'alerts.noteOvEntry',
  };

  const getTypeLabel = (type) => {
    if (TYPE_LABEL_KEYS[type]) return t(TYPE_LABEL_KEYS[type]);
    const base = type.replace(/_M\d+$/, '');
    const m = type.match(/_M(\d+)$/)?.[1];
    const baseLabel = TYPE_LABEL_KEYS[base] ? t(TYPE_LABEL_KEYS[base]) : type;
    return m ? `${baseLabel} (${m})` : baseLabel;
  };

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
    try { const res = await api.get('/alerts/config'); setConfigs(res.data.data || []); } catch {}
  };

  const fetchWarehouses = async () => {
    try { const res = await api.get('/master/warehouses', { silent: true }); setWarehouses(res.data.data || []); } catch {}
  };

  const fetchVehicleTypes = async () => {
    try { const res = await api.get('/master/vehicle-types', { silent: true }); setVehicleTypes(res.data.data || []); } catch {}
  };

  const markRead = async (id) => {
    await api.put(`/alerts/${id}/read`);
    setAlerts(prev => prev.map(a => a.AlertID === id ? { ...a, IsRead: true } : a));
  };

  const resolve = async (id) => {
    await api.put(`/alerts/${id}/resolve`);
    setAlerts(prev => prev.map(a => a.AlertID === id ? { ...a, IsResolved: true, IsRead: true } : a));
    toast.success(t('alerts.resolved'));
  };

  const readAll = async () => {
    await api.put('/alerts/read-all');
    setAlerts(prev => prev.map(a => ({ ...a, IsRead: true })));
    toast.success(t('alerts.readAll'));
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.post('/alerts/config', editingConfig
        ? { ...cfgForm, configId: editingConfig.ConfigID }
        : cfgForm);
      toast.success(t('common.save'));
      setShowAddConfig(false);
      setEditingConfig(null);
      fetchConfigs();
    } catch { toast.error(t('common.noData')); } finally { setSavingConfig(false); }
  };

  const deleteConfig = async (cfg) => {
    if (!confirm(`${t('common.delete')} "${getTypeLabel(cfg.AlertType)}" ?`)) return;
    try {
      await api.delete(`/alerts/config/${cfg.ConfigID}`);
      toast.success(t('common.delete'));
      fetchConfigs();
    } catch { toast.error(t('common.noData')); }
  };

  const startEdit = (cfg) => {
    setEditingConfig(cfg);
    setCfgForm({ alertType: cfg.AlertType, thresholdValue: cfg.ThresholdValue, warehouseId: cfg.WarehouseID || '', vehicleTypeId: cfg.VehicleTypeID || '', isActive: cfg.IsActive });
    setShowAddConfig(true);
  };

  const unread = alerts.filter(a => !a.IsRead && !a.IsResolved).length;
  const active = alerts.filter(a => !a.IsResolved);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('alerts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'alerts' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Bell size={14} />{t('alerts.tabAlerts')} {unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>}
        </button>
        <button onClick={() => setTab('config')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'config' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Settings size={14} />{t('alerts.tabConfig')}
        </button>
      </div>

      {tab === 'alerts' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-red-500" />
              <span className="font-semibold text-slate-900">{t('alerts.allAlerts')}</span>
              <span className="text-slate-500 text-sm">{t('alerts.unresolved').replace('{n}', active.length)}</span>
            </div>
            <div className="flex gap-2">
              {unread > 0 && (
                <button onClick={readAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg font-medium transition-colors hover:bg-slate-50">
                  <CheckCheck size={13} />{t('alerts.readAll')}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400">{t('alerts.loading')}</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400 opacity-50" />
              {t('alerts.empty')}
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
                          {getTypeLabel(alert.AlertType)}
                        </span>
                        {!alert.IsRead && !alert.IsResolved && (
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        )}
                        {alert.IsResolved && (
                          <span className="text-xs text-emerald-500 font-medium">{t('alerts.resolved')}</span>
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
                        <button onClick={() => markRead(alert.AlertID)} title={t('alerts.markRead')}
                          className="p-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors">
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button onClick={() => resolve(alert.AlertID)} title={t('alerts.markResolved')}
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
              <span className="font-semibold text-slate-900">{t('alerts.configTitle')}</span>
            </div>
            <button onClick={() => { setShowAddConfig(true); setEditingConfig(null); setCfgForm({ alertType: 'OVERSTAY', thresholdValue: 240, warehouseId: '', vehicleTypeId: '', isActive: true }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium">
              {t('alerts.addCriteria')}
            </button>
          </div>

          {showAddConfig && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{editingConfig ? t('alerts.editCriteria') : t('alerts.newCriteria')}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('alerts.alertType')}</label>
                  <select value={cfgForm.alertType} onChange={e => setCfgForm(p => ({ ...p, alertType: e.target.value }))}
                    className="input-field" disabled={!!editingConfig}>
                    <option value="OVERSTAY">{t('alerts.noteOvStay')} ({t('unit.minutes')})</option>
                    <option value="OVERWEIGHT">{t('alerts.noteOvWeight')} ({t('unit.kg')})</option>
                    <option value="OVERTIME_ENTRY">{t('alerts.noteOvEntry')}</option>
                  </select>
                </div>
                {cfgForm.alertType !== 'OVERTIME_ENTRY' && (
                  <div>
                    <label className="label">
                      {cfgForm.alertType === 'OVERSTAY' ? t('alerts.thresholdMin') : t('alerts.thresholdKg')}
                    </label>
                    <input type="number" value={cfgForm.thresholdValue}
                      onChange={e => setCfgForm(p => ({ ...p, thresholdValue: e.target.value }))}
                      className="input-field" />
                  </div>
                )}
                {cfgForm.alertType === 'OVERTIME_ENTRY' && (
                  <div className="col-span-1 flex items-center">
                    <p className="text-xs text-slate-500 mt-4">{t('alerts.autoFromVehType')}</p>
                  </div>
                )}
                {cfgForm.alertType === 'OVERSTAY' && (
                  <div>
                    <label className="label">{t('alerts.vehicleTypeFilter')}</label>
                    <select value={cfgForm.vehicleTypeId} onChange={e => setCfgForm(p => ({ ...p, vehicleTypeId: e.target.value }))}
                      className="input-field" disabled={!!editingConfig}>
                      <option value="">{t('alerts.allTypes')}</option>
                      {vehicleTypes.map(vt => <option key={vt.TypeID} value={vt.TypeID}>{vt.TypeName}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">{t('alerts.warehouseFilter')}</label>
                  <select value={cfgForm.warehouseId} onChange={e => setCfgForm(p => ({ ...p, warehouseId: e.target.value }))}
                    className="input-field" disabled={!!editingConfig}>
                    <option value="">{t('alerts.allWarehouses')}</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="cfg-active" checked={cfgForm.isActive}
                    onChange={e => setCfgForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-red-600" />
                  <label htmlFor="cfg-active" className="text-sm text-slate-600">{t('alerts.enabled')}</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveConfig} disabled={savingConfig} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {savingConfig ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {savingConfig ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => { setShowAddConfig(false); setEditingConfig(null); }} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {configs.map(cfg => (
              <div key={cfg.ConfigID} className={`flex items-center justify-between p-3.5 rounded-xl border ${cfg.IsActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div>
                  <div className="text-sm font-medium text-slate-900">{getTypeLabel(cfg.AlertType)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('alerts.threshold')}: <span className="text-red-500 font-semibold">{cfg.ThresholdValue}</span>
                    {cfg.AlertType === 'OVERSTAY' ? ` ${t('unit.minutes')}` : ` ${t('unit.kg')}`}
                    {cfg.VehicleTypeName ? ` · ${cfg.VehicleTypeName}` : cfg.AlertType === 'OVERSTAY' ? ` · ${t('alerts.allVehicleTypes')}` : ''}
                    {cfg.WarehouseName ? ` · ${cfg.WarehouseName}` : ` · ${t('alerts.allWarehouses')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {cfg.IsActive ? t('alerts.statusOn') : t('alerts.statusOff')}
                  </span>
                  <button onClick={() => startEdit(cfg)} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                    <Settings size={14} />
                  </button>
                  <button onClick={() => deleteConfig(cfg)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {configs.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">{t('alerts.noConfig')}</div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 mb-1">{t('alerts.noteTitle')}</div>
            <div>• <b>{t('alerts.noteOvStay')}</b>: {t('alerts.thresholdMin')}</div>
            <div>• <b>{t('alerts.noteOvWeight')}</b>: {t('alerts.thresholdKg')}</div>
            <div>• <b>{t('alerts.noteOvEntry')}</b>: {t('alerts.autoFromVehType')}</div>
            <div>• {t('alerts.autoCheck')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
