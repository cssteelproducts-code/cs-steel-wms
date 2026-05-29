import { useState, useEffect } from 'react';
import { Activity, RefreshCw, TruckIcon, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { formatDateTime, formatDuration, getStatusConfig, getEffectiveStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';

const FLOW_STEPS = [
  { keys: ['WeighIn'],          primaryKey: 'WeighIn',  shortLabel: '1.ชั่งเข้า',         showCount: false, noFilter: true },
  { keys: ['Data', 'WaitPick'], primaryKey: 'WaitPick', shortLabel: '2.เอกสาร Pick',      showCount: true  },
  { keys: ['Loading'],          primaryKey: 'Loading',  shortLabel: '3.สถานีขึ้นสินค้า', showCount: true  },
  { keys: ['WeighOut'],         primaryKey: 'WeighOut', shortLabel: '4.ชั่งออก',          showCount: false, noFilter: true },
  { keys: ['Checker'],          primaryKey: 'Checker',  shortLabel: '5.เช็คเกอร์',        showCount: true  },
];

export default function TripMonitor() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState(-1); // -1 = all; index into FLOW_STEPS
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTrips = async () => {
    try {
      const res = await api.get('/dashboard/live');
      if (res.data.success) {
        setTrips(res.data.data);
        setLastUpdate(new Date());
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = trips.filter(t => {
    if (filter !== -1 && !FLOW_STEPS[filter].keys.includes(t.Status)) return false;
    if (statusFilter !== 'all') {
      const label = getEffectiveStatusConfig(t).label;
      if (label !== statusFilter) return false;
    }
    return true;
  });

  const effectiveStatusOptions = [...new Set(trips.map(t => getEffectiveStatusConfig(t).label))].sort();

  const stepCounts = FLOW_STEPS.map(step =>
    trips.filter(t => step.keys.includes(t.Status)).length
  );

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <Activity size={20} className="text-emerald-500 flex-shrink-0" />
            Monitor รถในคลัง
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchTrips} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Status filter dropdown */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">กรองสถานะ:</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input-field py-1.5 text-sm w-auto min-w-48">
          <option value="all">— ทั้งหมด ({trips.length} คัน) —</option>
          {effectiveStatusOptions.map(label => {
            const count = trips.filter(t => getEffectiveStatusConfig(t).label === label).length;
            return <option key={label} value={label}>{label} ({count})</option>;
          })}
        </select>
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline">
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Flow summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {FLOW_STEPS.map((step, idx) => {
          const count = stepCounts[idx];
          const cfg = getStatusConfig(step.primaryKey);
          const active = filter === idx;
          return (
            <button key={step.shortLabel}
              onClick={() => !step.noFilter && setFilter(active ? -1 : idx)}
              className={`p-2.5 rounded-xl border text-center transition-all ${step.noFilter
                ? 'border-slate-200 bg-white cursor-default opacity-60'
                : active
                  ? `${cfg.color} scale-105`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
              {step.showCount ? (
                <div className={`text-xl font-bold ${active ? '' : count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {count}
                </div>
              ) : (
                <div className="h-7 flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-slate-300'}`} />
                </div>
              )}
              <div className="text-xs mt-0.5 text-slate-500 leading-tight">{step.shortLabel}</div>
            </button>
          );
        })}
      </div>

      {/* Trip cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <TruckIcon size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">ไม่มีรถในคลังขณะนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(trip => {
            const cfg = getStatusConfig(trip.Status);
            const currentStep = FLOW_STEPS.findIndex(s => s.keys.includes(trip.Status));

            return (
              <div key={trip.TripID}
                className={`card border-l-4 ${cfg.color.split(' ').find(c => c.startsWith('border')) || 'border-slate-300'} transition-all`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: ทะเบียน / ความเร่งด่วน / สถานะ */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 font-bold text-xl">{trip.LicensePlate}</span>
                      <PriorityBadge priority={trip.Priority} />
                      <StatusBadge trip={trip} />
                      {trip.CurrentStation && (
                        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          📍 {trip.CurrentStation}
                        </span>
                      )}
                    </div>

                    {/* Row 2: ประเภทรถ | ขนส่ง | ลูกค้า */}
                    <div className="grid grid-cols-3 gap-x-4 mt-2 text-sm">
                      <div><span className="text-slate-400">ประเภทรถ: </span><span className="text-slate-600">{trip.VehicleType || '-'}</span></div>
                      <div><span className="text-slate-400">ขนส่ง: </span><span className="text-indigo-500 font-medium">{trip.DeliveryType || '-'}</span></div>
                      <div className="truncate"><span className="text-slate-400">ลูกค้า: </span><span className="text-blue-500">{trip.CustomerName || '-'}</span></div>
                    </div>

                    {/* Row 3: คลัง | ชั่งเข้า | เวลาในคลัง */}
                    <div className="grid grid-cols-3 gap-x-4 mt-1 text-sm">
                      <div><span className="text-slate-400">คลัง: </span><span className="text-slate-600">{trip.WarehouseName || '-'}</span></div>
                      <div><span className="text-slate-400">ชั่งเข้า: </span><span className="text-slate-600">{trip.WeighInTime ? formatDateTime(trip.WeighInTime) : '-'}</span></div>
                      <div>
                        <span className="text-slate-400">เวลาในคลัง: </span>
                        <span className={`font-medium ${trip.MinutesInWarehouse > 120 ? 'text-red-500' : trip.MinutesInWarehouse > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {formatDuration(trip.MinutesInWarehouse)}
                        </span>
                      </div>
                    </div>

                    {trip.PickDocumentNo && (
                      <div className="mt-1 text-xs"><span className="text-slate-400">เอกสาร: </span><span className="text-purple-500 font-mono">{trip.PickDocumentNo}</span></div>
                    )}
                    {trip.TargetStations && (
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="text-slate-400 text-xs">สถานีขึ้นสินค้า:</span>
                        {trip.TargetStations.split(',').map((entry, i) => {
                          const [name, done] = entry.split(':');
                          return (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${done === '1'
                              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                              : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {FLOW_STEPS.map((step, idx) => (
                        <div key={step.shortLabel} className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${idx < currentStep ? 'bg-emerald-500' : idx === currentStep ? `${cfg.dot} animate-pulse` : 'bg-slate-300'}`} />
                          {idx < 4 && <div className={`w-4 h-0.5 ${idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className={`text-xs ${cfg.color.split(' ').find(c => c.startsWith('text')) || 'text-slate-400'}`}>
                      ขั้นตอน {currentStep + 1}/5
                    </div>
                    <div className="text-xs text-slate-400 font-mono">#{trip.TripID}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
