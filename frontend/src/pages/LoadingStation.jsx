import { useState, useEffect } from 'react';
import { Package, LogIn, LogOut, Clock, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatDuration } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LoadingStation() {
  const [stations, setStations] = useState([]);
  const [stationStatus, setStationStatus] = useState([]);
  const [activeRecords, setActiveRecords] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [activeTripId, setActiveTripId] = useState('');
  const [loadingTrips, setLoadingTrips] = useState([]);
  const [loadingDoneTrips, setLoadingDoneTrips] = useState([]);
  const [tab, setTab] = useState('entry');
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [tripTargetStations, setTripTargetStations] = useState([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedStation) fetchActiveForStation();
  }, [selectedStation]);

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
        setLoadingTrips(all.filter(t => t.DataStationID && (t.Status === 'WaitPick' || (t.Status === 'Loading' && t.RemainingStations > 0))).sort((a, b) => a.TripID - b.TripID));
        setLoadingDoneTrips(all.filter(t => t.Status === 'Loading' && t.RemainingStations === 0));
      }
    } finally { setPageLoading(false); }
  };

  const fetchActiveForStation = async () => {
    try {
      const res = await api.get('/trips/active');
      const all = res.data.data || [];
      setLoadingTrips(all.filter(t => t.Status === 'WaitPick' && t.DataStationID));
      setLoadingDoneTrips(all.filter(t => t.Status === 'Loading'));
    } catch {}
  };

  const fetchTargetStations = async (tripId) => {
    try {
      const res = await api.get(`/loading-station/trip/${tripId}/target-stations`);
      setTripTargetStations(res.data.data || []);
    } catch { setTripTargetStations([]); }
  };

  const handleEntry = async (tripId) => {
    if (!tripId || !selectedStation) { toast.error('กรุณาเลือกรถและสถานี'); return; }
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
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  const handleDone = async (tripId) => {
    setSubmitting(true);
    try {
      const res = await api.put(`/loading-station/done/${tripId}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
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
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดสถานะสถานี..." />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('entry')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'entry' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogIn size={14} className="inline mr-1" />บันทึกเข้าสถานี
        </button>
        <button onClick={() => setTab('exit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'exit' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogOut size={14} className="inline mr-1" />บันทึกออกสถานี ({activeRecords.length})
        </button>
        <button onClick={fetchAll} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      {tab === 'entry' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <LogIn size={18} className="text-blue-500" />บันทึกรถเข้าสถานีขึ้นสินค้า
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">เลือกรถ (Trip) *</label>
              <select value={activeTripId} onChange={e => setActiveTripId(e.target.value)} className="input-field">
                <option value="">-- เลือกรถที่เข้าสถานี --</option>
                {loadingTrips.map(t => (
                  <option key={t.TripID} value={t.TripID}>
                    #{t.TripID} - {t.LicensePlate} ({t.CustomerName || '-'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">เลือกสถานี *</label>
              <select value={selectedStation}
                onChange={e => { setSelectedStation(e.target.value); fetchActiveForStation(e.target.value); }}
                className="input-field"
                disabled={!activeTripId}>
                <option value="">-- เลือกสถานีขึ้นสินค้า --</option>
                {(activeTripId ? tripTargetStations.filter(s => !s.IsDone) : stations).map(s => (
                  <option key={s.StationID} value={s.StationID}>{s.StationName}</option>
                ))}
              </select>
              {!activeTripId && <div className="text-slate-400 text-xs mt-1">เลือกรถก่อนเพื่อดูสถานีที่กำหนด</div>}
            </div>
          </div>

          {activeTripId && (
            <div className="mt-4">
              {loadingTrips.filter(t => String(t.TripID) === activeTripId).map(trip => (
                <div key={trip.TripID} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">ทะเบียน:</span> <span className="text-slate-900 font-bold">{trip.LicensePlate}</span></div>
                    <div><span className="text-slate-500">ประเภท:</span> <span className="text-slate-900">{trip.VehicleType}</span></div>
                    <div><span className="text-slate-500">ลูกค้า:</span> <span className="text-slate-900">{trip.CustomerName || '-'}</span></div>
                    <div><span className="text-slate-500">คลัง:</span> <span className="text-slate-900">{trip.WarehouseName}</span></div>
                    {trip.PickDocumentNo && <div className="col-span-2"><span className="text-slate-500">เอกสาร Pick:</span> <span className="text-slate-900 font-mono">{trip.PickDocumentNo}</span></div>}
                    {tripTargetStations.length > 0 && (
                      <div className="col-span-2 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-500">สถานีที่ต้องขึ้นสินค้า:</span>
                        {tripTargetStations.map(s => (
                          <span key={s.StationID}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s.IsDone
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
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
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={16} />บันทึกเข้าสถานี</>}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'done' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-500" />ขึ้นสินค้าเสร็จแล้ว — ส่งไปชั่งออก
          </h3>
          <div className="space-y-3">
            {loadingDoneTrips.map(trip => (
              <div key={trip.TripID} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-900 font-bold text-lg">{trip.LicensePlate}</span>
                      <span className="text-xs text-slate-500">#{trip.TripID}</span>
                    </div>
                    <div className="text-slate-500 text-sm">
                      {trip.VehicleType} | {trip.CustomerName || 'ไม่ระบุลูกค้า'} | {trip.WarehouseName}
                    </div>
                    {trip.TargetStation && (
                      <div className="text-amber-600 text-xs mt-1">สถานี: {trip.TargetStation}</div>
                    )}
                  </div>
                  <button onClick={() => handleDone(trip.TripID)} disabled={submitting}
                    className="btn-success px-4 py-2 text-sm flex-shrink-0">
                    <CheckCircle size={14} />ส่งชั่งออก
                  </button>
                </div>
              </div>
            ))}
            {!loadingDoneTrips.length && (
              <div className="text-center text-slate-400 py-12">
                <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                ไม่มีรถที่รอส่งชั่งออก
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'exit' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <LogOut size={18} className="text-amber-500" />รถที่กำลังขึ้นสินค้า (บันทึกออก)
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
                    </div>
                    <div className="text-slate-500 text-sm">
                      {record.VehicleType} | {record.CustomerName || 'ไม่ระบุลูกค้า'} | {record.WarehouseName}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Clock size={13} className="text-amber-500" />
                      <span className="text-amber-600">เข้าสถานีมา {record.MinutesAtStation} นาที</span>
                      <span className="text-slate-400">| เวลาเข้า: {formatDateTime(record.EntryTime)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleExit(record.RecordID)} disabled={submitting}
                    className="btn-warning px-4 py-2 text-sm flex-shrink-0">
                    <LogOut size={14} />ออกสถานี
                  </button>
                </div>
              </div>
            ))}
            {!activeRecords.length && (
              <div className="text-center text-slate-400 py-12">
                <Package size={48} className="mx-auto mb-3 opacity-30" />
                ไม่มีรถที่กำลังขึ้นสินค้าอยู่
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
