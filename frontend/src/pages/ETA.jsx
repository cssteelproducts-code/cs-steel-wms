import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Truck, Navigation, AlertCircle, Search, MapPin, Clock, Settings, X, Check } from 'lucide-react';
import api from '../services/api';
import { formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import VehicleMap from '../components/VehicleMap';
import { useLang } from '../context/LanguageContext';

export default function ETA() {
  const { t, lang } = useLang();
  const [vehicles, setVehicles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [source, setSource] = useState('');
  const [whitelistConfigured, setWhitelistConfigured] = useState(true);
  const [search, setSearch] = useState('');
  const [statFilter, setStatFilter] = useState(null); // null | 'inRadius' | 'arriving' | 'farAway'
  const [selectedId, setSelectedId] = useState(null);
  const [savingAssign, setSavingAssign] = useState({});

  // Vehicle management modal
  const [showManage, setShowManage] = useState(false);
  const [allVehicles, setAllVehicles] = useState([]);
  const [loadingManage, setLoadingManage] = useState(false);
  const [savingTransport, setSavingTransport] = useState({});

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await api.get('/eta/vehicles');
      if (res.data.success) {
        setVehicles(res.data.data || []);
        setWarehouses(res.data.warehouses || []);
        setSource(res.data.source);
        setWhitelistConfigured(res.data.whitelistConfigured !== false);
        setLastUpdate(new Date());
      }
    } catch {
      toast.error(t('eta.errFetchGps'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 60000);
    return () => clearInterval(interval);
  }, [fetchVehicles]);

  const openManage = async () => {
    setShowManage(true);
    setLoadingManage(true);
    try {
      const res = await api.get('/eta/all-vehicles');
      setAllVehicles(res.data.data || []);
    } catch {
      toast.error(t('eta.errLoadVehicles'));
    } finally {
      setLoadingManage(false);
    }
  };

  const toggleTransport = async (vehicleId, current) => {
    setSavingTransport(p => ({ ...p, [vehicleId]: true }));
    try {
      await api.put(`/eta/vehicles/${vehicleId}/transport`, { isTransport: current ? 0 : 1 });
      setAllVehicles(p => p.map(v => v.VehicleID === vehicleId ? { ...v, IsTransport: current ? 0 : 1 } : v));
    } catch {
      toast.error(t('eta.errSave'));
    } finally {
      setSavingTransport(p => ({ ...p, [vehicleId]: false }));
    }
  };

  const handleAssign = async (vehicleId, warehouseId) => {
    setSavingAssign(p => ({ ...p, [vehicleId]: true }));
    try {
      await api.put(`/eta/assignments/${vehicleId}`, { warehouseId: parseInt(warehouseId) });
      await fetchVehicles();
    } catch {
      toast.error(t('eta.errSaveWarehouse'));
    } finally {
      setSavingAssign(p => ({ ...p, [vehicleId]: false }));
    }
  };

  const arriving = vehicles.filter(v => !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 0 && v.etaMinutes <= 60).length;
  const inRadius = vehicles.filter(v => v.withinRadius).length;
  const farAway = vehicles.filter(v => !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 180).length;

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      v.licensePlate?.toLowerCase().includes(q) ||
      v.warehouseName?.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q);
    let matchStat = true;
    if (statFilter === 'inRadius') matchStat = !!v.withinRadius;
    else if (statFilter === 'arriving') matchStat = !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 0 && v.etaMinutes <= 60;
    else if (statFilter === 'farAway') matchStat = !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 180;
    return matchSearch && matchStat;
  });

  const shortAddress = (addr) => {
    if (!addr) return '';
    const tambon = addr.match(/(?:เธ•เธณเธเธฅ|เนเธเธงเธ)\S+/);
    const amphoe = addr.match(/(?:เธญเธณเน€เธ เธญ|เน€เธเธ•)\S+/);
    const changwat = addr.match(/เธเธฑเธเธซเธงเธฑเธ”\S+/);
    const parts = [tambon?.[0], amphoe?.[0], changwat?.[0]].filter(Boolean);
    return parts.length ? parts.join(' ') : addr;
  };

  const fmtEta = (v) => {
    if (v.withinRadius) return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{t('eta.inWarehouseLabel')}</span>;
    if (v.etaMinutes === null || v.etaMinutes === undefined) return '-';
    if (v.etaMinutes <= 0) return <span className="text-emerald-600 font-bold">{t('eta.arrived')}</span>;
    if (v.etaMinutes < 60) return <span className="font-bold text-amber-600">{v.etaMinutes} {t('unit.minutes')}</span>;
    const h = Math.floor(v.etaMinutes / 60);
    const m = v.etaMinutes % 60;
    return <span className="font-bold text-blue-600">{h} {t('unit.hours')}{m > 0 ? ` ${m} ${t('unit.minutes')}` : ''}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Navigation size={20} className="text-red-600 flex-shrink-0" />
            {t('page.eta')}
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {source === 'mock' && <span className="text-amber-500 mr-1">โ  Mock ยท</span>}
            {lastUpdate ? t('eta.updateTime').replace('{time}', lastUpdate.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US')) : t('common.loading')}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={openManage}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Settings size={13} />
            <span>{t('eta.manageBtn')}</span>
          </button>
          <button onClick={fetchVehicles} disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {source === 'mock' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-sm">
            {t('eta.mockWarning')} โ€” Set <code className="bg-amber-100 px-1 rounded">DTC_API_URL</code> &amp; <code className="bg-amber-100 px-1 rounded">DTC_API_KEY</code>
          </p>
        </div>
      )}

      {!whitelistConfigured && !loading && vehicles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-sm">
            {t('eta.configMsgPrefix')} <button onClick={openManage} className="underline font-semibold">{t('eta.manageBtn')}</button> {t('eta.configMsgSuffix')}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { labelKey: 'eta.allVehicles',  value: vehicles.length, color: 'text-gray-900',  filter: null,        ring: 'ring-gray-400' },
          { labelKey: 'eta.inRadius',     value: inRadius,        color: 'text-red-600',   filter: 'inRadius',  ring: 'ring-red-500'  },
          { labelKey: 'eta.arriving30',   value: arriving,        color: 'text-amber-500', filter: 'arriving',  ring: 'ring-amber-500'},
          { labelKey: 'eta.far2h',        value: farAway,         color: 'text-blue-600',  filter: 'farAway',   ring: 'ring-blue-500' },
        ].map(s => {
          const active = statFilter === s.filter;
          return (
            <div key={s.labelKey}
              onClick={() => setStatFilter(f => f === s.filter ? null : s.filter)}
              className={`card text-center py-3 cursor-pointer transition-all hover:shadow-md select-none ${active ? `ring-2 ${s.ring}` : 'hover:ring-1 hover:ring-slate-300'}`}>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-xs mt-0.5">{t(s.labelKey)}</div>
              {active && <div className="text-[10px] text-slate-400 mt-1">{t('eta.clickAgainCancel')}</div>}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div className="card p-0 overflow-hidden">
        <VehicleMap vehicles={filtered} warehouses={warehouses} selectedId={selectedId} onSelect={setSelectedId} height={420} />
      </div>

      {/* Search below map */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="input-field pl-8 py-2 text-sm w-full"
          placeholder={t('eta.searchPlaceholder')} />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Truck size={15} className="text-red-600" />
            {t('eta.vehicleList')}
            <span className="text-gray-400 font-normal">({filtered.length} {t('unit.vehicles')})</span>
          </span>
          {selectedId && (
            <button onClick={() => setSelectedId(null)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">
              {t('eta.cancelSelect')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">{t('eta.loadingGps')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Truck size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">{t('eta.noVehicles')}</p>
          </div>
        ) : (
          <div>
            {[...filtered].sort((a, b) => {
              if (a.withinRadius !== b.withinRadius) return a.withinRadius ? 1 : -1;
              return (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999);
            }).map(v => {
              const isSelected = v.vehicleId === selectedId;
              return (
                <div key={v.vehicleId}
                  onClick={() => setSelectedId(isSelected ? null : v.vehicleId)}
                  className={`border-b border-gray-50 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{v.licensePlate}</span>
                        {v.distanceKm != null && (
                          <span className="text-xs text-gray-500">{v.distanceKm} {t('unit.km')}</span>
                        )}
                      </div>
                      {v.address && (
                        <div className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 truncate">
                          <MapPin size={9} className="text-gray-300 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{shortAddress(v.address)}</span>
                        </div>
                      )}
                      <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <select
                            value={v.warehouseId || ''}
                            onChange={e => handleAssign(v.vehicleId, e.target.value)}
                            disabled={savingAssign[v.vehicleId]}
                            className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-red-400 appearance-none cursor-pointer max-w-[140px]"
                            style={{ backgroundImage: 'none' }}>
                            <option value="">{t('eta.selectWarehouse')}</option>
                            {warehouses.map(w => (
                              <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>
                            ))}
                          </select>
                          {savingAssign[v.vehicleId] && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div>{fmtEta(v)}</div>
                      {v.lastUpdate && (
                        <div className="text-gray-400 text-xs mt-0.5">{formatDateTime(v.lastUpdate)}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vehicle Management Modal */}
      {showManage && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Truck size={16} className="text-red-600" />
                  {t('eta.manageTitle')}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{t('eta.manageDesc')}</p>
              </div>
              <button onClick={() => { setShowManage(false); fetchVehicles(); }}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {loadingManage ? (
                <div className="py-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
              ) : allVehicles.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">{t('eta.noManageVehicles')}</div>
              ) : (
                allVehicles.map(v => (
                  <div key={v.VehicleID}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all cursor-pointer ${v.IsTransport ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                    onClick={() => !savingTransport[v.VehicleID] && toggleTransport(v.VehicleID, v.IsTransport)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${v.IsTransport ? 'bg-emerald-500' : 'bg-gray-100'}`}>
                        <Truck size={14} className={v.IsTransport ? 'text-white' : 'text-gray-400'} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{v.LicensePlate || v.VehicleID}</p>
                        <p className="text-xs text-gray-400">{v.Label || v.VehicleID}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savingTransport[v.VehicleID] ? (
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                      ) : v.IsTransport ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <Check size={11} />{t('eta.transportTag')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500">
                          {t('eta.hiddenTag')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {allVehicles.filter(v => v.IsTransport).length} {t('eta.footerCount')} {allVehicles.length} {t('eta.footerSuffix')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
