import { useState, useEffect } from 'react';
import { CheckSquare, XCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';

export default function Checker() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ isApproved: true, remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState([]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/checker/pending');
      setPending(res.data.data || []);
    } catch {}
  };

  const selectTrip = async (trip) => {
    setSelected(trip);
    setForm({ isApproved: true, remarks: '' });
    try {
      const res = await api.get(`/loading-station/trip/${trip.TripID}`);
      setLoadingRecords(res.data.data || []);
    } catch {}
  };

  const handleSubmit = async (approved) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await api.post('/checker', {
        tripId: selected.TripID,
        isApproved: approved,
        remarks: form.remarks
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelected(null);
        setLoadingRecords([]);
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const moveToChecker = async (tripId) => {
    try {
      await api.put(`/checker/move-to-checker/${tripId}`);
      toast.success('ย้ายไปสถานีเช็คเกอร์แล้ว');
      fetchPending();
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip list */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2">
              <Clock size={18} className="text-orange-400" />
              รอตรวจสอบ ({pending.length})
            </h3>
            <button onClick={fetchPending} className="text-blue-400 text-sm hover:text-blue-300">รีเฟรช</button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {pending.map(trip => (
              <div key={trip.TripID}
                onClick={() => selectTrip(trip)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                  ? 'border-orange-500 bg-orange-900/20'
                  : 'border-steel-600 hover:border-steel-500 bg-steel-700/30'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold">{trip.LicensePlate}</span>
                    <span className="text-steel-400 text-xs ml-2">#{trip.TripID}</span>
                    <div className="text-steel-400 text-xs mt-1">
                      {trip.VehicleType} | {trip.WarehouseName}
                    </div>
                    {trip.CustomerName && <div className="text-blue-400 text-xs">{trip.CustomerName}</div>}
                    {trip.PickDocumentNo && (
                      <div className="text-purple-400 text-xs font-mono mt-1">เอกสาร: {trip.PickDocumentNo}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-orange-400 text-sm font-medium">
                      {trip.MinutesInWarehouse} นาที
                    </div>
                    <div className="text-steel-500 text-xs">ในคลัง</div>
                  </div>
                </div>
              </div>
            ))}
            {!pending.length && (
              <p className="text-center text-steel-500 py-8">ไม่มีรถรอตรวจสอบ</p>
            )}
          </div>
        </div>

        {/* Checker form */}
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <CheckSquare size={18} className="text-orange-400" />ตรวจสอบรายการสินค้า
          </h3>

          {selected ? (
            <div className="space-y-4">
              {/* Trip info */}
              <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg p-4">
                <div className="text-orange-300 text-sm font-medium mb-2">รถที่เลือก</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-steel-400">ทะเบียน:</span> <span className="text-white font-bold">{selected.LicensePlate}</span></div>
                  <div><span className="text-steel-400">ประเภท:</span> <span className="text-white">{selected.VehicleType}</span></div>
                  <div><span className="text-steel-400">ลูกค้า:</span> <span className="text-white">{selected.CustomerName || '-'}</span></div>
                  <div><span className="text-steel-400">คลัง:</span> <span className="text-white">{selected.WarehouseName}</span></div>
                  {selected.PickDocumentNo && (
                    <div className="col-span-2">
                      <span className="text-steel-400">เอกสาร Pick:</span>
                      <span className="text-purple-400 font-mono ml-2">{selected.PickDocumentNo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading history */}
              {loadingRecords.length > 0 && (
                <div>
                  <p className="text-steel-400 text-xs mb-2 uppercase tracking-wider">ประวัติสถานีขึ้นสินค้า</p>
                  <div className="space-y-1">
                    {loadingRecords.map(r => (
                      <div key={r.RecordID} className="flex items-center justify-between text-sm px-3 py-2 bg-steel-700/30 rounded-lg">
                        <span className="text-white">{r.StationName}</span>
                        <div className="text-right text-xs">
                          <div className="text-steel-400">เข้า: {formatDateTime(r.EntryTime)}</div>
                          {r.ExitTime ? (
                            <div className="text-emerald-400">ออก: {formatDateTime(r.ExitTime)} ({r.DurationMinutes} นาที)</div>
                          ) : (
                            <div className="text-amber-400 animate-pulse">กำลังขึ้นสินค้า...</div>
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

              <button onClick={() => { setSelected(null); setLoadingRecords([]); }}
                className="btn-secondary w-full">
                ยกเลิก
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-steel-500">
              <CheckSquare size={48} className="mb-4 opacity-30" />
              <p>เลือกรถจากรายการด้านซ้ายเพื่อตรวจสอบ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
