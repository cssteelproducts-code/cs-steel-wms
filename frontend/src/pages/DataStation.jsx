import { useState, useEffect } from 'react';
import { FileText, Check, Clock, HourglassIcon, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatDuration } from '../utils/helpers';
import PriorityBadge from '../components/PriorityBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function DataStation() {
  const [pending, setPending] = useState([]);
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ stationIds: [], notes: '' });
  const [loading, setLoading] = useState(false);
  const [waitLoading, setWaitLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchPending();
    fetchStations();
    const pollInterval = setInterval(fetchPending, 15000);
    const tickInterval = setInterval(() => setTick(n => n + 1), 1000);
    return () => { clearInterval(pollInterval); clearInterval(tickInterval); };
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/data-station/pending');
      setPending(res.data.data || []);
    } catch {} finally { setPageLoading(false); }
  };

  const liveSOWaitSeconds = (trip) => {
    if (!trip.SOWaitStartedAt) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(trip.SOWaitStartedAt).getTime()) / 1000));
  };

  const fmtWait = (secs) => {
    if (secs === null) return null;
    if (secs < 60) return `${secs} วินาที`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} นาที`;
    return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
  };

  const fetchStations = async () => {
    try {
      const res = await api.get('/master/loading-stations');
      const sorted = (res.data.data || []).sort((a, b) =>
        a.StationName.localeCompare(b.StationName, undefined, { numeric: true })
      );
      setStations(sorted);
    } catch {}
  };

  const selectTrip = (trip) => {
    setSelected(trip);
    setForm({ stationIds: [], notes: '' });
  };

  const markWaitPick = async () => {
    if (!selected) return;
    setWaitLoading(true);
    try {
      const res = await api.put(`/data-station/${selected.TripID}/wait-pick`);
      if (res.data.success) {
        toast.success(`${selected.LicensePlate} — รอเอกสาร SO แล้ว`);
        const updated = { ...selected, Status: 'WaitPick', SOWaitStartedAt: new Date().toISOString(), SOWaitMinutes: 0 };
        setSelected(updated);
        fetchPending();
      }
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setWaitLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api.post('/data-station', { tripId: selected.TripID, stationIds: form.stationIds, notes: form.notes });
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
              รออยู่ที่สถานี Data ({pending.length})
            </h3>
            <button onClick={fetchPending} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors"><RefreshCw size={15} /></button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pending.map(trip => (
              <div key={trip.TripID}
                onClick={() => selectTrip(trip)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.TripID === trip.TripID
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 font-bold">{trip.LicensePlate}</span>
                      <span className="text-slate-400 text-xs">#{trip.TripID}</span>
                      <PriorityBadge priority={trip.Priority} />
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      {trip.VehicleType}{trip.DeliveryType && ` | ${trip.DeliveryType}`}{trip.WarehouseName && ` | ${trip.WarehouseName}`}
                    </div>
                    {trip.CustomerName && (
                      <div className="text-blue-500 text-xs">{trip.CustomerName}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-amber-500 text-sm font-medium">
                      {trip.WaitMinutes > 0
                        ? trip.WaitMinutes < 60
                          ? `รอ ${trip.WaitMinutes} นาที`
                          : `รอ ${Math.floor(trip.WaitMinutes / 60)} ชั่วโมง ${trip.WaitMinutes % 60} นาที`
                        : 'เพิ่งเข้า'}
                    </div>
                    <div className="text-slate-400 text-xs">{formatDateTime(trip.WeighDateTime)}</div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      {trip.Status === 'Data' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 font-medium">รอเอกสาร Pick</span>
                      )}
                      {trip.Status === 'WaitPick' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-medium">รอเอกสาร SO</span>
                      )}
                      {trip.Status === 'WaitPick' && liveSOWaitSeconds(trip) !== null && (
                        <span className="text-xs font-semibold text-rose-500">⏱ {fmtWait(liveSOWaitSeconds(trip))}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!pending.length && (
              <p className="text-center text-slate-400 py-8">ไม่มีรถรอที่สถานี Data</p>
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <FileText size={18} className="text-purple-500" />
            บันทึกจ่ายงานสถานีขึ้นสินค้า
          </h3>

          {selected ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected trip info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium mb-1">รถที่เลือก</div>
                <div className="text-slate-900 text-xl font-bold">{selected.LicensePlate}</div>
                <div className="text-slate-500 text-sm">
                  {selected.VehicleType} | {selected.DeliveryType || '-'} | {selected.WarehouseName}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  ชั่งเข้า: {formatDateTime(selected.WeighDateTime)}
                </div>
              </div>

              <div>
                <label className="label">สถานีที่ต้องไป <span className="text-slate-400 font-normal">(เลือกได้หลายสถานี)</span></label>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {stations.length === 0 ? (
                    <p className="text-slate-400 text-xs p-3">ยังไม่มีสถานี — เพิ่มในเมนูข้อมูลหลัก</p>
                  ) : stations.map(s => {
                    const checked = form.stationIds.includes(s.StationID);
                    return (
                      <label key={s.StationID}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setForm(p => ({
                            ...p,
                            stationIds: checked
                              ? p.stationIds.filter(id => id !== s.StationID)
                              : [...p.stationIds, s.StationID]
                          }))}
                          className="w-4 h-4 rounded accent-purple-600" />
                        <span className={`text-sm ${checked ? 'text-purple-700 font-medium' : 'text-slate-700'}`}>
                          {s.StationName}
                          {s.WarehouseName && <span className="text-slate-400 text-xs ml-1">({s.WarehouseName})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {form.stationIds.length > 0 && (
                  <p className="text-purple-600 text-xs mt-1">เลือก {form.stationIds.length} สถานี</p>
                )}
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
              {selected.Status !== 'WaitPick' && (
                <button type="button" onClick={markWaitPick} disabled={waitLoading}
                  className="w-full py-2.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                  {waitLoading
                    ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                    : <><HourglassIcon size={14} />รอเอกสาร SO</>}
                </button>
              )}
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
