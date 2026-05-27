import { useState, useEffect } from 'react';
import { Package, LogIn, LogOut, Clock, RefreshCw } from 'lucide-react';
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
  const [tab, setTab] = useState('entry');
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedStation) fetchActiveForStation(selectedStation);
  }, [selectedStation]);

  const fetchAll = async () => {
    try {
      const [stRes, statusRes, activeRes] = await Promise.allSettled([
        api.get('/master/loading-stations'),
        api.get('/loading-station/stations-status'),
        api.get('/loading-station/active')
      ]);
      if (stRes.status === 'fulfilled') setStations(stRes.value.data.data || []);
      if (statusRes.status === 'fulfilled') setStationStatus(statusRes.value.data.data || []);
      if (activeRes.status === 'fulfilled') setActiveRecords(activeRes.value.data.data || []);
    } finally { setPageLoading(false); }
  };

  const fetchActiveForStation = async (stationId) => {
    try {
      const res = await api.get('/trips/active');
      const trips = res.data.data?.filter(t => t.Status === 'Loading') || [];
      setLoadingTrips(trips);
    } catch {}
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

  const handleExit = async (recordId) => {
    setSubmitting(true);
    try {
      const res = await api.put(`/loading-station/exit/${recordId}`);
      if (res.data.success) { toast.success(res.data.message); fetchAll(); }
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
      {/* Station status overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">สถานะสถานีขึ้นสินค้า</h3>
          <button onClick={fetchAll} className="btn-secondary text-sm px-3 py-1.5">
            <RefreshCw size={13} />รีเฟรช
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stationStatus.map(s => (
            <div key={s.StationID}
              className={`p-3 rounded-lg border text-center cursor-pointer transition-all
                ${s.ActiveTrucks > 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'}`}
              onClick={() => setSelectedStation(String(s.StationID))}>
              <div className="text-xs text-slate-500 mb-1">{s.StationName}</div>
              {s.ActiveTrucks > 0 ? (
                <>
                  <div className="text-amber-500 font-bold text-lg">{s.ActiveTrucks}</div>
                  <div className="text-amber-500 text-xs">คันอยู่ในสถานี</div>
                  {s.CurrentTruck && (
                    <div className="text-slate-700 text-xs mt-1 font-medium">{s.CurrentTruck}</div>
                  )}
                </>
              ) : (
                <div className="text-emerald-600 text-sm font-medium">✓ ว่าง</div>
              )}
            </div>
          ))}
          {!stationStatus.length && (
            <div className="col-span-full text-center text-slate-400 py-4">
              ยังไม่มีสถานีที่กำหนด กรุณาเพิ่มในเมนู "ข้อมูลหลัก"
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('entry')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'entry' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogIn size={14} className="inline mr-1" />บันทึกเข้าสถานี
        </button>
        <button onClick={() => setTab('exit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'exit' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <LogOut size={14} className="inline mr-1" />บันทึกออกสถานี ({activeRecords.length})
        </button>
      </div>

      {tab === 'entry' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <LogIn size={18} className="text-blue-500" />บันทึกรถเข้าสถานีขึ้นสินค้า
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">เลือกสถานี *</label>
              <select value={selectedStation}
                onChange={e => { setSelectedStation(e.target.value); fetchActiveForStation(e.target.value); }}
                className="input-field">
                <option value="">-- เลือกสถานีขึ้นสินค้า --</option>
                {stations.map(s => (
                  <option key={s.StationID} value={s.StationID}>{s.StationName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">เลือกรถ (Trip) *</label>
              <select value={activeTripId} onChange={e => setActiveTripId(e.target.value)} className="input-field">
                <option value="">-- เลือกรถที่เข้าสถานี --</option>
                {loadingTrips.map(t => (
                  <option key={t.TripID} value={t.TripID}>
                    #{t.TripID} - {t.LicensePlate} ({t.CustomerName || '-'})
                    {t.TargetStation ? ` → ${t.TargetStation}` : ''}
                  </option>
                ))}
              </select>
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
                    {trip.TargetStation && <div className="col-span-2"><span className="text-slate-500">สถานีเป้าหมาย:</span> <span className="text-amber-500 font-medium">{trip.TargetStation}</span></div>}
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
