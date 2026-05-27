import { useState, useEffect, useRef } from 'react';
import { CheckSquare, XCircle, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

function fmtDuration(seconds) {
  if (seconds < 60) return `${seconds} วินาที`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs === 0) return `${mins} นาที`;
  return `${hrs} ชั่วโมง ${remMins} นาที`;
}

function fmtLiveMinutes(mins) {
  if (mins <= 0) return '0 นาที';
  if (mins < 60) return `${mins} นาที`;
  return `${Math.floor(mins / 60)} ชั่วโมง ${mins % 60} นาที`;
}

export default function Checker() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  // Rework modal state
  const [showRework, setShowRework] = useState(false);
  const [reworkStations, setReworkStations] = useState([]);
  const [reworkSelected, setReworkSelected] = useState([]);
  const [loadingStations, setLoadingStations] = useState([]);

  const checkerStartRef = useRef(null);
  const timerRef = useRef(null);
  const fetchedAtRef = useRef(Date.now());

  // Tick every second for the inspection timer
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchPending();
    fetchAllStations();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/checker/pending');
      setPending(res.data.data || []);
      fetchedAtRef.current = Date.now();
    } catch {} finally { setPageLoading(false); }
  };

  const fetchAllStations = async () => {
    try {
      const res = await api.get('/master/loading-stations');
      setLoadingStations((res.data.data || []).sort((a, b) => a.StationName.localeCompare(b.StationName, undefined, { numeric: true })));
    } catch {}
  };

  // Live minutes for the pending list cards (ticks without waiting for API)
  const liveMinutes = (trip) => {
    const extraMs = nowMs - fetchedAtRef.current;
    return Math.max(0, (trip.MinutesInWarehouse || 0) + Math.floor(extraMs / 60000));
  };

  const selectTrip = async (trip) => {
    setSelected(trip);
    setForm({ remarks: '' });
    setShowRework(false);
    setReworkSelected([]);
    checkerStartRef.current = trip.WeighOutDateTime ? new Date(trip.WeighOutDateTime) : new Date();
    setElapsedSeconds(Math.floor((new Date() - checkerStartRef.current) / 1000));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((new Date() - checkerStartRef.current) / 1000));
    }, 1000);
    try {
      const res = await api.get(`/loading-station/trip/${trip.TripID}`);
      setLoadingRecords(res.data.data || []);
      // Pre-load rework station suggestions from existing loading records
      const stations = [...new Set((res.data.data || []).map(r => r.StationID))];
      setReworkStations(stations);
    } catch {}
  };

  const clearSelection = () => {
    setSelected(null);
    setLoadingRecords([]);
    setElapsedSeconds(0);
    setShowRework(false);
    setReworkSelected([]);
    checkerStartRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handlePass = async () => {
    if (!selected) return;
    setSubmitting(true);
    const durationMinutes = checkerStartRef.current
      ? Math.round((new Date() - checkerStartRef.current) / 60000)
      : null;
    try {
      const res = await api.post('/checker', {
        tripId: selected.TripID,
        isApproved: true,
        remarks: form.remarks,
        checkDurationMinutes: durationMinutes,
        checkStartTime: checkerStartRef.current?.toISOString() || null
      });
      if (res.data.success) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const durText = durationMinutes != null
          ? durationMinutes < 60
            ? `ใช้เวลาตรวจ ${durationMinutes} นาที`
            : `ใช้เวลาตรวจ ${Math.floor(durationMinutes / 60)} ชั่วโมง ${durationMinutes % 60} นาที`
          : '';
        toast.success(`${res.data.message}${durText ? ` | ${durText}` : ''}`);
        clearSelection();
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  const handleFailClick = () => {
    setShowRework(true);
  };

  const handleFailSubmit = async () => {
    if (!selected) return;
    if (reworkSelected.length === 0) {
      toast.error('กรุณาเลือกสถานีที่ต้องแก้ไขงาน');
      return;
    }
    setSubmitting(true);
    const durationMinutes = checkerStartRef.current
      ? Math.round((new Date() - checkerStartRef.current) / 60000)
      : null;
    try {
      const res = await api.post('/checker/fail-rework', {
        tripId: selected.TripID,
        remarks: form.remarks,
        reworkStationIds: reworkSelected,
        checkDurationMinutes: durationMinutes,
        checkStartTime: checkerStartRef.current?.toISOString() || null
      });
      if (res.data.success) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        toast.success(res.data.message);
        clearSelection();
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดรายการรอตรวจสอบ..." />
    </div>
  );

  // Group loading records by round
  const recordsByRound = loadingRecords.reduce((acc, r) => {
    const round = r.Round || 1;
    if (!acc[round]) acc[round] = [];
    acc[round].push(r);
    return acc;
  }, {});
  const rounds = Object.keys(recordsByRound).map(Number).sort();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip list */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2">
              <Clock size={18} className="text-orange-500" />
              รอตรวจสอบ ({pending.length})
            </h3>
            <button onClick={fetchPending} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors"><RefreshCw size={15} /></button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {pending.map(trip => {
              const live = liveMinutes(trip);
              return (
                <div key={trip.TripID}
                  onClick={() => selectTrip(trip)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-900 font-bold">{trip.LicensePlate}</span>
                      <span className="text-slate-400 text-xs ml-2">#{trip.TripID}</span>
                      <div className="text-slate-500 text-xs mt-1">
                        {trip.VehicleType}{trip.DeliveryType ? ` | ${trip.DeliveryType}` : ''}{trip.WarehouseName ? ` | ${trip.WarehouseName}` : ''}
                      </div>
                      {trip.CustomerName && <div className="text-blue-500 text-xs">{trip.CustomerName}</div>}
                      {trip.PickDocumentNo && (
                        <div className="text-purple-500 text-xs font-mono mt-1">เอกสาร: {trip.PickDocumentNo}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-orange-500 text-sm font-medium">{fmtLiveMinutes(live)}</div>
                      <div className="text-slate-400 text-xs">ในคลัง</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!pending.length && (
              <p className="text-center text-slate-400 py-8">ไม่มีรถรอตรวจสอบ</p>
            )}
          </div>
        </div>

        {/* Checker form */}
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <CheckSquare size={18} className="text-orange-500" />ตรวจสอบรายการสินค้า
          </h3>

          {selected ? (
            <div className="space-y-4">
              {/* Trip info */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-orange-600 text-sm font-medium mb-2">รถที่เลือก</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-500">ทะเบียน:</span> <span className="text-slate-900 font-bold">{selected.LicensePlate}</span></div>
                  <div><span className="text-slate-500">ประเภท:</span> <span className="text-slate-900">{selected.VehicleType}</span></div>
                  <div><span className="text-slate-500">ลูกค้า:</span> <span className="text-slate-900">{selected.CustomerName || '-'}</span></div>
                  <div><span className="text-slate-500">คลัง:</span> <span className="text-slate-900">{selected.WarehouseName}</span></div>
                  {selected.PickDocumentNo && (
                    <div className="col-span-2">
                      <span className="text-slate-500">เอกสาร Pick:</span>
                      <span className="text-purple-500 font-mono ml-2">{selected.PickDocumentNo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live inspection timer */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-blue-600 text-sm font-medium flex items-center gap-2">
                  <Clock size={15} />เวลาที่ใช้ตรวจ
                </div>
                <div className="text-blue-700 font-bold text-sm font-mono">
                  {fmtDuration(elapsedSeconds)}
                </div>
              </div>

              {/* Loading history by round */}
              {loadingRecords.length > 0 && (
                <div>
                  {rounds.map(round => (
                    <div key={round} className="mb-2">
                      <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider flex items-center gap-1">
                        ประวัติสถานีขึ้นสินค้า
                        {rounds.length > 1 && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${round === 1 ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                            รอบที่ {round}
                          </span>
                        )}
                      </p>
                      <div className="space-y-1">
                        {recordsByRound[round].map(r => (
                          <div key={r.RecordID} className="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-slate-900">{r.StationName}</span>
                            <div className="text-right text-xs">
                              <div className="text-slate-500">เข้า: {formatDateTime(r.EntryTime)}</div>
                              {r.ExitTime ? (
                                <div className="text-emerald-500">ออก: {formatDateTime(r.ExitTime)} ({r.DurationMinutes} นาที)</div>
                              ) : (
                                <div className="text-amber-500 animate-pulse">กำลังขึ้นสินค้า...</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="label">หมายเหตุ / บันทึก</label>
                <textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  className="input-field resize-none" rows={2} placeholder="บันทึกหมายเหตุ (ถ้ามี)" />
              </div>

              {/* Rework station selection (shown when fail is clicked) */}
              {showRework && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 text-red-700 font-medium text-sm">
                    <AlertTriangle size={15} />กำหนดสถานีที่ต้องแก้ไขงาน (รอบ 2)
                  </div>
                  <div className="border border-red-200 rounded-lg divide-y divide-red-100 max-h-48 overflow-y-auto bg-white">
                    {loadingStations.map(s => {
                      const checked = reworkSelected.includes(s.StationID);
                      return (
                        <label key={s.StationID}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setReworkSelected(prev =>
                              checked ? prev.filter(id => id !== s.StationID) : [...prev, s.StationID]
                            )}
                            className="w-4 h-4 rounded accent-red-600" />
                          <span className={`text-sm ${checked ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
                            {s.StationName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {reworkSelected.length > 0 && (
                    <p className="text-red-600 text-xs mt-1.5">เลือก {reworkSelected.length} สถานี</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleFailSubmit} disabled={submitting || reworkSelected.length === 0}
                      className="btn-danger flex-1 py-2.5 text-sm">
                      {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><XCircle size={14} />ยืนยันไม่ผ่าน — ส่งแก้ไข</>}
                    </button>
                    <button onClick={() => setShowRework(false)} className="btn-secondary px-4 text-sm">ยกเลิก</button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!showRework && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePass} disabled={submitting}
                    className="btn-success py-3">
                    {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={16} />ผ่านการตรวจ</>}
                  </button>
                  <button onClick={handleFailClick} disabled={submitting}
                    className="btn-danger py-3">
                    <XCircle size={16} />ไม่ผ่าน
                  </button>
                </div>
              )}

              <button onClick={clearSelection} className="btn-secondary w-full">ยกเลิก</button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CheckSquare size={48} className="mb-4 opacity-30" />
              <p>เลือกรถจากรายการด้านซ้ายเพื่อตรวจสอบ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
