import { useState, useEffect } from 'react';
import { Scale, CheckCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatWeight } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WeighOut() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ grossWeight: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [tab, setTab] = useState('weigh');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchPending();
    fetchCompleted();
    const interval = setInterval(() => { fetchPending(); fetchCompleted(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try { const res = await api.get('/weigh-out/pending'); setPending(res.data.data || []); } catch {} finally { setPageLoading(false); }
  };

  const fetchCompleted = async () => {
    try { const res = await api.get('/weigh-out/today'); setCompleted(res.data.data || []); } catch {}
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
    if (net < 0) { toast.error('น้ำหนักหนักน้อยกว่าน้ำหนักเบา กรุณาตรวจสอบ'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/weigh-out', { tripId: selected.TripID, grossWeight: form.grossWeight, notes: form.notes });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelected(null);
        fetchPending();
        fetchCompleted();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  const grossWeight = parseFloat(form.grossWeight || 0);
  const tareWeight = parseFloat(selected?.TareWeight || 0);
  const netWeight = grossWeight - tareWeight;

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดรายการรอชั่งออก..." />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 items-center">
        <button onClick={() => setTab('weigh')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'weigh' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Scale size={14} className="inline mr-1" />บันทึกชั่งออก ({pending.length} รอ)
        </button>
        <button onClick={() => { setTab('done'); fetchCompleted(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'done' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <CheckCircle size={14} className="inline mr-1" />เสร็จสิ้นวันนี้ ({completed.length})
        </button>
        <button onClick={() => { fetchPending(); fetchCompleted(); }}
          className="ml-auto btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
          <RefreshCw size={13} />รีเฟรช
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
                    ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-900 font-bold">{trip.LicensePlate}</span>
                      <span className="text-slate-400 text-xs ml-2">#{trip.TripID}</span>
                      <div className="text-slate-500 text-xs mt-1">
                        {trip.VehicleType}{trip.DeliveryType ? ` | ${trip.DeliveryType}` : ''}{trip.WarehouseName ? ` | ${trip.WarehouseName}` : ''}
                      </div>
                      {trip.CustomerName && <div className="text-blue-500 text-xs">{trip.CustomerName}</div>}
                      {trip.PickDocumentNo && <div className="text-purple-500 text-xs font-mono">{trip.PickDocumentNo}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-cyan-500 text-sm">{formatWeight(trip.TareWeight)}</div>
                      <div className="text-slate-400 text-xs">น้ำหนักเบา</div>
                      <div className="text-amber-500 text-xs mt-1">
                        {trip.MinutesInWarehouse <= 0 ? 'เพิ่งเข้า'
                          : trip.MinutesInWarehouse < 60 ? `รอ ${trip.MinutesInWarehouse} นาที`
                          : `รอ ${Math.floor(trip.MinutesInWarehouse / 60)} ชั่วโมง ${trip.MinutesInWarehouse % 60} นาที`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!pending.length && (
                <p className="text-center text-slate-400 py-8">ไม่มีรถรอชั่งออก</p>
              )}
            </div>
          </div>

          {/* Weigh-out form */}
          <div className="card">
            <h3 className="card-header flex items-center gap-2">
              <Scale size={18} className="text-cyan-500" />บันทึกชั่งออก (ชั่งหนัก)
            </h3>

            {selected ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <div className="text-cyan-600 text-sm font-medium mb-2">รถที่เลือก</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">ทะเบียน:</span> <span className="text-slate-900 font-bold">{selected.LicensePlate}</span></div>
                    <div><span className="text-slate-500">น้ำหนักเบา:</span> <span className="text-cyan-600 font-bold">{formatWeight(selected.TareWeight)}</span></div>
                    <div><span className="text-slate-500">ลูกค้า:</span> <span className="text-slate-900">{selected.CustomerName || '-'}</span></div>
                    <div><span className="text-slate-500">คลัง:</span> <span className="text-slate-900">{selected.WarehouseName}</span></div>
                    {selected.PickDocumentNo && (
                      <div className="col-span-2">
                        <span className="text-slate-500">เอกสาร:</span>
                        <span className="text-purple-500 font-mono ml-2">{selected.PickDocumentNo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">น้ำหนักหนัก (กก.) *</label>
                  <input type="number" step="0.01" min="0" value={form.grossWeight}
                    onChange={e => setForm(p => ({ ...p, grossWeight: e.target.value }))}
                    className="input-field h-10 text-xl font-bold" placeholder="0.00" required autoFocus />
                </div>

                {/* Weight calculation */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-slate-500 text-xs mb-1">น้ำหนักหนัก</div>
                      <div className="text-slate-900 font-bold">{form.grossWeight ? grossWeight.toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">น้ำหนักเบา</div>
                      <div className="text-cyan-500 font-bold">{tareWeight > 0 ? tareWeight.toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">น้ำหนักสุทธิ</div>
                      <div className={`text-2xl font-bold ${form.grossWeight ? (netWeight >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-slate-300'}`}>
                        {form.grossWeight ? netWeight.toFixed(2) : '-'}
                      </div>
                      <div className="text-slate-400 text-xs">กก.</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">หมายเหตุ</label>
                  <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="input-field h-10 text-sm" placeholder="หมายเหตุ (ถ้ามี)" />
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={submitting || netWeight < 0} className="btn-success flex-1 py-3">
                    {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Scale size={16} />บันทึกชั่งออก</>}
                  </button>
                  <button type="button" onClick={() => setSelected(null)} className="btn-secondary px-6">ยกเลิก</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
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
                <tr className="border-b border-slate-200">
                  <th className="table-header text-left px-4 py-2">ทะเบียน</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">ลูกค้า</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักเบา</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักหนัก</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักสุทธิ</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">เวลาชั่งออก</th>
                  <th className="table-header text-right px-4 py-2 hide-mobile">เวลาทั้งหมด</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(t => (
                  <tr key={t.TripID} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-cell font-bold text-slate-900">
                      {t.LicensePlate}
                      <div className="text-xs text-slate-400">#{t.TripID}</div>
                    </td>
                    <td className="table-cell hide-mobile">{t.CustomerName || '-'}</td>
                    <td className="table-cell text-right text-slate-400">{formatWeight(t.TareWeight)}</td>
                    <td className="table-cell text-right text-slate-600">{formatWeight(t.GrossWeight)}</td>
                    <td className="table-cell text-right font-bold text-emerald-500">{formatWeight(t.NetWeight)}</td>
                    <td className="table-cell hide-mobile">{formatDateTime(t.WeighOutTime)}</td>
                    <td className="table-cell text-right hide-mobile text-slate-500 text-xs">
                      {t.TotalMinutes != null
                        ? t.TotalMinutes < 60
                          ? `${t.TotalMinutes} นาที`
                          : `${Math.floor(t.TotalMinutes / 60)} ชั่วโมง ${t.TotalMinutes % 60} นาที`
                        : '-'}
                    </td>
                  </tr>
                ))}
                {!completed.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีรายการเสร็จสิ้นวันนี้</td></tr>
                )}
              </tbody>
              {completed.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={4} className="table-cell text-right font-semibold text-slate-600">รวมน้ำหนักสุทธิ:</td>
                    <td className="table-cell text-right font-bold text-emerald-500 text-lg">
                      {formatWeight(completed.reduce((sum, t) => sum + (parseFloat(t.NetWeight) || 0), 0))}
                    </td>
                    <td className="table-cell hide-mobile" />
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
