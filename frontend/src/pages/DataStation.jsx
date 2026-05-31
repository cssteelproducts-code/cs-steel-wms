import { useState, useEffect } from 'react';
import { FileText, Check, Clock, HourglassIcon, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import PriorityBadge from '../components/PriorityBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLang } from '../context/LanguageContext';

// Isolated timer — only this component re-renders every second, not the whole list.
function LiveSOWait({ startedAt, t }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  );
  useEffect(() => {
    const id = setInterval(() =>
      setSecs(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (secs < 60) return <span className="text-xs font-semibold text-rose-500">⏱ {secs} {t('unit.seconds')}</span>;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return <span className="text-xs font-semibold text-rose-500">⏱ {mins} {t('unit.minutes')}</span>;
  return <span className="text-xs font-semibold text-rose-500">⏱ {Math.floor(mins / 60)} {t('unit.hours')} {mins % 60} {t('unit.minutes')}</span>;
}

export default function DataStation() {
  const { t } = useLang();
  const [pending, setPending] = useState([]);
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ stationIds: [], notes: '' });
  const [loading, setLoading] = useState(false);
  const [waitLoading, setWaitLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchPending();
    fetchStations();
    const pollInterval = setInterval(fetchPending, 15000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/data-station/pending');
      setPending(res.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const fetchStations = async () => {
    try {
      const res = await api.get('/master/loading-stations');
      const sorted = (res.data.data || []).sort((a, b) =>
        a.StationName.localeCompare(b.StationName, undefined, { numeric: true })
      );
      setStations(sorted);
    } catch {}
  };

  const selectTrip = (trip) => {
    setSelected(trip);
    setForm({ stationIds: [], notes: '' });
  };

  const markWaitPick = async () => {
    if (!selected) return;
    setWaitLoading(true);
    try {
      const res = await api.put(`/data-station/${selected.TripID}/wait-pick`);
      if (res.data.success) {
        toast.success(`${selected.LicensePlate} — ${t('dataStation.waitSO')}`);
        const updated = { ...selected, Status: 'WaitPick', SOWaitStartedAt: new Date().toISOString(), SOWaitMinutes: 0 };
        setSelected(updated);
        fetchPending();
      }
    } catch {
      toast.error(t('common.noData'));
    } finally {
      setWaitLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api.post('/data-station', { tripId: selected.TripID, stationIds: form.stationIds, notes: form.notes });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelected(null);
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally {
      setLoading(false);
    }
  };

  const formatWait = (mins) => {
    if (!mins || mins <= 0) return t('common.justArrived');
    if (mins < 60) return `${mins} ${t('unit.minutes')}`;
    return `${Math.floor(mins / 60)} ${t('unit.hours')} ${mins % 60} ${t('unit.minutes')}`;
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Trip list */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="card-header mb-0 flex items-center gap-2">
              <Clock size={18} className="text-purple-500" />
              {t('dataStation.waitingTitle')} ({pending.length})
            </h3>
            <button onClick={fetchPending} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors"><RefreshCw size={15} /></button>
          </div>

          <div className="space-y-2 overflow-y-auto" style={{height: 'calc(100vh - 200px)'}}>
            {pending.map(trip => (
              <div key={trip.TripID}
                onClick={() => selectTrip(trip)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 font-bold">{trip.LicensePlate}</span>
                      <PriorityBadge priority={trip.Priority} />
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      {[trip.VehicleType, trip.DeliveryType, trip.WarehouseName, `#${trip.TripID}`].filter(Boolean).join(' / ')}
                    </div>
                    {trip.CustomerName && (
                      <div className="text-blue-500 text-xs">{trip.CustomerName}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-amber-500 text-sm font-medium">
                      {formatWait(trip.WaitMinutes)}
                    </div>
                    <div className="text-slate-400 text-xs">{formatDateTime(trip.WeighDateTime)}</div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      {(trip.Status === 'Data' || (trip.Status === 'WaitPick' && !trip.SOWaitStartedAt)) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 font-medium">{t('status.waitPick')}</span>
                      )}
                      {trip.Status === 'WaitPick' && trip.SOWaitStartedAt && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-medium">{t('status.soWait')}</span>
                      )}
                      {trip.Status === 'WaitPick' && trip.SOWaitStartedAt && (
                        <LiveSOWait startedAt={trip.SOWaitStartedAt} t={t} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!pending.length && (
              <p className="text-center text-slate-400 py-8">{t('dataStation.noTrips')}</p>
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <FileText size={18} className="text-purple-500" />
            {t('dataStation.formTitle')}
          </h3>

          {selected ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected trip info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium mb-1">{t('common.selectedVehicle')}</div>
                <div className="text-slate-900 text-xl font-bold">{selected.LicensePlate}</div>
                <div className="text-slate-500 text-sm">
                  {selected.VehicleType} | {selected.DeliveryType || '-'} | {selected.WarehouseName}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  {t('dataStation.weighInTime')} {formatDateTime(selected.WeighDateTime)}
                </div>
              </div>

              <div>
                <label className="label">{t('dataStation.stationLabel')} <span className="text-slate-400 font-normal">({t('dataStation.multiSelectHint')})</span></label>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {stations.length === 0 ? (
                    <p className="text-slate-400 text-xs p-3">{t('dataStation.noStations')}</p>
                  ) : stations.map(s => {
                    const checked = form.stationIds.includes(s.StationID);
                    return (
                      <label key={s.StationID}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setForm(p => ({
                            ...p,
                            stationIds: checked
                              ? p.stationIds.filter(id => id !== s.StationID)
                              : [...p.stationIds, s.StationID]
                          }))}
                          className="w-4 h-4 rounded accent-purple-600" />
                        <span className={`text-sm ${checked ? 'text-purple-700 font-medium' : 'text-slate-700'}`}>
                          {s.StationName}
                          {s.WarehouseName && <span className="text-slate-400 text-xs ml-1">({s.WarehouseName})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {form.stationIds.length > 0 && (
                  <p className="text-purple-600 text-xs mt-1">{t('dataStation.selectedCount').replace('{n}', form.stationIds.length)}</p>
                )}
              </div>

              <div>
                <label className="label">{t('common.note')}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field resize-none" rows={2} placeholder={t('weighIn.notesPlaceholder')} />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="btn-success flex-1 py-3">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={16} />{t('common.record')}</>}
                </button>
                <button type="button" onClick={() => setSelected(null)} className="btn-secondary px-6">{t('common.cancel')}</button>
              </div>
              {selected.Status !== 'WaitPick' && (
                <button type="button" onClick={markWaitPick} disabled={waitLoading}
                  className="w-full py-2.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                  {waitLoading
                    ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                    : <><HourglassIcon size={14} />{t('dataStation.markWaitSO')}</>}
                </button>
              )}
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileText size={48} className="mb-4 opacity-30" />
              <p>{t('dataStation.selectToRecord')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
