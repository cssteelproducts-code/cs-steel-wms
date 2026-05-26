import { useState, useEffect } from 'react';
import { Scale, CheckCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatWeight } from '../utils/helpers';

export default function WeighOut() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ grossWeight: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [tab, setTab] = useState('weigh');

  useEffect(() => {
    fetchPending();
    fetchCompleted();
    const interval = setInterval(() => { fetchPending(); fetchCompleted(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/weigh-out/pending');
      setPending(res.data.data || []);
    } catch {}
  };

  const fetchCompleted = async () => {
    try {
      const res = await api.get('/weigh-out/today');
      setCompleted(res.data.data || []);
    } catch {}
  };

  const selectTrip = (trip) => {
    setSelected(trip);
    setForm({ grossWeight: '', notes: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || !form.grossWeight) return;

    const gross = parseFloat(form.grossWeight);
    const tare = parseFloat(selected.TareWeight || 0);
    const net = gross - tare;

    if (net < 0) {
      toast.error('น้ำหนักหนักน้อยกว่าน้ำหนักเบา กรุณาตรวจสอบ');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/weigh-out', {
        tripId: selected.TripID,
        grossWeight: form.grossWeight,
        notes: form.notes
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelected(null);
        fetchPending();
        fetchCompleted();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const grossWeight = parseFloat(form.grossWeight || 0);
  const tareWeight = parseFloat(selected?.TareWeight || 0);
  const netWeight = grossWeight - tareWeight;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('weigh')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'weigh' ? 'bg-blue-600 text-white' : 'bg-steel-700 text-steel-300 hover:text-white'}`}>
          <Scale size={14} className="inline mr-1" />บันทึกชั่งออก ({pending.length} รอ)
        </button>
        <button onClick={() => { setTab('done'); fetchCompleted(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'done' ? 'bg-emerald-600 text-white' : 'bg-steel-700 text-steel-300 hover:text-white'}`}>
          <CheckCircle size={14} className="inline mr-1" />เสร็จสิ้นวันนี้ ({completed.length})
        </button>
      </div>

      {tab === 'weigh' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending list */}
          <div className="card">
            <h3 className="card-header">รอชั่งออก ({pending.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pending.map(trip => (
                <div key={trip.TripID}
                  onClick={() => selectTrip(trip)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                    ? 'border-cyan-500 bg-cyan-900/20' : 'border-steel-600 hover:border-steel-500 bg-steel-700/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold">{trip.LicensePlate}</span>
                      <span className="text-steel-400 text-xs ml-2">#{trip.TripID}</span>
                      <div className="text-steel-400 text-xs mt-1">{trip.VehicleType} | {trip.WarehouseName}</div>
                      {trip.CustomerName && <div className="text-blue-400 text-xs">{trip.CustomerName}</div>}
                      {trip.PickDocumentNo && <div className="text-purple-400 text-xs font-mono">{trip.PickDocumentNo}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-cyan-400 text-sm">{formatWeight(trip.TareWeight)}</div>
                      <div className="text-steel-500 text-xs">น้ำหนักเบา</div>
                      <div className="text-amber-400 text-xs mt-1">{trip.MinutesInWarehouse} นาทีในคลัง</div>
                    </div>
                  </div>
                </div>
              ))}
              {!pending.length && (
                <p className="text-center text-steel-500 py-8">ไม่มีรถรอชั่งออก</p>
              )}
            </div>
          </div>

          {/* Weigh-out form */}
          <div className="card">
            <h3 className="card-header flex items-center gap-2">
              <Scale size={18} className="text-cyan-400" />บันทึกชั่งออก (ชั่งหนัก)
            </h3>

            {selected ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Trip info */}
                <div className="bg-cyan-900/20 border border-cyan-700/40 rounded-lg p-4">
                  <div className="text-cyan-300 text-sm font-medium mb-2">รถที่เลือก</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-steel-400">ทะเบียน:</span> <span className="text-white font-bold">{selected.LicensePlate}</span></div>
                    <div><span className="text-steel-400">น้ำหนักเบา:</span> <span className="text-cyan-400 font-bold">{formatWeight(selected.TareWeight)}</span></div>
                    <div><span className="text-steel-400">ลูกค้า:</span> <span className="text-white">{selected.CustomerName || '-'}</span></div>
                    <div><span className="text-steel-400">คลัง:</span> <span className="text-white">{selected.WarehouseName}</span></div>
                    {selected.PickDocumentNo && (
                      <div className="col-span-2">
                        <span className="text-steel-400">เอกสาร:</span>
                        <span className="text-purple-400 font-mono ml-2">{selected.PickDocumentNo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">น้ำหนักหนัก (Gross Weight) กิโลกรัม *</label>
                  <input type="number" step="0.01" min="0" value={form.grossWeight}
                    onChange={e => setForm(p => ({ ...p, grossWeight: e.target.value }))}
                    className="input-field text-2xl font-bold" placeholder="0.00" required autoFocus />
                </div>

                {/* Weight calculation */}
                {form.grossWeight && (
                  <div className="bg-steel-700/50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-steel-400 text-xs mb-1">น้ำหนักหนัก</div>
                        <div className="text-white font-bold">{grossWeight.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-steel-400 text-xs mb-1">น้ำหนักเบา</div>
                        <div className="text-cyan-400 font-bold">{tareWeight.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-steel-400 text-xs mb-1">น้ำหนักสุทธิ</div>
                        <div className={`text-2xl font-bold ${netWeight >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {netWeight.toFixed(2)}
                        </div>
                        <div className="text-steel-500 text-xs">กก.</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">หมายเหตุ</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="input-field resize-none" rows={2} placeholder="หมายเหตุ (ถ้ามี)" />
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={submitting || netWeight < 0} className="btn-success flex-1 py-3">
                    {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Scale size={16} />บันทึกชั่งออก</>}
                  </button>
                  <button type="button" onClick={() => setSelected(null)} className="btn-secondary px-6">ยกเลิก</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-steel-500">
                <Scale size={48} className="mb-4 opacity-30" />
                <p>เลือกรถจากรายการด้านซ้าย</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'done' && (
        <div className="card">
          <h3 className="card-header">เสร็จสิ้นวันนี้ ({completed.length} คัน)</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-steel-700">
                  <th className="table-header text-left px-4 py-2">ทะเบียน</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">ลูกค้า</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักเบา</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักหนัก</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักสุทธิ</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">เวลาชั่งออก</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(t => (
                  <tr key={t.TripID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
                    <td className="table-cell font-bold text-white">
                      {t.LicensePlate}
                      <div className="text-xs text-steel-500">#{t.TripID}</div>
                    </td>
                    <td className="table-cell hide-mobile">{t.CustomerName || '-'}</td>
                    <td className="table-cell text-right text-steel-400">{formatWeight(t.TareWeight)}</td>
                    <td className="table-cell text-right text-steel-300">{formatWeight(t.GrossWeight)}</td>
                    <td className="table-cell text-right font-bold text-emerald-400">{formatWeight(t.NetWeight)}</td>
                    <td className="table-cell hide-mobile">{formatDateTime(t.WeighOutTime)}</td>
                  </tr>
                ))}
                {!completed.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-steel-500">ยังไม่มีรายการเสร็จสิ้นวันนี้</td></tr>
                )}
              </tbody>
              {completed.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-steel-600">
                    <td colSpan={4} className="table-cell text-right font-semibold text-steel-300">รวมน้ำหนักสุทธิ:</td>
                    <td className="table-cell text-right font-bold text-emerald-400 text-lg">
                      {formatWeight(completed.reduce((sum, t) => sum + (parseFloat(t.NetWeight) || 0), 0))}
                    </td>
                    <td className="table-cell hide-mobile" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
