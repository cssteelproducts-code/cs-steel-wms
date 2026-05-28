import { useState, useEffect } from 'react';
import { Activity, RefreshCw, TruckIcon, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { formatDateTime, formatDuration, getStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';

const FLOW_STEPS = [
  { key: 'WeighIn',  label: 'ชั่งเข้า',       shortLabel: '1.ชั่งเข้า' },
  { key: 'Data',     label: 'บันทึกสถานี',     shortLabel: '2.DataStation' },
  { key: 'WaitPick', label: 'รอเอกสาร Pick',   shortLabel: '3.รอPick' },
  { key: 'Loading',  label: 'ขึ้นสินค้า',      shortLabel: '4.ขึ้นสินค้า' },
  { key: 'WeighOut', label: 'รอชั่งออก',       shortLabel: '5.ชั่งออก' },
  { key: 'Checker',  label: 'เช็คเกอร์',       shortLabel: '6.เช็คเกอร์' },
  { key: 'Complete', label: 'เสร็จสิ้น',       shortLabel: '✓ เสร็จ' }
];

export default function TripMonitor() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState('all');

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
    const interval = setInterval(fetchTrips, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? trips :
    trips.filter(t => t.Status === filter);

  const statusCounts = FLOW_STEPS.slice(0, 6).reduce((acc, step) => {
    acc[step.key] = trips.filter(t => t.Status === step.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Activity size={24} className="text-emerald-500" />
            Monitor รถในคลัง
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchTrips} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white self-start">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Flow summary */}
      <div className="grid grid-cols-6 gap-2">
        {FLOW_STEPS.slice(0, 6).map(step => {
          const count = statusCounts[step.key] || 0;
          const cfg = getStatusConfig(step.key);
          return (
            <button key={step.key}
              onClick={() => setFilter(filter === step.key ? 'all' : step.key)}
              className={`p-3 rounded-xl border text-center transition-all ${filter === step.key
                ? `${cfg.color} scale-105`
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
              <div className={`text-2xl font-bold ${filter === step.key ? '' : count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                {count}
              </div>
              <div className="text-xs mt-1 text-slate-500">{step.shortLabel}</div>
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
            const currentStep = FLOW_STEPS.findIndex(s => s.key === trip.Status);

            return (
              <div key={trip.TripID}
                className={`card border-l-4 ${cfg.color.split(' ').find(c => c.startsWith('border')) || 'border-slate-300'} transition-all`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-slate-900 font-bold text-xl">{trip.LicensePlate}</span>
                      <StatusBadge status={trip.Status} soWait={!!trip.SOWaitStartedAt} />
                      {trip.CurrentStation && (
                        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          📍 {trip.CurrentStation}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-3 text-sm">
                      <div><span className="text-slate-400">Trip:</span> <span className="text-slate-600">#{trip.TripID}</span></div>
                      <div><span className="text-slate-400">ประเภท:</span> <span className="text-slate-600">{trip.VehicleType || '-'}</span></div>
                      <div><span className="text-slate-400">คลัง:</span> <span className="text-slate-600">{trip.WarehouseName || '-'}</span></div>
                      <div><span className="text-slate-400">ลูกค้า:</span> <span className="text-blue-500">{trip.CustomerName || '-'}</span></div>
                      {trip.WeighInTime && (
                        <div><span className="text-slate-400">ชั่งเข้า:</span> <span className="text-slate-600">{formatDateTime(trip.WeighInTime)}</span></div>
                      )}
                      {trip.DeliveryType && (
                        <div><span className="text-slate-400">ขนส่ง:</span> <span className="text-indigo-500 font-medium">{trip.DeliveryType}</span></div>
                      )}
                      {trip.Priority && (
                        <div className="flex items-center gap-2"><span className="text-slate-400">ความเร่งด่วน:</span> <PriorityBadge priority={trip.Priority} /></div>
                      )}
                      {trip.PickDocumentNo && (
                        <div><span className="text-slate-400">เอกสาร:</span> <span className="text-purple-500 font-mono">{trip.PickDocumentNo}</span></div>
                      )}
                      <div>
                        <span className="text-slate-400">เวลาในคลัง:</span>
                        <span className={`ml-1 font-medium ${trip.MinutesInWarehouse > 120 ? 'text-red-500' : trip.MinutesInWarehouse > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {formatDuration(trip.MinutesInWarehouse)}
                        </span>
                      </div>
                    </div>
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
                      {FLOW_STEPS.slice(0, 6).map((step, idx) => (
                        <div key={step.key} className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${idx < currentStep ? 'bg-emerald-500' : idx === currentStep ? `${cfg.dot} animate-pulse` : 'bg-slate-300'}`} />
                          {idx < 5 && <div className={`w-4 h-0.5 ${idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className={`text-xs ${cfg.color.split(' ').find(c => c.startsWith('text')) || 'text-slate-400'}`}>
                      ขั้นตอน {currentStep + 1}/6
                    </div>
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
