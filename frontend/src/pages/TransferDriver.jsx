import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  ArrowRight, CheckCircle2, Circle, RefreshCw,
  ChevronRight, Truck, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import dayjs from 'dayjs';
import { useLang } from '../context/LanguageContext';

const PRIORITY_CONFIG = {
  URGENT: { labelKey: 'priority.veryUrgent', color: '#ef4444', bg: '#fef2f2' },
  HIGH:   { labelKey: 'priority.urgent',     color: '#f59e0b', bg: '#fffbeb' },
};

const STEP_META = {
  PENDING:      { labelKey: 'driver.waitAssign',   btnKey: 'driver.source',     color: '#6b7280', endpoint: 'source-entry' },
  SOURCE_ENTRY: { labelKey: 'transfer.typeSource',  btnKey: 'driver.dest',       color: '#f59e0b', endpoint: 'source-exit', needsWeight: true },
  SOURCE_EXIT:  { labelKey: 'transfer.typeDest',    btnKey: 'driver.dest',       color: '#3b82f6', endpoint: 'dest-entry' },
  DEST_ENTRY:   { labelKey: 'status.complete',      btnKey: 'driver.saveAndExit',color: '#8b5cf6', endpoint: 'dest-exit' },
  COMPLETE:     { labelKey: 'status.complete',      btnKey: null,                color: '#10b981', endpoint: null },
};

const TIMELINE_KEYS = [
  { labelKey: 'driver.source', field: 'SourceEntryTime' },
  { labelKey: 'driver.source', field: 'SourceExitTime', extraFields: ['BundleCount', 'TotalWeightKg'] },
  { labelKey: 'driver.dest',   field: 'DestEntryTime' },
  { labelKey: 'driver.dest',   field: 'DestExitTime' },
];

export default function TransferDriver() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [weightForm, setWeightForm] = useState({ bundleCount: '', totalWeightKg: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const tripsRes = await api.get('/transfer/trips/active');
      const trips = tripsRes.data.success ? tripsRes.data.data : [];
      setActiveTrips(trips);
      if (trips.length > 0) {
        setSelectedTripId(prev => prev && trips.find(tr => tr.TripID === prev) ? prev : trips[0].TripID);
      } else {
        setSelectedTripId(null);
      }
    } catch {
      toast.error(t('common.noData'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const advanceTrip = async (trip) => {
    const meta = STEP_META[trip.Status];
    if (!meta?.endpoint) return;
    if (meta.needsWeight) { setShowWeight(true); return; }
    setActionLoading(true);
    try {
      await api.put(`/transfer/trips/${trip.TripID}/${meta.endpoint}`);
      toast.success(trip.Status === 'DEST_ENTRY' ? t('driver.roundDone') : t('common.save'));
      await load();
    } catch {
      toast.error(t('common.noData'));
    } finally {
      setActionLoading(false);
    }
  };

  const submitWeight = async (tripId) => {
    if (!weightForm.bundleCount || !weightForm.totalWeightKg) {
      toast.error(t('driver.bundleCount')); return;
    }
    setActionLoading(true);
    try {
      await api.put(`/transfer/trips/${tripId}/source-exit`, {
        bundleCount: parseInt(weightForm.bundleCount),
        totalWeightKg: parseFloat(weightForm.totalWeightKg),
        notes: weightForm.notes || null,
      });
      toast.success(t('common.save'));
      setShowWeight(false);
      setWeightForm({ bundleCount: '', totalWeightKg: '', notes: '' });
      await load();
    } catch {
      toast.error(t('common.noData'));
    } finally {
      setActionLoading(false);
    }
  };

  const trip = activeTrips.find(tr => tr.TripID === selectedTripId);
  const meta = trip ? STEP_META[trip.Status] : null;

  if (loading) return (
    <div className="flex justify-center items-center py-16">
      <LoadingSpinner text={t('common.loading')} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto space-y-4 pb-10">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-black" style={{ color: '#111827' }}>{t('driver.myJobs')}</h2>
          <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>{t('driver.logStation')}</p>
        </div>
        <button onClick={load}
          className="p-2.5 rounded-2xl transition-colors"
          style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <RefreshCw size={16} className={actionLoading ? 'animate-spin text-red-500' : 'text-gray-400'} />
        </button>
      </div>

      {trip ? (
        <>
          {activeTrips.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...activeTrips].sort((a, b) => {
                const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
                return (rank[a.Priority] ?? 2) - (rank[b.Priority] ?? 2);
              }).map(tr => {
                const pc = PRIORITY_CONFIG[tr.Priority];
                return (
                  <button key={tr.TripID}
                    onClick={() => { setSelectedTripId(tr.TripID); setShowWeight(false); }}
                    className="flex-shrink-0 flex items-center gap-1 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                    style={selectedTripId === tr.TripID
                      ? { background: '#dc2626', color: '#fff' }
                      : pc
                        ? { background: pc.bg, color: pc.color, border: `1.5px solid ${pc.color}40` }
                        : { background: '#f3f4f6', color: '#6b7280' }}>
                    {pc && <Star size={10} fill="currentColor" />}
                    {tr.JobCode} {t('driver.roundNo')} {tr.TripNo}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-3xl overflow-hidden"
            style={{ background: '#ffffff', border: '1.5px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ background: `${meta?.color}12`, borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta?.color }} />
                <span className="text-sm font-bold" style={{ color: meta?.color }}>{meta?.labelKey ? t(meta.labelKey) : ''}</span>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>{t('driver.roundNo')} {trip.TripNo}</span>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>{t('driver.jobNo')}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-black" style={{ color: '#111827' }}>{trip.JobCode}</div>
                    {PRIORITY_CONFIG[trip.Priority] && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black"
                        style={{ background: PRIORITY_CONFIG[trip.Priority].bg, color: PRIORITY_CONFIG[trip.Priority].color }}>
                        <Star size={10} fill="currentColor" />
                        {t(PRIORITY_CONFIG[trip.Priority].labelKey)}
                      </span>
                    )}
                  </div>
                </div>
                {trip.VehiclePlate && (
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>{t('driver.vehicle')}</div>
                    <div className="px-2 py-1 rounded-xl text-sm font-black" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                      {trip.VehicleCode ? `[${trip.VehicleCode}] ` : ''}{trip.VehiclePlate}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: '#fef2f2' }}>
                  <div className="text-xs font-bold mb-0.5" style={{ color: '#9ca3af' }}>{t('driver.source')}</div>
                  <div className="text-sm font-black" style={{ color: '#dc2626' }}>{trip.SourceStationName}</div>
                </div>
                <ArrowRight size={18} className="flex-shrink-0 text-gray-200" />
                <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: '#eff6ff' }}>
                  <div className="text-xs font-bold mb-0.5" style={{ color: '#9ca3af' }}>{t('driver.dest')}</div>
                  <div className="text-sm font-black" style={{ color: '#3b82f6' }}>{trip.DestStationName}</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl" style={{ background: '#f9fafb' }}>
                <div className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>{t('driver.product')}</div>
                <div className="text-sm font-semibold" style={{ color: '#374151' }}>{trip.ProductDesc}</div>
              </div>

              <div className="space-y-3">
                {TIMELINE_KEYS.map(({ labelKey, field, extraFields }, i) => {
                  const time = trip[field];
                  return (
                    <div key={i} className="flex items-start gap-3">
                      {time
                        ? <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                        : <Circle size={18} style={{ color: '#e5e7eb', flexShrink: 0, marginTop: 1 }} />}
                      <div className="flex-1">
                        <span className="text-sm font-semibold" style={{ color: time ? '#111827' : '#d1d5db' }}>
                          {t(labelKey)}
                        </span>
                        {extraFields && trip.BundleCount && (
                          <div className="flex gap-3 mt-0.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                              {trip.BundleCount} {t('transfer.bundles')}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                              {trip.TotalWeightKg} {t('unit.kg')}
                            </span>
                          </div>
                        )}
                      </div>
                      {time && (
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#6b7280' }}>
                          {dayjs(time).format('HH:mm')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {meta?.btnKey && trip.Status !== 'COMPLETE' && !showWeight && (
                <button onClick={() => advanceTrip(trip)} disabled={actionLoading}
                  className="w-full h-16 rounded-2xl text-base font-black text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  style={{ background: `linear-gradient(135deg,${meta.color},${meta.color}cc)`, boxShadow: `0 6px 20px ${meta.color}40` }}>
                  {actionLoading ? <RefreshCw size={20} className="animate-spin" /> : <ChevronRight size={22} />}
                  {meta.btnKey ? t(meta.btnKey) : ''}
                </button>
              )}

              {showWeight && (
                <div className="space-y-3 p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
                  <p className="text-sm font-bold" style={{ color: '#111827' }}>{t('driver.recordWeight')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>{t('driver.bundleCount')}</label>
                      <input type="number" inputMode="numeric" value={weightForm.bundleCount}
                        onChange={e => setWeightForm(f => ({ ...f, bundleCount: e.target.value }))}
                        className="w-full h-12 px-3 rounded-xl text-xl font-black outline-none text-center"
                        style={{ border: '1.5px solid #e5e7eb', color: '#111827' }} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>{t('driver.totalWeight')}</label>
                      <input type="number" inputMode="decimal" value={weightForm.totalWeightKg}
                        onChange={e => setWeightForm(f => ({ ...f, totalWeightKg: e.target.value }))}
                        className="w-full h-12 px-3 rounded-xl text-xl font-black outline-none text-center"
                        style={{ border: '1.5px solid #e5e7eb', color: '#111827' }} placeholder="0.0" />
                    </div>
                  </div>
                  <input type="text" value={weightForm.notes}
                    onChange={e => setWeightForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#374151' }}
                    placeholder={t('weighIn.notesPlaceholder')} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowWeight(false)}
                      className="flex-1 h-11 rounded-xl text-sm font-bold transition-colors"
                      style={{ background: '#f3f4f6', color: '#6b7280' }}>
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => submitWeight(trip.TripID)} disabled={actionLoading}
                      className="flex-1 h-11 rounded-xl text-sm font-black text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                      {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                      {t('driver.saveAndExit')}
                    </button>
                  </div>
                </div>
              )}

              {trip.Status === 'COMPLETE' && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span className="font-bold text-sm" style={{ color: '#10b981' }}>{t('driver.roundDone')}</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 rounded-3xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <Truck size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-bold text-sm" style={{ color: '#9ca3af' }}>{t('driver.noTrips')}</p>
          <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>{t('driver.waitAssign')}</p>
        </div>
      )}
    </div>
  );
}
