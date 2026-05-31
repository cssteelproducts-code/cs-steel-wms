import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Users, Clock, Plus, Trash2, BarChart2, RefreshCw, Download, Pencil, Check, X as XIcon, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function InputTime({ label, value, onChange }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <input type="time" value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm" />
    </div>
  );
}

function InputNum({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input-field text-sm" />
    </div>
  );
}

const toHrs = (min) => min <= 0 ? 0 : +(min / 60).toFixed(2);
const fmtHr = (h) => h <= 0 ? '-' : `${h.toFixed(2)} ชม.`;
const shiftLabel = (i) => String.fromCharCode(65 + i);

const DEFAULT_CONFIG = {
  s1: { start: '08:00', end: '17:00', emp: 10 },
  s2: [
    { start: '08:00', end: '17:00', emp: 6 },
    { start: '10:00', end: '19:00', emp: 4 },
  ],
};

function calcOT1(endTime, cfg) {
  const endMin = toMin(endTime);
  const cutoff = toMin(cfg.s1.end);
  if (endMin <= cutoff) return 0;
  return toHrs((endMin - cutoff) * cfg.s1.emp);
}

function calcShiftOTs(shiftEndTimes, cfg) {
  return cfg.s2.map((s, i) => {
    const actual = toMin(shiftEndTimes[i] ?? s.end);
    const cutoff = toMin(s.end);
    return actual > cutoff ? +toHrs((actual - cutoff) * s.emp).toFixed(2) : 0;
  });
}

function calcOT2(shiftEndTimes, cfg) {
  return +calcShiftOTs(shiftEndTimes, cfg).reduce((a, b) => a + b, 0).toFixed(2);
}

function defaultShiftEnds(cfg) {
  return cfg.s2.map(s => s.end);
}

export default function ShiftPlanning() {
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('records');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), endTime: '17:00', shiftEndTimes: DEFAULT_CONFIG.s2.map(s => s.end) });
  const [addMode, setAddMode] = useState('single');
  const [batchForm, setBatchForm] = useState({ fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), endTime: '17:00', shiftEndTimes: DEFAULT_CONFIG.s2.map(s => s.end) });
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [batchLoading, setBatchLoading] = useState(false);
  const cfgSaveTimer = useRef(null);
  const cfgInitialized = useRef(false);

  // Load config + records from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const [cfgRes, recRes] = await Promise.all([
          api.get('/shift-plan/config'),
          api.get('/shift-plan/records'),
        ]);
        if (cfgRes.data.data) setCfg(cfgRes.data.data);
        setRecords(recRes.data.data || []);
      } catch {}
      cfgInitialized.current = true;
      setLoading(false);
    })();
  }, []);

  // Auto-save config to DB (debounced 800ms) whenever cfg changes after init
  useEffect(() => {
    if (!cfgInitialized.current) return;
    clearTimeout(cfgSaveTimer.current);
    cfgSaveTimer.current = setTimeout(() => {
      api.put('/shift-plan/config', cfg).catch(() => {});
    }, 800);
  }, [cfg]);

  const updateShift = (i, key, val) => setCfg(c => ({
    ...c, s2: c.s2.map((s, idx) => idx === i ? { ...s, [key]: val } : s)
  }));
  const addShift = () => {
    setCfg(c => ({ ...c, s2: [...c.s2, { start: '08:00', end: '17:00', emp: 0 }] }));
    setForm(f => ({ ...f, shiftEndTimes: [...f.shiftEndTimes, '17:00'] }));
    setBatchForm(f => ({ ...f, shiftEndTimes: [...f.shiftEndTimes, '17:00'] }));
  };
  const removeShift = (i) => {
    setCfg(c => ({ ...c, s2: c.s2.filter((_, idx) => idx !== i) }));
    setForm(f => ({ ...f, shiftEndTimes: f.shiftEndTimes.filter((_, idx) => idx !== i) }));
    setBatchForm(f => ({ ...f, shiftEndTimes: f.shiftEndTimes.filter((_, idx) => idx !== i) }));
  };

  const addRecord = async () => {
    if (!form.date || !form.endTime) return;
    const ot1 = calcOT1(form.endTime, cfg);
    const ot2 = calcOT2(form.shiftEndTimes, cfg);
    const otEmpAuto = cfg.s2.filter((s, i) => toMin(form.shiftEndTimes[i] ?? s.end) > toMin(s.end)).reduce((sum, s) => sum + s.emp, 0);
    try {
      const res = await api.post('/shift-plan/records', { date: form.date, endTime: form.endTime, otEmp: otEmpAuto, otHrs1: ot1, otHrs2: ot2 });
      setRecords(r => [...r, ...res.data.data].sort((a, b) => a.date.localeCompare(b.date)));
      setForm(f => ({ ...f, endTime: '17:00', shiftEndTimes: defaultShiftEnds(cfg) }));
    } catch {}
  };

  const removeRecord = async (id) => {
    try {
      await api.delete(`/shift-plan/records/${id}`);
      setRecords(r => r.filter(x => x.id !== id));
    } catch {}
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditRow({ endTime: r.endTime, shiftEndTimes: defaultShiftEnds(cfg) });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    const ot1 = calcOT1(editRow.endTime, cfg);
    const ot2 = calcOT2(editRow.shiftEndTimes, cfg);
    const otEmpAuto = cfg.s2.filter((s, i) => toMin(editRow.shiftEndTimes[i] ?? s.end) > toMin(s.end)).reduce((sum, s) => sum + s.emp, 0);
    try {
      await api.put(`/shift-plan/records/${id}`, { endTime: editRow.endTime, otEmp: otEmpAuto, otHrs1: ot1, otHrs2: ot2 });
      setRecords(r => r.map(x => x.id === id ? { ...x, endTime: editRow.endTime, otEmp: otEmpAuto, otHrs2: ot2, otHrs1: ot1 } : x));
      setEditingId(null);
    } catch {}
  };

  const addBatchRecords = async () => {
    if (!batchForm.fromDate || !batchForm.toDate || !batchForm.endTime) return;
    const start = new Date(batchForm.fromDate);
    const end = new Date(batchForm.toDate);
    if (end < start) { alert('วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น'); return; }
    const existDates = new Set(records.map(r => r.date));
    const hasNew = (() => { for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { if (!existDates.has(d.toISOString().slice(0, 10))) return true; } return false; })();
    if (!hasNew) { alert('ไม่มีวันใหม่ (วันที่ซ้ำถูกข้ามแล้ว)'); return; }
    setBatchLoading(true);
    try {
      const ot1 = calcOT1(batchForm.endTime, cfg);
      const ot2 = calcOT2(batchForm.shiftEndTimes, cfg);
      const otEmpAuto = cfg.s2.filter((s, i) => toMin(batchForm.shiftEndTimes[i] ?? s.end) > toMin(s.end)).reduce((sum, s) => sum + s.emp, 0);
      const builtRecs = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        if (existDates.has(dateStr)) continue;
        builtRecs.push({ date: dateStr, endTime: batchForm.endTime, otEmp: otEmpAuto, otHrs1: ot1, otHrs2: ot2 });
      }
      const res = await api.post('/shift-plan/records', builtRecs);
      setRecords(r => [...r, ...res.data.data].sort((a, b) => a.date.localeCompare(b.date)));
    } catch {}
    finally { setBatchLoading(false); }
  };

  const clearAll = async () => {
    if (!confirm('ล้างข้อมูลทั้งหมด?')) return;
    try {
      await api.delete('/shift-plan/records');
      setRecords([]);
    } catch {}
  };

  const summary = useMemo(() => {
    const totalOT1 = records.reduce((s, r) => s + (r.otHrs1 || 0), 0);
    const totalOT2 = records.reduce((s, r) => s + (r.otHrs2 || 0), 0);
    return { totalOT1: +totalOT1.toFixed(2), totalOT2: +totalOT2.toFixed(2), diff: +(totalOT1 - totalOT2).toFixed(2), days: records.length };
  }, [records]);

  const chartData = records.map(r => ({
    date: r.date.slice(5),
    'OT แบบที่ 1': r.otHrs1,
    'OT แบบที่ 2': r.otHrs2,
  }));

  const exportExcel = () => {
    const rows = [['วันที่', 'เวลาเลิก', 'OT พนักงาน', 'OT แบบ 2 (ชม.)', 'OT แบบ 1 (ชม.)', 'ต่าง (ชม.)']];
    records.forEach(r => rows.push([r.date, r.endTime, r.otEmp, r.otHrs2, r.otHrs1, parseFloat((r.otHrs1 - r.otHrs2).toFixed(2))]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OT Compare');
    XLSX.writeFile(wb, 'shift_ot_compare.xlsx');
  };

  const totalS2Emp = cfg.s2.reduce((s, x) => s + (x.emp || 0), 0);
  const s2OTNote = cfg.s2.map((s, i) => `กะ ${shiftLabel(i)} หลัง ${s.end}`).join(', ');

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
      <Loader2 size={18} className="animate-spin" />โหลดข้อมูล...
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Users size={20} className="text-indigo-500 flex-shrink-0" />
            วางแผนกะพนักงาน
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">เปรียบเทียบค่า OT ระหว่างกะเดียว vs {cfg.s2.length} กะ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} />Export
          </button>
          <button onClick={clearAll} className="btn-secondary text-sm text-red-500 flex items-center gap-1.5">
            <RefreshCw size={14} />ล้างข้อมูล
          </button>
        </div>
      </div>

      {/* Config cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card border-2 border-blue-100">
          <p className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2"><Clock size={15} />แบบที่ 1 — กะเดียว</p>
          <div className="grid grid-cols-3 gap-3">
            <InputTime label="เวลาเริ่ม" value={cfg.s1.start} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, start: v } }))} />
            <InputTime label="เวลาเลิก" value={cfg.s1.end} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, end: v } }))} />
            <InputNum label="จำนวน (คน)" value={cfg.s1.emp} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, emp: +v } }))} />
          </div>
          <p className="text-xs text-blue-400 mt-2">OT เริ่มหลัง {cfg.s1.end} น.</p>
        </div>

        <div className="card border-2 border-orange-100">
          <p className="text-sm font-bold text-orange-600 mb-3 flex items-center gap-2">
            <Clock size={15} />แบบที่ 2 — {cfg.s2.length} กะ
          </p>
          <div className="space-y-2">
            {cfg.s2.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 relative group">
                <InputTime label={`กะ ${shiftLabel(i)} เริ่ม`} value={s.start} onChange={v => updateShift(i, 'start', v)} />
                <InputTime label={`กะ ${shiftLabel(i)} เลิก`} value={s.end} onChange={v => updateShift(i, 'end', v)} />
                <div className="flex gap-1.5 items-end">
                  <div className="flex-1">
                    <InputNum label={`กะ ${shiftLabel(i)} (คน)`} value={s.emp} onChange={v => updateShift(i, 'emp', +v)} />
                  </div>
                  {cfg.s2.length > 1 && (
                    <button onClick={() => removeShift(i)} className="mb-0.5 p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title={`ลบกะ ${shiftLabel(i)}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-orange-400">รวม {totalS2Emp} คน — OT {s2OTNote}</p>
            {cfg.s2.length < 6 && (
              <button onClick={addShift} className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
                <Plus size={12} />เพิ่มกะ {shiftLabel(cfg.s2.length)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'วันที่บันทึก', value: `${summary.days} วัน`, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'OT รวม แบบ 1', value: `${summary.totalOT1.toFixed(2)} ชม.`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'OT รวม แบบ 2', value: `${summary.totalOT2.toFixed(2)} ชม.`, color: 'text-orange-600', bg: 'bg-orange-50' },
          {
            label: summary.diff > 0 ? 'แบบ 1 OT มากกว่า' : 'แบบ 2 OT มากกว่า',
            value: `${Math.abs(summary.diff).toFixed(2)} ชม.`,
            color: summary.diff > 0 ? 'text-red-600' : 'text-emerald-600',
            bg: summary.diff > 0 ? 'bg-red-50' : 'bg-emerald-50'
          },
        ].map(s => (
          <div key={s.label} className={`card ${s.bg}`}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ key: 'records', label: 'บันทึกรายวัน' }, { key: 'chart', label: 'กราฟเปรียบเทียบ' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'records' && (
        <div className="card">
          <div className="flex gap-2 mb-3">
            {[{ key: 'single', label: 'ทีละวัน' }, { key: 'range', label: 'ช่วงวันที่ (หลายวัน)' }].map(m => (
              <button key={m.key} onClick={() => setAddMode(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${addMode === m.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {addMode === 'single' && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="label text-xs">วันที่</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label text-xs">เวลาเลิก (แบบ 1)</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field text-sm" />
                </div>
                <div className="text-xs text-blue-500 font-semibold flex items-end pb-2">
                  OT แบบ 1: {fmtHr(calcOT1(form.endTime, cfg))}
                </div>
                <div className="flex items-end">
                  <button onClick={addRecord} className="btn-primary w-full text-sm flex items-center gap-1.5">
                    <Plus size={14} />เพิ่ม
                  </button>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-1.5">
                  <Clock size={12} />กะแบบ 2 — กำหนดเวลาเลิกต่อกะ (ปล่อยไว้ = ปกติ / ไม่มี OT)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cfg.s2.map((s, i) => {
                    const shiftOT = calcShiftOTs(form.shiftEndTimes, cfg)[i];
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${shiftOT > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                        <span className="text-xs font-black text-orange-600 w-8">กะ {shiftLabel(i)}</span>
                        <span className="text-[10px] text-slate-400 w-12">{s.emp} คน</span>
                        <input type="time"
                          value={form.shiftEndTimes[i] ?? s.end}
                          onChange={e => setForm(f => { const t = [...f.shiftEndTimes]; t[i] = e.target.value; return { ...f, shiftEndTimes: t }; })}
                          className="input-field text-xs py-1 flex-1 min-w-0" />
                        <span className={`text-xs font-bold whitespace-nowrap ${shiftOT > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
                          {shiftOT > 0 ? `+${shiftOT.toFixed(2)}h` : 'ปกติ'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs font-bold text-orange-500 mt-2">
                  รวม OT แบบ 2: {calcOT2(form.shiftEndTimes, cfg).toFixed(2)} ชม.
                </p>
              </div>
            </div>
          )}

          {addMode === 'range' && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="label text-xs">วันเริ่มต้น</label>
                  <input type="date" value={batchForm.fromDate} onChange={e => setBatchForm(f => ({ ...f, fromDate: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label text-xs">วันสิ้นสุด</label>
                  <input type="date" value={batchForm.toDate} onChange={e => setBatchForm(f => ({ ...f, toDate: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label text-xs">เวลาเลิก (แบบ 1)</label>
                  <input type="time" value={batchForm.endTime} onChange={e => setBatchForm(f => ({ ...f, endTime: e.target.value }))} className="input-field text-sm" />
                </div>
                <div className="text-xs text-blue-500 font-semibold flex items-end pb-2">
                  OT แบบ 1: {fmtHr(calcOT1(batchForm.endTime, cfg))}
                </div>
              </div>
              <div className="border-t border-indigo-200 pt-3">
                <p className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-1.5">
                  <Clock size={12} />กะแบบ 2 — กำหนดเวลาเลิกต่อกะ (ทุกวันในช่วงนี้)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cfg.s2.map((s, i) => {
                    const shiftOT = calcShiftOTs(batchForm.shiftEndTimes, cfg)[i];
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${shiftOT > 0 ? 'border-orange-200 bg-orange-100/60' : 'border-indigo-200 bg-white'}`}>
                        <span className="text-xs font-black text-orange-600 w-8">กะ {shiftLabel(i)}</span>
                        <span className="text-[10px] text-slate-400 w-12">{s.emp} คน</span>
                        <input type="time"
                          value={batchForm.shiftEndTimes[i] ?? s.end}
                          onChange={e => setBatchForm(f => { const t = [...f.shiftEndTimes]; t[i] = e.target.value; return { ...f, shiftEndTimes: t }; })}
                          className="input-field text-xs py-1 flex-1 min-w-0" />
                        <span className={`text-xs font-bold whitespace-nowrap ${shiftOT > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
                          {shiftOT > 0 ? `+${shiftOT.toFixed(2)}h` : 'ปกติ'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs font-bold text-orange-500 mt-2">
                  รวม OT แบบ 2: {calcOT2(batchForm.shiftEndTimes, cfg).toFixed(2)} ชม. / วัน
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={addBatchRecords} disabled={batchLoading} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-70">
                  {batchLoading
                    ? <><Loader2 size={14} className="animate-spin" />กำลังเพิ่ม...</>
                    : <><Plus size={14} />เพิ่มทุกวันในช่วงนี้</>}
                </button>
                {batchForm.fromDate && batchForm.toDate && (
                  <span className="text-xs text-indigo-500">
                    {Math.max(0, Math.round((new Date(batchForm.toDate) - new Date(batchForm.fromDate)) / 86400000) + 1)} วัน
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="table-header text-left px-3 py-2">วันที่</th>
                  <th className="table-header text-center px-3 py-2">เวลาเลิก</th>
                  <th className="table-header text-center px-3 py-2">OT พนักงาน</th>
                  <th className="table-header text-right px-3 py-2 text-blue-600">OT แบบ 1 (ชม.)</th>
                  <th className="table-header text-right px-3 py-2 text-orange-600">OT แบบ 2 (ชม.)</th>
                  <th className="table-header text-right px-3 py-2">ต่าง (ชม.)</th>
                  <th className="table-header px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">ยังไม่มีข้อมูล — กรอกข้อมูลด้านบน</td></tr>
                ) : records.map(r => {
                  const isEditing = editingId === r.id;
                  const diff = +(r.otHrs1 - r.otHrs2).toFixed(2);
                  if (isEditing) {
                    const previewOT1 = calcOT1(editRow.endTime, cfg);
                    const shiftTimes = editRow.shiftEndTimes ?? defaultShiftEnds(cfg);
                    const previewShiftOTs = calcShiftOTs(shiftTimes, cfg);
                    const previewOT2 = calcOT2(shiftTimes, cfg);
                    return (
                      <tr key={r.id} className="border-b border-indigo-100 bg-indigo-50">
                        <td className="px-3 py-1.5 font-medium text-indigo-700">{r.date}</td>
                        <td className="px-3 py-1.5">
                          <input type="time" value={editRow.endTime} onChange={e => setEditRow(f => ({ ...f, endTime: e.target.value }))} className="input-field text-sm py-1 w-28" />
                        </td>
                        <td className="px-3 py-1.5 text-center text-xs text-slate-400">
                          {cfg.s2.filter((s, i) => previewShiftOTs[i] > 0).reduce((sum, s) => sum + s.emp, 0) || '-'} คน
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-blue-400">{fmtHr(previewOT1)}</td>
                        <td className="px-3 py-1.5">
                          <div className="space-y-1">
                            {cfg.s2.map((s, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-orange-500 w-7">กะ{shiftLabel(i)}</span>
                                <input type="time"
                                  value={shiftTimes[i] ?? s.end}
                                  onChange={e => setEditRow(f => { const t = [...(f.shiftEndTimes ?? defaultShiftEnds(cfg))]; t[i] = e.target.value; return { ...f, shiftEndTimes: t }; })}
                                  className="input-field text-xs py-0.5 w-24" />
                                <span className={`text-[10px] font-bold ${previewShiftOTs[i] > 0 ? 'text-orange-400' : 'text-slate-300'}`}>
                                  {previewShiftOTs[i] > 0 ? `+${previewShiftOTs[i]}h` : '-'}
                                </span>
                              </div>
                            ))}
                            <div className="text-[10px] font-bold text-orange-600">รวม {previewOT2.toFixed(2)} ชม.</div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-slate-400">-</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => saveEdit(r.id)} className="p-1 rounded text-emerald-500 hover:bg-emerald-100 transition-colors"><Check size={14} /></button>
                            <button onClick={cancelEdit} className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors"><XIcon size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.date}</td>
                      <td className="px-3 py-2 text-center">{r.endTime}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{r.otEmp || '-'} คน</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-600">{fmtHr(r.otHrs1)}</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600">{fmtHr(r.otHrs2)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${diff.toFixed(2)}` : diff < 0 ? diff.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(r)} className="p-1 rounded text-slate-300 hover:text-indigo-500 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => removeRecord(r.id)} className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-3 py-2 text-sm" colSpan={3}>รวม {summary.days} วัน</td>
                    <td className="px-3 py-2 text-right text-blue-700">{summary.totalOT1.toFixed(2)} ชม.</td>
                    <td className="px-3 py-2 text-right text-orange-700">{summary.totalOT2.toFixed(2)} ชม.</td>
                    <td className={`px-3 py-2 text-right ${summary.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {summary.diff > 0 ? `+${summary.diff.toFixed(2)}` : summary.diff.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div className="card">
          <h3 className="card-header mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-indigo-500" />เปรียบเทียบ OT รายวัน</h3>
          {records.length === 0 ? (
            <p className="text-center text-slate-400 py-10">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" ชม." />
                <Tooltip formatter={(v) => [`${v} ชม.`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="OT แบบที่ 1" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="OT แบบที่ 2" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {records.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-700 mb-2">สรุป</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-400">OT รวม แบบที่ 1</p>
                  <p className="text-xl font-bold text-blue-600">{summary.totalOT1.toFixed(2)} ชม.</p>
                  <p className="text-xs text-blue-400">เฉลี่ย {(summary.totalOT1 / summary.days).toFixed(2)} ชม./วัน</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-400">OT รวม แบบที่ 2</p>
                  <p className="text-xl font-bold text-orange-600">{summary.totalOT2.toFixed(2)} ชม.</p>
                  <p className="text-xs text-orange-400">เฉลี่ย {(summary.totalOT2 / summary.days).toFixed(2)} ชม./วัน</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${summary.diff > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <p className={`text-xs ${summary.diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {summary.diff > 0 ? 'ถ้าใช้แบบ 1 จะมี OT มากกว่า' : 'แบบ 1 ประหยัด OT กว่า'}
                  </p>
                  <p className={`text-xl font-bold ${summary.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {Math.abs(summary.diff).toFixed(2)} ชม.
                  </p>
                  <p className={`text-xs ${summary.diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    เฉลี่ย {(Math.abs(summary.diff) / summary.days).toFixed(2)} ชม./วัน
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
