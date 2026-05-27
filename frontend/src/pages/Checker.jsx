import { useState, useEffect, useRef } from 'react';
import { CheckSquare, XCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Checker() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ isApproved: true, remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const checkerStartRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/checker/pending');
      setPending(res.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const selectTrip = async (trip) => {
    setSelected(trip);
    setForm({ isApproved: true, remarks: '' });
    checkerStartRef.current = new Date();
    setElapsedMinutes(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMinutes(Math.floor((new Date() - checkerStartRef.current) / 60000));
    }, 10000);
    try {
      const res = await api.get(`/loading-station/trip/${trip.TripID}`);
      setLoadingRecords(res.data.data || []);
    } catch {}
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleSubmit = async (approved) => {
    if (!selected) return;
    setSubmitting(true);
    const durationMinutes = checkerStartRef.current
      ? Math.round((new Date() - checkerStartRef.current) / 60000)
      : null;
    try {
      const res = await api.post('/checker', {
        tripId: selected.TripID,
        isApproved: approved,
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
        setSelected(null);
        setLoadingRecords([]);
        setElapsedMinutes(0);
        checkerStartRef.current = null;
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดรายการรอตรวจสอบ..." />
    </div>
  );

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
            <button onClick={fetchPending} className="text-blue-500 text-sm hover:text-blue-600">รีเฟรช</button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {pending.map(trip => (
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
                    <div className="text-orange-500 text-sm font-medium">
                      {trip.MinutesInWarehouse <= 0 ? 'เพิ่งเข้า'
                        : trip.MinutesInWarehouse < 60 ? `${trip.MinutesInWarehouse} นาที`
                        : `${Math.floor(trip.MinutesInWarehouse / 60)} ชั่วโมง ${trip.MinutesInWarehouse % 60} นาที`}
                    </div>
                    <div className="text-slate-400 text-xs">ในคลัง</div>
                  </div>
                </div>
              </div>
            ))}
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

              {/* Inspection timer */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-blue-600 text-sm font-medium flex items-center gap-2">
                  <Clock size={15} />เวลาที่ใช้ตรวจ
                </div>
                <div className="text-blue-700 font-bold text-sm">
                  {elapsedMinutes < 1 ? 'น้อยกว่า 1 นาที'
                    : elapsedMinutes < 60 ? `${elapsedMinutes} นาที`
                    : `${Math.floor(elapsedMinutes / 60)} ชั่วโมง ${elapsedMinutes % 60} นาที`}
                </div>
              </div>

              {/* Loading history */}
              {loadingRecords.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">ประวัติสถานีขึ้นสินค้า</p>
                  <div className="space-y-1">
                    {loadingRecords.map(r => (
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
              )}

              {/* Remarks */}
              <div>
                <label className="label">หมายเหตุ / บันทึก</label>
                <textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  className="input-field resize-none" rows={3} placeholder="บันทึกหมายเหตุ (ถ้ามี)" />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleSubmit(true)} disabled={submitting}
                  className="btn-success py-3">
                  {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={16} />ผ่านการตรวจ</>}
                </button>
                <button onClick={() => handleSubmit(false)} disabled={submitting}
                  className="btn-danger py-3">
                  <XCircle size={16} />ไม่ผ่าน
                </button>
              </div>

              <button onClick={() => { setSelected(null); setLoadingRecords([]); setElapsedMinutes(0); checkerStartRef.current = null; if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }}
                className="btn-secondary w-full">
                ยกเลิก
              </button>
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
