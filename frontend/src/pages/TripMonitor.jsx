import { useState, useEffect } from 'react';
import { Activity, RefreshCw, TruckIcon, Clock } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { formatDateTime, formatDuration, getStatusConfig, getEffectiveStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';

export default function TripMonitor() {
  const { t } = useLang();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyFilter, setKeyFilter] = useState(null); // step card click → filter by status keys

  const FLOW_STEPS = [
    { keys: ['WeighIn'],          primaryKey: 'WeighIn',  labelKey: 'status.weighIn',  showCount: false, noFilter: true },
    { keys: ['Data', 'WaitPick'], primaryKey: 'WaitPick', labelKey: 'status.waitPick', showCount: true  },
    { keys: ['Loading'],          primaryKey: 'Loading',  labelKey: 'status.loading',  showCount: true  },
    { keys: ['WeighOut'],         primaryKey: 'WeighOut', labelKey: 'status.weighOut', showCount: false, noFilter: true },
    { keys: ['Checker'],          primaryKey: 'Checker',  labelKey: 'status.checker',  showCount: true  },
  ];

  const fetchTrips = async () => {
    try {
      const res = await api.get('/dashboard/live', { silent: true });
      if (res.data.success) { setTrips(res.data.data); setLastUpdate(new Date()); }
    } catch {
      toast.error(t('common.noData'));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTripLabel = (trip) => {
    const cfg = getEffectiveStatusConfig(trip);
    return cfg.labelKey === 'status.loadingAt' && cfg.labelStation
      ? `${t('status.loadingAt').replace('{station}', cfg.labelStation)}`
      : cfg.labelKey ? t(cfg.labelKey) : (cfg.label || trip.Status);
  };

  const filtered = trips
    .filter(trip => {
      if (keyFilter) return keyFilter.includes(trip.Status);
      if (statusFilter === 'all') return true;
      return getTripLabel(trip) === statusFilter;
    })
    .sort((a, b) => (b.MinutesInWarehouse || 0) - (a.MinutesInWarehouse || 0));

  const effectiveStatusOptions = [...new Set(trips.map(trip => getTripLabel(trip)))].sort();

  const stepCounts = FLOW_STEPS.map(step =>
    trips.filter(trip => step.keys.includes(trip.Status)).length
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <Activity size={20} className="text-emerald-500 flex-shrink-0" />
            {t('monitor.title')}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('monitor.loading')}
          </p>
        </div>
        <button onClick={fetchTrips} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t('monitor.filterStatus')}</label>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setKeyFilter(null); }}
          className="input-field py-1.5 text-sm w-auto min-w-48">
          <option value="all">{t('monitor.allVehicles').replace('{n}', trips.length)}</option>
          {effectiveStatusOptions.map(label => {
            const count = trips.filter(trip => getTripLabel(trip) === label).length;
            return <option key={label} value={label}>{label} ({count})</option>;
          })}
        </select>
        {(statusFilter !== 'all' || keyFilter) && (
          <button onClick={() => { setStatusFilter('all'); setKeyFilter(null); }}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline">
            {t('monitor.clearFilter')}
          </button>
        )}
      </div>

      {/* Flow summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {FLOW_STEPS.map((step, idx) => {
          const count = stepCounts[idx];
          const isActive = keyFilter && step.keys.every(k => keyFilter.includes(k)) && keyFilter.length === step.keys.length;
          const handleClick = !step.noFilter ? () => {
            if (isActive) { setKeyFilter(null); }
            else { setKeyFilter(step.keys); setStatusFilter('all'); }
          } : undefined;
          return (
            <div key={step.labelKey}
              onClick={handleClick}
              className={`p-2.5 rounded-xl border text-center transition-all
                ${step.noFilter
                  ? 'border-slate-200 bg-white opacity-60'
                  : isActive
                    ? 'border-red-400 bg-red-50 shadow-sm cursor-pointer'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'
                }`}>
              {step.showCount ? (
                <div className={`text-xl font-bold ${count > 0 ? (isActive ? 'text-red-600' : 'text-slate-900') : 'text-slate-400'}`}>{count}</div>
              ) : (
                <div className="h-7 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
              )}
              <div className={`text-xs mt-0.5 leading-tight ${isActive ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{t(step.labelKey)}</div>
            </div>
          );
        })}
      </div>

      {/* Trip cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('monitor.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <TruckIcon size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">{t('monitor.noVehicles')}</p>
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
                  <div className="flex-1 min-w-0">
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

                    <div className="grid grid-cols-3 gap-x-4 mt-2 text-sm">
                      <div><span className="text-slate-400">{t('monitor.vehicleType')}</span><span className="text-slate-600">{trip.VehicleType || '-'}</span></div>
                      <div><span className="text-slate-400">{t('monitor.delivery')}</span><span className="text-indigo-500 font-medium">{trip.DeliveryType || '-'}</span></div>
                      <div className="truncate"><span className="text-slate-400">{t('monitor.customer')}</span><span className="text-blue-500">{trip.CustomerName || '-'}</span></div>
                    </div>

                    <div className="grid grid-cols-3 gap-x-4 mt-1 text-sm">
                      <div><span className="text-slate-400">{t('monitor.warehouse')}</span><span className="text-slate-600">{trip.WarehouseName || '-'}</span></div>
                      <div><span className="text-slate-400">{t('monitor.weighIn')}</span><span className="text-slate-600">{trip.WeighInTime ? formatDateTime(trip.WeighInTime) : '-'}</span></div>
                      <div>
                        <span className="text-slate-400">{t('monitor.timeInWarehouse')}</span>
                        <span className={`font-medium ${trip.MinutesInWarehouse > 120 ? 'text-red-500' : trip.MinutesInWarehouse > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {formatDuration(trip.MinutesInWarehouse, t)}
                        </span>
                      </div>
                    </div>

                    {trip.PickDocumentNo && (
                      <div className="mt-1 text-xs"><span className="text-slate-400">{t('monitor.document')}</span><span className="text-purple-500 font-mono">{trip.PickDocumentNo}</span></div>
                    )}
                    {trip.TargetStations && (
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="text-slate-400 text-xs">{t('monitor.loadingStations')}</span>
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

                  <div className="hidden md:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {FLOW_STEPS.map((step, idx) => (
                        <div key={step.labelKey} className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${idx < currentStep ? 'bg-emerald-500' : idx === currentStep ? `${cfg.dot} animate-pulse` : 'bg-slate-300'}`} />
                          {idx < 4 && <div className={`w-4 h-0.5 ${idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className={`text-xs ${cfg.color.split(' ').find(c => c.startsWith('text')) || 'text-slate-400'}`}>
                      {t('monitor.step')} {currentStep + 1}/5
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
