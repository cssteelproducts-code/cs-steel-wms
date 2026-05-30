import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  ArrowRight, CheckCircle2, Circle, RefreshCw,
  ChevronRight, Truck, Star
} from 'lucide-react';

const PRIORITY_CONFIG = {
  URGENT: { label: 'ด่วนมาก', color: '#ef4444', bg: '#fef2f2' },
  HIGH:   { label: 'เร่งด่วน', color: '#f59e0b', bg: '#fffbeb' },
};
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import dayjs from 'dayjs';

const STEP_META = {
  PENDING:      { label: 'รอเริ่ม',           btn: 'เข้าสถานีต้นทาง',           color: '#6b7280', endpoint: 'source-entry' },
  SOURCE_ENTRY: { label: 'อยู่สถานีต้นทาง',   btn: 'ออกสถานีต้นทาง (บันทึกน้ำหนัก)', color: '#f59e0b', endpoint: 'source-exit', needsWeight: true },
  SOURCE_EXIT:  { label: 'กำลังขนส่ง',        btn: 'เข้าสถานีปลายทาง',          color: '#3b82f6', endpoint: 'dest-entry' },
  DEST_ENTRY:   { label: 'อยู่สถานีปลายทาง',  btn: 'ออกสถานีปลายทาง (เสร็จ)',   color: '#8b5cf6', endpoint: 'dest-exit' },
  COMPLETE:     { label: 'เสร็จสิ้น',          btn: null,                          color: '#10b981', endpoint: null },
};

const TIMELINE = [
  { label: 'เข้าสถานีต้นทาง',   field: 'SourceEntryTime' },
  { label: 'ออกสถานีต้นทาง',    field: 'SourceExitTime', extraFields: ['BundleCount', 'TotalWeightKg'] },
  { label: 'เข้าสถานีปลายทาง',  field: 'DestEntryTime' },
  { label: 'ออกสถานีปลายทาง',   field: 'DestExitTime' },
];

export default function TransferDriver() {
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
        setSelectedTripId(prev => prev && trips.find(t => t.TripID === prev) ? prev : trips[0].TripID);
      } else {
        setSelectedTripId(null);
      }
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
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
      if (trip.Status === 'DEST_ENTRY') {
        toast.success('บันทึกเสร็จสิ้น — รอบนี้เสร็จแล้ว!');
      } else {
        toast.success('บันทึกเวลาสำเร็จ');
      }
      await load();
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setActionLoading(false);
    }
  };

  const submitWeight = async (tripId) => {
    if (!weightForm.bundleCount || !weightForm.totalWeightKg) {
      toast.error('กรุณากรอกจำนวนมัดและน้ำหนักรวม');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/transfer/trips/${tripId}/source-exit`, {
        bundleCount: parseInt(weightForm.bundleCount),
        totalWeightKg: parseFloat(weightForm.totalWeightKg),
        notes: weightForm.notes || null,
      });
      toast.success('บันทึกน้ำหนักสำเร็จ');
      setShowWeight(false);
      setWeightForm({ bundleCount: '', totalWeightKg: '', notes: '' });
      await load();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(false);
    }
  };

  const trip = activeTrips.find(t => t.TripID === selectedTripId);
  const meta = trip ? STEP_META[trip.Status] : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner text="กำลังโหลด..." />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-black" style={{ color: '#111827' }}>งานของฉัน</h2>
          <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>บันทึกเวลาเข้า-ออกสถานี</p>
        </div>
        <button onClick={load}
          className="p-2.5 rounded-2xl transition-colors"
          style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <RefreshCw size={16} className={actionLoading ? 'animate-spin text-red-500' : 'text-gray-400'} />
        </button>
      </div>

      {/* ── Active trip ── */}
      {trip ? (
        <>
          {/* Multiple trip selector */}
          {activeTrips.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...activeTrips].sort((a, b) => {
                const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
                return (rank[a.Priority] ?? 2) - (rank[b.Priority] ?? 2);
              }).map(t => {
                const pc = PRIORITY_CONFIG[t.Priority];
                return (
                  <button key={t.TripID}
                    onClick={() => { setSelectedTripId(t.TripID); setShowWeight(false); }}
                    className="flex-shrink-0 flex items-center gap-1 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                    style={selectedTripId === t.TripID
                      ? { background: '#dc2626', color: '#fff' }
                      : pc
                        ? { background: pc.bg, color: pc.color, border: `1.5px solid ${pc.color}40` }
                        : { background: '#f3f4f6', color: '#6b7280' }}>
                    {pc && <Star size={10} fill="currentColor" />}
                    {t.JobCode} รอบ {t.TripNo}
                  </button>
                );
              })}
            </div>
          )}

          {/* Trip card */}
          <div className="rounded-3xl overflow-hidden"
            style={{ background: '#ffffff', border: '1.5px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            {/* Status bar */}
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ background: `${meta?.color}12`, borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta?.color }} />
                <span className="text-sm font-bold" style={{ color: meta?.color }}>{meta?.label}</span>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>รอบ {trip.TripNo}</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Job code + vehicle */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>งานหมายเลข</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-black" style={{ color: '#111827' }}>{trip.JobCode}</div>
                    {PRIORITY_CONFIG[trip.Priority] && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black"
                        style={{ background: PRIORITY_CONFIG[trip.Priority].bg, color: PRIORITY_CONFIG[trip.Priority].color }}>
                        <Star size={10} fill="currentColor" />
                        {PRIORITY_CONFIG[trip.Priority].label}
                      </span>
                    )}
                  </div>
                </div>
                {trip.VehiclePlate && (
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>รถ</div>
                    <div className="px-2 py-1 rounded-xl text-sm font-black" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                      {trip.VehicleCode ? `[${trip.VehicleCode}] ` : ''}{trip.VehiclePlate}
                    </div>
                  </div>
                )}
              </div>

              {/* Route */}
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: '#fef2f2' }}>
                  <div className="text-xs font-bold mb-0.5" style={{ color: '#9ca3af' }}>ต้นทาง</div>
                  <div className="text-sm font-black" style={{ color: '#dc2626' }}>{trip.SourceStationName}</div>
                </div>
                <ArrowRight size={18} className="flex-shrink-0 text-gray-200" />
                <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: '#eff6ff' }}>
                  <div className="text-xs font-bold mb-0.5" style={{ color: '#9ca3af' }}>ปลายทาง</div>
                  <div className="text-sm font-black" style={{ color: '#3b82f6' }}>{trip.DestStationName}</div>
                </div>
              </div>

              {/* Product */}
              <div className="p-3 rounded-2xl" style={{ background: '#f9fafb' }}>
                <div className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>สินค้าที่ขนย้าย</div>
                <div className="text-sm font-semibold" style={{ color: '#374151' }}>{trip.ProductDesc}</div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {TIMELINE.map(({ label, field, extraFields }, i) => {
                  const time = trip[field];
                  return (
                    <div key={i} className="flex items-start gap-3">
                      {time
                        ? <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                        : <Circle size={18} style={{ color: '#e5e7eb', flexShrink: 0, marginTop: 1 }} />}
                      <div className="flex-1">
                        <span className="text-sm font-semibold" style={{ color: time ? '#111827' : '#d1d5db' }}>
                          {label}
                        </span>
                        {extraFields && trip.BundleCount && (
                          <div className="flex gap-3 mt-0.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                              {trip.BundleCount} มัด
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                              {trip.TotalWeightKg} กก.
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

              {/* Action button */}
              {meta?.btn && trip.Status !== 'COMPLETE' && !showWeight && (
                <button onClick={() => advanceTrip(trip)} disabled={actionLoading}
                  className="w-full h-16 rounded-2xl text-base font-black text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: `linear-gradient(135deg,${meta.color},${meta.color}cc)`,
                    boxShadow: `0 6px 20px ${meta.color}40`
                  }}>
                  {actionLoading
                    ? <RefreshCw size={20} className="animate-spin" />
                    : <ChevronRight size={22} />}
                  {meta.btn}
                </button>
              )}

              {/* Weight input form */}
              {showWeight && (
                <div className="space-y-3 p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
                  <p className="text-sm font-bold" style={{ color: '#111827' }}>บันทึกน้ำหนักสินค้าที่ขนออก</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>จำนวนมัด *</label>
                      <input
                        type="number" inputMode="numeric"
                        value={weightForm.bundleCount}
                        onChange={e => setWeightForm(f => ({ ...f, bundleCount: e.target.value }))}
                        className="w-full h-12 px-3 rounded-xl text-xl font-black outline-none text-center"
                        style={{ border: '1.5px solid #e5e7eb', color: '#111827' }}
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>น้ำหนักรวม กก. *</label>
                      <input
                        type="number" inputMode="decimal"
                        value={weightForm.totalWeightKg}
                        onChange={e => setWeightForm(f => ({ ...f, totalWeightKg: e.target.value }))}
                        className="w-full h-12 px-3 rounded-xl text-xl font-black outline-none text-center"
                        style={{ border: '1.5px solid #e5e7eb', color: '#111827' }}
                        placeholder="0.0" />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={weightForm.notes}
                    onChange={e => setWeightForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#374151' }}
                    placeholder="หมายเหตุ (ถ้ามี)" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowWeight(false)}
                      className="flex-1 h-11 rounded-xl text-sm font-bold transition-colors"
                      style={{ background: '#f3f4f6', color: '#6b7280' }}>
                      ยกเลิก
                    </button>
                    <button onClick={() => submitWeight(trip.TripID)} disabled={actionLoading}
                      className="flex-1 h-11 rounded-xl text-sm font-black text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                      {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                      บันทึกและออก
                    </button>
                  </div>
                </div>
              )}

              {trip.Status === 'COMPLETE' && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span className="font-bold text-sm" style={{ color: '#10b981' }}>รอบนี้เสร็จสิ้นแล้ว</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* No active trip */
        <div className="text-center py-16 rounded-3xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
          <Truck size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-bold text-sm" style={{ color: '#9ca3af' }}>ยังไม่มีงานที่ถูกมอบหมาย</p>
          <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>รอสำนักงานมอบหมายงานให้</p>
        </div>
      )}
    </div>
  );
}
