import { useState, useEffect, useRef } from 'react';
import { Scale, CheckCircle, RefreshCw, Search, Edit2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatWeight } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PriorityBadge from '../components/PriorityBadge';

export default function WeighOut() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ grossWeight: '', notes: '' });
  const [editForm, setEditForm] = useState({ licensePlate: '', tareWeight: '', entryTime: '', custQuery: '', custName: '', customerId: null });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [tab, setTab] = useState('weigh');
  const [pageLoading, setPageLoading] = useState(true);

  // Customer search
  const [custResults, setCustResults] = useState([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const custTimer = useRef(null);

  useEffect(() => {
    fetchPending();
    fetchCompleted();
    fetchCustomers();
    const interval = setInterval(() => { fetchPending(); fetchCompleted(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchCustomers = async () => {
    try { const res = await api.get('/master/customers'); setAllCustomers(res.data.data || []); } catch {}
  };

  const fetchPending = async () => {
    try {
      const res = await api.get('/weigh-out/pending');
      setPending(res.data.data || []);
    } catch (err) {
      toast.error('โหลดรายการชั่งออกไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
    } finally { setPageLoading(false); }
  };

  const fetchCompleted = async () => {
    try { const res = await api.get('/weigh-out/today'); setCompleted(res.data.data || []); } catch {}
  };

  const selectTrip = (trip) => {
    setSelected(trip);
    setForm({ grossWeight: '', notes: '' });
    setEditForm({
      licensePlate: trip.LicensePlate || '',
      tareWeight: trip.TareWeight != null ? String(trip.TareWeight) : '',
      entryTime: trip.EntryTime || '',
      custQuery: trip.CustomerName || '',
      custName: trip.CustomerName || '',
      customerId: trip.CustomerID || null,
    });
    setCustResults([]);
    setShowCustDrop(false);
  };

  const handleCustInput = (val) => {
    setEditForm(p => ({ ...p, custQuery: val, custName: '', customerId: null }));
    clearTimeout(custTimer.current);
    if (!val.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    custTimer.current = setTimeout(() => {
      const q = val.toLowerCase();
      const filtered = allCustomers.filter(c =>
        c.ARCode?.toLowerCase().includes(q) || c.CustomerName?.toLowerCase().includes(q)
      ).slice(0, 8);
      setCustResults(filtered);
      setShowCustDrop(filtered.length > 0);
    }, 200);
  };

  const pickCustomer = (c) => {
    setEditForm(p => ({ ...p, custQuery: c.ARCode || '', custName: c.CustomerName, customerId: c.CustomerID }));
    setShowCustDrop(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || !form.grossWeight) return;
    const gross = parseFloat(form.grossWeight);
    const tare = parseFloat(editForm.tareWeight || selected.TareWeight || 0);
    const net = gross - tare;
    if (net < 0) { toast.error('น้ำหนักหนักน้อยกว่าน้ำหนักเบา กรุณาตรวจสอบ'); return; }
    setSubmitting(true);
    try {
      const payload = {
        tripId: selected.TripID,
        grossWeight: form.grossWeight,
        notes: form.notes,
      };
      // Only send overrides if changed
      if (editForm.licensePlate !== selected.LicensePlate) payload.overrideLicensePlate = editForm.licensePlate;
      if (String(editForm.tareWeight) !== String(selected.TareWeight ?? '')) payload.overrideTareWeight = editForm.tareWeight;
      if (editForm.customerId != null && editForm.customerId !== selected.CustomerID) payload.overrideCustomerId = editForm.customerId;
      if (editForm.entryTime !== (selected.EntryTime || '')) payload.overrideEntryTime = editForm.entryTime;

      const res = await api.post('/weigh-out', payload);
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
  const tareWeight = parseFloat(editForm.tareWeight || selected?.TareWeight || 0);
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
          className="ml-auto p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
          <RefreshCw size={15} />
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
                      <span className="ml-1"><PriorityBadge priority={trip.Priority} /></span>
                      {trip.Status && trip.Status !== 'WeighOut' && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">{trip.Status}</span>
                      )}
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
                {/* Editable trip info */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-1 text-cyan-600 text-xs font-semibold mb-1">
                    <Edit2 size={11} />แก้ไขข้อมูลก่อนบันทึก
                  </div>

                  {/* License plate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">ทะเบียนรถ</label>
                      <input type="text" value={editForm.licensePlate}
                        onChange={e => setEditForm(p => ({ ...p, licensePlate: e.target.value.toUpperCase() }))}
                        className="input-field h-9 text-sm font-bold tracking-widest uppercase" />
                    </div>
                    <div>
                      <label className="label text-xs">น้ำหนักเบา (กก.)</label>
                      <input type="number" step="0.01" value={editForm.tareWeight}
                        onChange={e => setEditForm(p => ({ ...p, tareWeight: e.target.value }))}
                        className="input-field h-9 text-sm" placeholder="0.00" />
                    </div>
                  </div>

                  {/* Entry time */}
                  <div>
                    <label className="label text-xs">เวลาเข้า (ชั่งเข้า)</label>
                    <input type="time" value={editForm.entryTime}
                      onChange={e => setEditForm(p => ({ ...p, entryTime: e.target.value }))}
                      className="input-field h-9 text-sm w-full" />
                  </div>

                  {/* Customer */}
                  <div className="relative">
                    <label className="label text-xs">ลูกค้า</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={editForm.custQuery}
                        onChange={e => handleCustInput(e.target.value)}
                        onBlur={() => setTimeout(() => setShowCustDrop(false), 150)}
                        className="input-field w-full pl-9 pr-3 h-9 text-sm"
                        placeholder="ค้นหาลูกค้า..." />
                      {showCustDrop && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                          {custResults.map(c => (
                            <button key={c.CustomerID} type="button" onMouseDown={() => pickCustomer(c)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                              <div className="text-sm font-semibold text-slate-900">{c.ARCode}</div>
                              <div className="text-xs text-slate-500">{c.CustomerName}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {editForm.custName && (
                      <div className="mt-1 text-xs text-cyan-700 px-2 py-1 rounded-lg bg-cyan-50 border border-cyan-200">
                        {editForm.custName}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 mt-1">{selected.WarehouseName} · #{selected.TripID}</div>
                </div>

                {/* Gross weight input */}
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
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">ยังไม่มีรายการเสร็จสิ้นวันนี้</td></tr>
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
