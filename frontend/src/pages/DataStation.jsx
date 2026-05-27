import { useState, useEffect } from 'react';
import { FileText, Search, Check, Clock } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatDuration } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function DataStation() {
  const [pending, setPending] = useState([]);
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ targetStationId: '', pickDocumentNo: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPending();
    fetchStations();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/data-station/pending');
      setPending(res.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const fetchStations = async () => {
    try {
      const res = await api.get('/master/loading-stations');
      setStations(res.data.data || []);
    } catch {}
  };

  const selectTrip = (trip) => {
    setSelected(trip);
    setForm({ targetStationId: '', pickDocumentNo: '', notes: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api.post('/data-station', { tripId: selected.TripID, ...form });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelected(null);
        fetchPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const filtered = pending.filter(t =>
    t.LicensePlate?.includes(search.toUpperCase()) ||
    t.CustomerName?.includes(search)
  );

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดรายการรอ Data..." />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Trip list */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2">
              <Clock size={18} className="text-purple-500" />
              รออยู่ที่สถานี Data ({filtered.length})
            </h3>
            <button onClick={fetchPending} className="text-blue-500 text-sm hover:text-blue-600">รีเฟรช</button>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-8 py-2 text-sm" placeholder="ค้นหาทะเบียน / ลูกค้า..." />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map(trip => (
              <div key={trip.TripID}
                onClick={() => selectTrip(trip)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-900 font-bold">{trip.LicensePlate}</span>
                    <span className="text-slate-400 text-xs ml-2">#{trip.TripID}</span>
                    <div className="text-slate-500 text-xs mt-1">
                      {trip.VehicleType} | {trip.WarehouseName}
                    </div>
                    {trip.CustomerName && (
                      <div className="text-blue-500 text-xs">{trip.CustomerName}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-amber-500 text-sm font-medium">
                      {trip.WaitMinutes > 0 ? `รอ ${trip.WaitMinutes} นาที` : 'เพิ่งเข้า'}
                    </div>
                    <div className="text-slate-400 text-xs">{formatDateTime(trip.WeighDateTime)}</div>
                  </div>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <p className="text-center text-slate-400 py-8">ไม่มีรถรอที่สถานี Data</p>
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <FileText size={18} className="text-purple-500" />
            บันทึกรับเอกสาร Pick
          </h3>

          {selected ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected trip info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium mb-1">รถที่เลือก</div>
                <div className="text-slate-900 text-xl font-bold">{selected.LicensePlate}</div>
                <div className="text-slate-500 text-sm">
                  {selected.VehicleType} | {selected.WarehouseName} | {selected.CustomerName || '-'}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  ชั่งเข้า: {formatDateTime(selected.WeighDateTime)}
                </div>
              </div>

              <div>
                <label className="label">เลขที่เอกสาร Pick *</label>
                <input type="text" value={form.pickDocumentNo}
                  onChange={e => setForm(p => ({ ...p, pickDocumentNo: e.target.value }))}
                  className="input-field font-mono" placeholder="เลขที่เอกสาร Pick"
                  required autoFocus />
              </div>

              <div>
                <label className="label">สถานีที่ต้องไป</label>
                <select value={form.targetStationId}
                  onChange={e => setForm(p => ({ ...p, targetStationId: e.target.value }))}
                  className="input-field">
                  <option value="">-- เลือกสถานีขึ้นสินค้า --</option>
                  {stations.map(s => (
                    <option key={s.StationID} value={s.StationID}>
                      {s.StationName} {s.WarehouseName ? `(${s.WarehouseName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">หมายเหตุ</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field resize-none" rows={2} placeholder="หมายเหตุ (ถ้ามี)" />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="btn-success flex-1 py-3">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={16} />บันทึก</>}
                </button>
                <button type="button" onClick={() => setSelected(null)} className="btn-secondary px-6">ยกเลิก</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileText size={48} className="mb-4 opacity-30" />
              <p>เลือกรถจากรายการด้านซ้ายเพื่อบันทึก</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
