import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Truck, Navigation, AlertCircle, Search, MapPin, Clock, Settings, X, Check } from 'lucide-react';
import api from '../services/api';
import { formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import VehicleMap from '../components/VehicleMap';
import { useLang } from '../context/LanguageContext';

export default function ETA() {
  const { t } = useLang();
  const [vehicles, setVehicles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [source, setSource] = useState('');
  const [whitelistConfigured, setWhitelistConfigured] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      toast.error('ไม่สามารถดึงข้อมูล GPS ได้');
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.error('โหลดรายชื่อรถไม่สำเร็จ');
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
      toast.error('บันทึกไม่สำเร็จ');
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
      toast.error('บันทึกคลังประจำไม่สำเร็จ');
    } finally {
      setSavingAssign(p => ({ ...p, [vehicleId]: false }));
    }
  };

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      v.licensePlate?.toLowerCase().includes(q) ||
      v.warehouseName?.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const arriving = vehicles.filter(v => !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 0 && v.etaMinutes <= 30).length;
  const inRadius = vehicles.filter(v => v.withinRadius).length;
  const farAway = vehicles.filter(v => !v.withinRadius && v.etaMinutes !== null && v.etaMinutes > 120).length;

  const shortAddress = (addr) => {
    if (!addr) return '';
    const tambon = addr.match(/(?:ตำบล|แขวง)\S+/);
    const amphoe = addr.match(/(?:อำเภอ|เขต)\S+/);
    const changwat = addr.match(/จังหวัด\S+/);
    const parts = [tambon?.[0], amphoe?.[0], changwat?.[0]].filter(Boolean);
    return parts.length ? parts.join(' ') : addr;
  };

  const fmtEta = (v) => {
    if (v.withinRadius) return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />อยู่ภายในคลัง</span>;
    if (v.etaMinutes === null || v.etaMinutes === undefined) return '-';
    if (v.etaMinutes <= 0) return <span className="text-emerald-600 font-bold text-xs">ถึงแล้ว</span>;
    if (v.etaMinutes < 60) return <span className="font-bold text-amber-600 text-xs">{v.etaMinutes} นาที</span>;
    const h = Math.floor(v.etaMinutes / 60);
    const m = v.etaMinutes % 60;
    return <span className="font-bold text-blue-600 text-xs">{h}ชม. {m > 0 ? `${m}น.` : ''}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Navigation size={22} className="text-red-600" />
            {t('page.eta')}
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {source === 'mock' && <span className="text-amber-500 mr-1">⚠ Mock Data ·</span>}
            {lastUpdate ? `อัพเดต ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
            {' · ระยะทางจริง (OSRM) · ความเร็วสูงสุด 90 กม./ชม.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openManage}
            className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
            <Settings size={14} />
            จัดการรถขนส่ง
          </button>
          <button onClick={fetchVehicles} disabled={loading}
            className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {source === 'mock' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-sm">
            กำลังแสดงข้อมูลจำลอง — ตั้งค่า <code className="bg-amber-100 px-1 rounded">DTC_API_URL</code> และ <code className="bg-amber-100 px-1 rounded">DTC_API_KEY</code>
          </p>
        </div>
      )}

      {!whitelistConfigured && !loading && vehicles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-sm">
            แสดงรถทั้งหมด — กด <button onClick={openManage} className="underline font-semibold">จัดการรถขนส่ง</button> เพื่อเลือกเฉพาะรถขนส่ง
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'รถทั้งหมด',          value: vehicles.length, color: 'text-gray-900' },
          { label: 'อยู่ภายในคลัง',      value: inRadius,        color: 'text-red-600' },
          { label: 'ใกล้ถึง 30 นาที',    value: arriving,        color: 'text-amber-500' },
          { label: 'ห่างจากคลัง 2 ชม.+', value: farAway,         color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-8 py-1.5 text-sm w-full"
              placeholder="ค้นหาทะเบียน / คลัง..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="input-field py-1.5 text-sm min-w-[130px]">
            <option value="all">ทุกสถานะ</option>
            <option value="Moving">กำลังเดินทาง</option>
            <option value="Stopped">จอดอยู่</option>
          </select>
        </div>
        <VehicleMap vehicles={filtered} warehouses={warehouses} selectedId={selectedId} onSelect={setSelectedId} height={420} />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Truck size={15} className="text-red-600" />
            รายการรถ
            <span className="text-gray-400 font-normal">({filtered.length} คัน)</span>
          </span>
          {selectedId && (
            <button onClick={() => setSelectedId(null)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">
              ยกเลิกเลือก ×
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล GPS...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Truck size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">ไม่พบข้อมูลรถ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">ทะเบียน</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5">ที่อยู่ปัจจุบัน</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">คลังประจำ</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">ระยะห่างคลัง</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Clock size={11} />ETA ถึงคลัง</span>
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">อัพเดต</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999)).map(v => {
                  const isMoving = v.status === 'Moving';
                  const isSelected = v.vehicleId === selectedId;
                  return (
                    <tr key={v.vehicleId}
                      onClick={() => setSelectedId(isSelected ? null : v.vehicleId)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}>

                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{v.licensePlate}</td>

                      <td className="px-4 py-3 max-w-[220px]">
                        {v.address ? (
                          <span className="text-gray-500 text-xs flex items-start gap-1">
                            <MapPin size={10} className="text-gray-300 mt-0.5 flex-shrink-0" />
                            <span>{shortAddress(v.address)}</span>
                          </span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <select
                            value={v.warehouseId || ''}
                            onChange={e => handleAssign(v.vehicleId, e.target.value)}
                            disabled={savingAssign[v.vehicleId]}
                            className="text-xs rounded-xl border border-gray-200 px-2 py-1 pr-6 bg-white text-gray-700 focus:outline-none focus:border-red-400 appearance-none cursor-pointer max-w-[130px]"
                            style={{ backgroundImage: 'none' }}>
                            <option value="">-- เลือกคลัง --</option>
                            {warehouses.map(w => (
                              <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>
                            ))}
                          </select>
                          {savingAssign[v.vehicleId] && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {v.distanceKm != null ? (
                          <span className="font-semibold text-gray-800">{v.distanceKm} <span className="text-gray-400 font-normal text-xs">กม.</span></span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">{fmtEta(v)}</td>

                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {v.lastUpdate ? formatDateTime(v.lastUpdate) : '-'}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isMoving ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          {isMoving ? 'เคลื่อนที่' : 'จอด'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vehicle Management Modal */}
      {showManage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Truck size={16} className="text-red-600" />
                  จัดการรถขนส่ง
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">เลือกรถที่เป็นรถขนส่งเพื่อแสดงในหน้า ETA</p>
              </div>
              <button onClick={() => { setShowManage(false); fetchVehicles(); }}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {loadingManage ? (
                <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : allVehicles.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลรถ — รีเฟรชหน้า ETA ก่อน</div>
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
                          <Check size={11} />รถขนส่ง
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500">
                          ไม่แสดง
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {allVehicles.filter(v => v.IsTransport).length} จาก {allVehicles.length} คัน ที่เป็นรถขนส่ง
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
