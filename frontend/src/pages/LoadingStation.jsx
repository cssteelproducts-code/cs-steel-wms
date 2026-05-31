import { useState, useEffect } from 'react';
import { Package, LogIn, LogOut, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import PriorityBadge from '../components/PriorityBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLang } from '../context/LanguageContext';

export default function LoadingStation() {
  const { t } = useLang();
  const [stations, setStations] = useState([]);
  const [stationStatus, setStationStatus] = useState([]);
  const [activeRecords, setActiveRecords] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [activeTripId, setActiveTripId] = useState('');
  const [loadingTrips, setLoadingTrips] = useState([]);
  const [tab, setTab] = useState('entry');
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [tripTargetStations, setTripTargetStations] = useState([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTripId) fetchTargetStations(activeTripId);
    else setTripTargetStations([]);
    setSelectedStation('');
  }, [activeTripId]);

  const fetchAll = async () => {
    try {
      const [stRes, statusRes, activeRes, tripsRes] = await Promise.allSettled([
        api.get('/master/loading-stations'),
        api.get('/loading-station/stations-status'),
        api.get('/loading-station/active'),
        api.get('/trips/active')
      ]);
      if (stRes.status === 'fulfilled') setStations((stRes.value.data.data || []).sort((a, b) => a.StationName.localeCompare(b.StationName, undefined, { numeric: true })));
      if (statusRes.status === 'fulfilled') setStationStatus(statusRes.value.data.data || []);
      if (activeRes.status === 'fulfilled') setActiveRecords(activeRes.value.data.data || []);
      if (tripsRes.status === 'fulfilled') {
        const all = tripsRes.value.data.data || [];
        setLoadingTrips(all.filter(tr => tr.DataStationID && (tr.Status === 'WaitPick' || tr.Status === 'Loading') && (tr.RemainingStations == null || tr.RemainingStations > 0)).sort((a, b) => a.TripID - b.TripID));
      }
    } finally { setPageLoading(false); }
  };

  const fetchTargetStations = async (tripId) => {
    try {
      const res = await api.get(`/loading-station/trip/${tripId}/target-stations`);
      setTripTargetStations(res.data.data || []);
    } catch { setTripTargetStations([]); }
  };

  const handleEntry = async (tripId) => {
    if (!tripId || !selectedStation) { toast.error(t('loading.selectVehicle')); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/loading-station/entry', {
        tripId: parseInt(tripId),
        stationId: parseInt(selectedStation)
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setActiveTripId('');
        fetchAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setSubmitting(false); }
  };

  const handleExit = async (recordId) => {
    setSubmitting(true);
    try {
      const res = await api.put(`/loading-station/exit/${recordId}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchAll();
        if (activeTripId) fetchTargetStations(activeTripId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setSubmitting(false); }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('entry')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'entry' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogIn size={14} className="inline mr-1" />{t('loading.entryTab')}
        </button>
        <button onClick={() => setTab('exit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'exit' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogOut size={14} className="inline mr-1" />{t('loading.exitTab')} ({activeRecords.length})
        </button>
      </div>

      {tab === 'entry' && (
        <div className="card">
          <h3 className="card-header flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><LogIn size={18} className="text-blue-500" />{t('loading.entryTitle')}</span>
            <button onClick={fetchAll} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors">
              <RefreshCw size={15} />
            </button>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('loading.selectVehicle')}</label>
              <select value={activeTripId} onChange={e => setActiveTripId(e.target.value)} className="input-field">
                <option value="">{t('loading.selectVehiclePlaceholder')}</option>
                {loadingTrips.map(tr => (
                  <option key={tr.TripID} value={tr.TripID}>
                    {tr.LicensePlate} - {tr.CustomerName || '-'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('loading.selectStation')}</label>
              <select value={selectedStation}
                onChange={e => setSelectedStation(e.target.value)}
                className="input-field"
                disabled={!activeTripId}>
                <option value="">{t('loading.selectStationPlaceholder')}</option>
                {(activeTripId ? tripTargetStations : stations).map(s => {
                  const done = s.IsDone;
                  const active = s.IsActive;
                  const label = done ? `✓ ${s.StationName}`
                    : active ? `⏳ ${s.StationName}`
                    : s.StationName;
                  return (
                    <option key={s.StationID} value={s.StationID} disabled={done || active}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {!activeTripId && <div className="text-slate-400 text-xs mt-1">{t('loading.selectVehicleFirst')}</div>}
            </div>
          </div>

          {activeTripId && (
            <div className="mt-4">
              {loadingTrips.filter(tr => String(tr.TripID) === activeTripId).map(trip => (
                <div key={trip.TripID} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2"><span className="text-slate-500">{t('common.licensePlate')}:</span> <span className="text-slate-900 font-bold">{trip.LicensePlate}</span><PriorityBadge priority={trip.Priority} /></div>
                    <div><span className="text-slate-500">{t('common.type')}:</span> <span className="text-slate-900">{trip.VehicleType}</span></div>
                    <div><span className="text-slate-500">{t('common.delivery')}:</span> <span className="text-slate-900">{trip.DeliveryType || '-'}</span></div>
                    <div><span className="text-slate-500">{t('common.warehouse')}:</span> <span className="text-slate-900">{trip.WarehouseName}</span></div>
                    {trip.PickDocumentNo && <div className="col-span-2"><span className="text-slate-500">{t('common.document')}:</span> <span className="text-slate-900 font-mono">{trip.PickDocumentNo}</span></div>}
                    {tripTargetStations.length > 0 && (
                      <div className="col-span-2 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-500">{t('loading.stationsRequired')}</span>
                        {tripTargetStations.map(s => (
                          <span key={s.StationID}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              s.IsDone ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              : s.IsActive ? 'bg-blue-50 text-blue-600 border-blue-300'
                              : 'bg-amber-50 text-amber-600 border-amber-300'}`}>
                            {s.StationName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={() => handleEntry(activeTripId)} disabled={submitting}
                className="btn-success w-full py-3">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={16} />{t('loading.recordEntry')}</>}
              </button>
            </div>
          )}

          {!activeTripId && loadingTrips.length === 0 && (
            <div className="text-center text-slate-400 py-12">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              {t('loading.noVehicles')}
            </div>
          )}
        </div>
      )}

      {tab === 'exit' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <LogOut size={18} className="text-amber-500" />{t('loading.exitTitle')}
          </h3>
          <div className="space-y-3">
            {activeRecords.map(record => (
              <div key={record.RecordID}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-900 font-bold text-lg">{record.LicensePlate}</span>
                      <span className="text-xs bg-amber-100 text-amber-600 border border-amber-300 px-2 py-0.5 rounded-full">
                        {record.StationName}
                      </span>
                      <PriorityBadge priority={record.Priority} />
                    </div>
                    <div className="text-slate-500 text-sm">
                      {record.VehicleType} | {record.DeliveryType || '-'} | {record.WarehouseName}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Clock size={13} className="text-amber-500" />
                      <span className="text-amber-600">{t('loading.minutesAtStation').replace('{n}', record.MinutesAtStation)}</span>
                      <span className="text-slate-400">| {t('loading.entryTime')} {formatDateTime(record.EntryTime)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleExit(record.RecordID)} disabled={submitting}
                    className="btn-warning px-4 py-2 text-sm flex-shrink-0">
                    <LogOut size={14} />{t('loading.exitStation')}
                  </button>
                </div>
              </div>
            ))}
            {!activeRecords.length && (
              <div className="text-center text-slate-400 py-12">
                <Package size={48} className="mx-auto mb-3 opacity-30" />
                {t('loading.noActive')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
