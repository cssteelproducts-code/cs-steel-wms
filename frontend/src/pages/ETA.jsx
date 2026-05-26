import { useState, useEffect } from 'react';
import { MapPin, RefreshCw, Truck, Clock, Navigation, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { getEtaStatus, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const SpeedIndicator = ({ speed }) => {
  const color = speed === 0 ? 'text-red-400' : speed < 40 ? 'text-amber-400' : 'text-emerald-400';
  return <span className={`font-bold ${color}`}>{speed} <span className="text-xs font-normal">กม./ชม.</span></span>;
};

export default function ETA() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [groupByWarehouse, setGroupByWarehouse] = useState(true);

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/eta/vehicles');
      if (res.data.success) {
        setVehicles(res.data.data || []);
        setSource(res.data.source);
        setLastUpdate(new Date());
      }
    } catch (err) {
      toast.error('ไม่สามารถดึงข้อมูล GPS ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const filtered = vehicles.filter(v =>
    v.licensePlate?.includes(search.toUpperCase()) ||
    v.driverName?.includes(search) ||
    v.warehouseName?.includes(search)
  );

  const warehouses = [...new Set(filtered.map(v => v.warehouseName || 'ไม่ระบุคลัง'))];

  const VehicleCard = ({ v }) => {
    const etaStatus = getEtaStatus(v.etaMinutes);
    return (
      <div className="card hover:border-blue-500/30 transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Truck size={16} className="text-blue-400 flex-shrink-0" />
              <span className="text-white font-bold text-lg">{v.licensePlate}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${v.status === 'Moving'
                ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                : 'bg-steel-700 text-steel-400 border-steel-600'}`}>
                {v.status === 'Moving' ? '🟢 กำลังเคลื่อนที่' : '🔴 จอดอยู่'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {v.driverName && (
                <div><span className="text-steel-500">คนขับ:</span> <span className="text-steel-300">{v.driverName}</span></div>
              )}
              <div><span className="text-steel-500">คลัง:</span> <span className="text-blue-400">{v.warehouseName || '-'}</span></div>
              <div><span className="text-steel-500">ความเร็ว:</span> <SpeedIndicator speed={v.speed || 0} /></div>
              {v.distanceKm && (
                <div><span className="text-steel-500">ระยะห่างคลัง:</span> <span className="text-white font-medium">{v.distanceKm} กม.</span></div>
              )}
              {v.address && (
                <div className="col-span-2 flex items-start gap-1">
                  <MapPin size={12} className="text-steel-500 mt-0.5 flex-shrink-0" />
                  <span className="text-steel-400 text-xs">{v.address}</span>
                </div>
              )}
              {v.lastUpdate && (
                <div className="col-span-2 text-xs text-steel-600">
                  อัพเดต: {formatDateTime(v.lastUpdate)}
                </div>
              )}
            </div>
          </div>

          {/* ETA */}
          <div className="text-right flex-shrink-0">
            <div className="bg-steel-700 rounded-xl p-3 text-center min-w-[90px]">
              <Clock size={14} className="mx-auto text-steel-400 mb-1" />
              <div className="text-xs text-steel-400 mb-1">ETA ถึงคลัง</div>
              {v.etaMinutes !== null ? (
                <>
                  <div className={`text-xl font-bold ${etaStatus.color}`}>{etaStatus.label}</div>
                  {v.etaTime && (
                    <div className="text-xs text-steel-500 mt-1">
                      ~{new Date(v.etaTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-steel-500 text-sm">ไม่ทราบ</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Navigation size={24} className="text-blue-400" />
            ETA / ติดตาม GPS รถ
          </h2>
          <p className="text-steel-400 text-sm mt-1">
            {source === 'mock' && <span className="text-amber-400 mr-2">⚠ Mock Data</span>}
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : ''} — อัพเดตทุก 1 นาที
          </p>
        </div>
        <button onClick={fetchVehicles} disabled={loading} className="btn-secondary text-sm px-4 py-2 self-start">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />รีเฟรช
        </button>
      </div>

      {/* DTC API notice if mock */}
      {source === 'mock' && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium">กำลังแสดงข้อมูลจำลอง (Mock Data)</p>
            <p className="text-amber-400/70 text-sm mt-1">
              กรุณาตั้งค่า DTC_API_URL และ DTC_API_KEY ใน Environment Variables เพื่อเชื่อมต่อ GPS จริง
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-white">{vehicles.length}</div>
          <div className="text-steel-400 text-sm mt-1">รถทั้งหมด</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-emerald-400">
            {vehicles.filter(v => v.status === 'Moving').length}
          </div>
          <div className="text-steel-400 text-sm mt-1">กำลังเดินทาง</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-amber-400">
            {vehicles.filter(v => v.etaMinutes !== null && v.etaMinutes <= 30).length}
          </div>
          <div className="text-steel-400 text-sm mt-1">ถึงคลังใน 30 นาที</div>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="input-field flex-1" placeholder="ค้นหาทะเบียน / คนขับ / คลัง..." />
        <label className="flex items-center gap-2 text-steel-300 text-sm cursor-pointer">
          <input type="checkbox" checked={groupByWarehouse} onChange={e => setGroupByWarehouse(e.target.checked)}
            className="rounded" />
          จัดกลุ่มตามคลัง
        </label>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="text-center py-16 text-steel-500">กำลังโหลดข้อมูล GPS...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-steel-500">
          <Truck size={48} className="mx-auto mb-3 opacity-30" />
          ไม่พบรถ
        </div>
      ) : groupByWarehouse ? (
        warehouses.map(warehouse => (
          <div key={warehouse}>
            <h3 className="text-steel-300 font-medium mb-3 flex items-center gap-2">
              <MapPin size={14} className="text-blue-400" />
              {warehouse}
              <span className="text-steel-500 text-xs">
                ({filtered.filter(v => (v.warehouseName || 'ไม่ระบุคลัง') === warehouse).length} คัน)
              </span>
            </h3>
            <div className="space-y-3 mb-6">
              {filtered.filter(v => (v.warehouseName || 'ไม่ระบุคลัง') === warehouse)
                .sort((a, b) => (a.etaMinutes || 9999) - (b.etaMinutes || 9999))
                .map(v => <VehicleCard key={v.vehicleId} v={v} />)}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-3">
          {filtered.sort((a, b) => (a.etaMinutes || 9999) - (b.etaMinutes || 9999))
            .map(v => <VehicleCard key={v.vehicleId} v={v} />)}
        </div>
      )}
    </div>
  );
}
