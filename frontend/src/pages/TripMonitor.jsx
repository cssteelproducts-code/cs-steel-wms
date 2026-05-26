import { useState, useEffect } from 'react';
import { Activity, RefreshCw, TruckIcon, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatDuration, getStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';

const FLOW_STEPS = [
  { key: 'WeighIn', label: 'ชั่งเข้า', shortLabel: '1.ชั่งเข้า' },
  { key: 'Data', label: 'รับเอกสาร', shortLabel: '2.Data' },
  { key: 'Loading', label: 'ขึ้นสินค้า', shortLabel: '3.ขึ้นสินค้า' },
  { key: 'Checker', label: 'เช็คเกอร์', shortLabel: '4.ตรวจสอบ' },
  { key: 'WeighOut', label: 'รอชั่งออก', shortLabel: '5.ชั่งออก' },
  { key: 'Complete', label: 'เสร็จสิ้น', shortLabel: '✓ เสร็จ' }
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

  const statusCounts = FLOW_STEPS.slice(0, 5).reduce((acc, step) => {
    acc[step.key] = trips.filter(t => t.Status === step.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Activity size={24} className="text-emerald-400" />
            Monitor รถในคลัง
          </h2>
          <p className="text-steel-400 text-sm mt-1">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchTrips} className="btn-secondary text-sm px-4 py-2 self-start">
          <RefreshCw size={14} />รีเฟรช
        </button>
      </div>

      {/* Flow summary */}
      <div className="grid grid-cols-5 gap-2">
        {FLOW_STEPS.slice(0, 5).map(step => {
          const count = statusCounts[step.key] || 0;
          const cfg = getStatusConfig(step.key);
          return (
            <button key={step.key}
              onClick={() => setFilter(filter === step.key ? 'all' : step.key)}
              className={`p-3 rounded-xl border text-center transition-all ${filter === step.key
                ? `${cfg.color} scale-105`
                : 'border-steel-600 bg-steel-700/30 hover:border-steel-500'}`}>
              <div className={`text-2xl font-bold ${filter === step.key ? '' : count > 0 ? 'text-white' : 'text-steel-500'}`}>
                {count}
              </div>
              <div className="text-xs mt-1 text-steel-400">{step.shortLabel}</div>
            </button>
          );
        })}
      </div>

      {/* Trip cards */}
      {loading ? (
        <div className="text-center py-16 text-steel-500">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <TruckIcon size={48} className="mx-auto text-steel-600 mb-3" />
          <p className="text-steel-400">ไม่มีรถในคลังขณะนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(trip => {
            const cfg = getStatusConfig(trip.Status);
            const currentStep = FLOW_STEPS.findIndex(s => s.key === trip.Status);

            return (
              <div key={trip.TripID}
                className={`card border-l-4 ${cfg.color.split(' ').find(c => c.startsWith('border')) || 'border-steel-600'} hover:border-l-4 transition-all`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white font-bold text-xl">{trip.LicensePlate}</span>
                      <StatusBadge status={trip.Status} />
                      {trip.CurrentStation && (
                        <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          📍 {trip.CurrentStation}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-3 text-sm">
                      <div><span className="text-steel-500">Trip:</span> <span className="text-steel-300">#{trip.TripID}</span></div>
                      <div><span className="text-steel-500">ประเภท:</span> <span className="text-steel-300">{trip.VehicleType || '-'}</span></div>
                      <div><span className="text-steel-500">คลัง:</span> <span className="text-steel-300">{trip.WarehouseName || '-'}</span></div>
                      <div><span className="text-steel-500">ลูกค้า:</span> <span className="text-blue-400">{trip.CustomerName || '-'}</span></div>
                      {trip.WeighInTime && (
                        <div><span className="text-steel-500">ชั่งเข้า:</span> <span className="text-steel-300">{formatDateTime(trip.WeighInTime)}</span></div>
                      )}
                      {trip.PickDocumentNo && (
                        <div><span className="text-steel-500">เอกสาร:</span> <span className="text-purple-400 font-mono">{trip.PickDocumentNo}</span></div>
                      )}
                      {trip.TargetStation && (
                        <div><span className="text-steel-500">เป้าหมาย:</span> <span className="text-amber-400">{trip.TargetStation}</span></div>
                      )}
                      <div>
                        <span className="text-steel-500">เวลาในคลัง:</span>
                        <span className={`ml-1 font-medium ${trip.MinutesInWarehouse > 120 ? 'text-red-400' : trip.MinutesInWarehouse > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {formatDuration(trip.MinutesInWarehouse)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {FLOW_STEPS.slice(0, 5).map((step, idx) => (
                        <div key={step.key} className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${idx < currentStep ? 'bg-emerald-400' : idx === currentStep ? `${cfg.dot} animate-pulse` : 'bg-steel-600'}`} />
                          {idx < 4 && <div className={`w-4 h-0.5 ${idx < currentStep ? 'bg-emerald-400' : 'bg-steel-600'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className={`text-xs ${cfg.color.split(' ').find(c => c.startsWith('text')) || 'text-steel-400'}`}>
                      ขั้นตอน {currentStep + 1}/5
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
