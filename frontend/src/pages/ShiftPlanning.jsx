import { useState, useEffect, useMemo } from 'react';
import { Users, Clock, Plus, Trash2, BarChart2, RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHrs = (min) => min <= 0 ? 0 : +(min / 60).toFixed(2);
const fmtHr = (h) => h <= 0 ? '-' : `${h.toFixed(1)} ชม.`;

const DEFAULT_CONFIG = {
  s1: { start: '08:00', end: '17:00', emp: 10 },
  s2a: { start: '08:00', end: '17:00', emp: 6 },
  s2b: { start: '10:00', end: '19:00', emp: 4 },
};

const STORAGE_KEY = 'shiftplanning_v1';

function calcOT1(endTime, cfg) {
  const endMin = toMin(endTime);
  const cutoff = toMin(cfg.s1.end);
  if (endMin <= cutoff) return 0;
  return toHrs((endMin - cutoff) * cfg.s1.emp);
}

function calcOT2(endTime, cfg) {
  const endMin = toMin(endTime);
  const cutA = toMin(cfg.s2a.end);
  const cutB = toMin(cfg.s2b.end);
  const otA = endMin > cutA ? toHrs((endMin - cutA) * cfg.s2a.emp) : 0;
  const otB = endMin > cutB ? toHrs((endMin - cutB) * cfg.s2b.emp) : 0;
  return +(otA + otB).toFixed(2);
}

export default function ShiftPlanning() {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const [cfg, setCfg] = useState(stored.cfg || DEFAULT_CONFIG);
  const [records, setRecords] = useState(stored.records || []);
  const [tab, setTab] = useState('records');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), endTime: '17:00', otEmp: '', otHrs2: '' });
  const [addMode, setAddMode] = useState('single'); // 'single' | 'range'
  const [batchForm, setBatchForm] = useState({ fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), endTime: '17:00', otEmp: '', otHrs2: '' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cfg, records }));
  }, [cfg, records]);

  const addRecord = () => {
    if (!form.date || !form.endTime) return;
    const ot1 = calcOT1(form.endTime, cfg);
    const ot2 = parseFloat(form.otHrs2) || calcOT2(form.endTime, cfg);
    const newRec = { id: Date.now(), date: form.date, endTime: form.endTime, otEmp: parseInt(form.otEmp) || 0, otHrs2: ot2, otHrs1: ot1 };
    setRecords(r => [...r, newRec].sort((a, b) => a.date.localeCompare(b.date)));
    setForm(f => ({ ...f, endTime: '17:00', otEmp: '', otHrs2: '' }));
  };

  const removeRecord = (id) => setRecords(r => r.filter(x => x.id !== id));

  const addBatchRecords = () => {
    if (!batchForm.fromDate || !batchForm.toDate || !batchForm.endTime) return;
    const start = new Date(batchForm.fromDate);
    const end = new Date(batchForm.toDate);
    if (end < start) { alert('วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น'); return; }
    const existDates = new Set(records.map(r => r.date));
    const newRecs = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      if (existDates.has(dateStr)) continue;
      const ot1 = calcOT1(batchForm.endTime, cfg);
      const ot2 = parseFloat(batchForm.otHrs2) || calcOT2(batchForm.endTime, cfg);
      newRecs.push({ id: Date.now() + newRecs.length, date: dateStr, endTime: batchForm.endTime, otEmp: parseInt(batchForm.otEmp) || 0, otHrs2: ot2, otHrs1: ot1 });
    }
    if (!newRecs.length) { alert('ไม่มีวันใหม่ (วันที่ซ้ำถูกข้ามแล้ว)'); return; }
    setRecords(r => [...r, ...newRecs].sort((a, b) => a.date.localeCompare(b.date)));
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

  const exportCSV = () => {
    const rows = [['วันที่', 'เวลาเลิก', 'OT พนักงาน', 'OT แบบ 2 (ชม.)', 'OT แบบ 1 (ชม.)', 'ต่าง (ชม.)']];
    records.forEach(r => rows.push([r.date, r.endTime, r.otEmp, r.otHrs2, r.otHrs1, (r.otHrs1 - r.otHrs2).toFixed(2)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
    a.download = 'shift_ot_compare.csv'; a.click();
  };

  const InputTime = ({ label, value, onChange }) => (
    <div>
      <label className="label text-xs">{label}</label>
      <input type="time" value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm" />
    </div>
  );
  const InputNum = ({ label, value, onChange, placeholder }) => (
    <div>
      <label className="label text-xs">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input-field text-sm" />
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
          <p className="text-slate-500 text-xs mt-0.5">เปรียบเทียบค่า OT ระหว่างกะเดียว vs 2 กะ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} />Export CSV
          </button>
          <button onClick={() => { if (confirm('ล้างข้อมูลทั้งหมด?')) { setRecords([]); } }} className="btn-secondary text-sm text-red-500">
            <RefreshCw size={14} />ล้างข้อมูล
          </button>
        </div>
      </div>

      {/* Config cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* แบบที่ 1 */}
        <div className="card border-2 border-blue-100">
          <p className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2"><Clock size={15} />แบบที่ 1 — กะเดียว</p>
          <div className="grid grid-cols-3 gap-3">
            <InputTime label="เวลาเริ่ม" value={cfg.s1.start} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, start: v } }))} />
            <InputTime label="เวลาเลิก" value={cfg.s1.end} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, end: v } }))} />
            <InputNum label="จำนวน (คน)" value={cfg.s1.emp} onChange={v => setCfg(c => ({ ...c, s1: { ...c.s1, emp: +v } }))} />
          </div>
          <p className="text-xs text-blue-400 mt-2">OT เริ่มหลัง {cfg.s1.end} น.</p>
        </div>

        {/* แบบที่ 2 */}
        <div className="card border-2 border-orange-100">
          <p className="text-sm font-bold text-orange-600 mb-3 flex items-center gap-2"><Clock size={15} />แบบที่ 2 — 2 กะ</p>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3">
              <InputTime label="กะ A เริ่ม" value={cfg.s2a.start} onChange={v => setCfg(c => ({ ...c, s2a: { ...c.s2a, start: v } }))} />
              <InputTime label="กะ A เลิก" value={cfg.s2a.end} onChange={v => setCfg(c => ({ ...c, s2a: { ...c.s2a, end: v } }))} />
              <InputNum label="กะ A (คน)" value={cfg.s2a.emp} onChange={v => setCfg(c => ({ ...c, s2a: { ...c.s2a, emp: +v } }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <InputTime label="กะ B เริ่ม" value={cfg.s2b.start} onChange={v => setCfg(c => ({ ...c, s2b: { ...c.s2b, start: v } }))} />
              <InputTime label="กะ B เลิก" value={cfg.s2b.end} onChange={v => setCfg(c => ({ ...c, s2b: { ...c.s2b, end: v } }))} />
              <InputNum label="กะ B (คน)" value={cfg.s2b.emp} onChange={v => setCfg(c => ({ ...c, s2b: { ...c.s2b, emp: +v } }))} />
            </div>
          </div>
          <p className="text-xs text-orange-400 mt-2">รวม {cfg.s2a.emp + cfg.s2b.emp} คน — OT กะ A หลัง {cfg.s2a.end}, กะ B หลัง {cfg.s2b.end}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'วันที่บันทึก', value: `${summary.days} วัน`, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'OT รวม แบบ 1', value: `${summary.totalOT1.toFixed(1)} ชม.`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'OT รวม แบบ 2', value: `${summary.totalOT2.toFixed(1)} ชม.`, color: 'text-orange-600', bg: 'bg-orange-50' },
          {
            label: summary.diff > 0 ? 'แบบ 1 OT มากกว่า' : 'แบบ 2 OT มากกว่า',
            value: `${Math.abs(summary.diff).toFixed(1)} ชม.`,
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
          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            {[{ key: 'single', label: 'ทีละวัน' }, { key: 'range', label: 'ช่วงวันที่ (หลายวัน)' }].map(m => (
              <button key={m.key} onClick={() => setAddMode(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${addMode === m.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Add single */}
          {addMode === 'single' && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
              <div>
                <label className="label text-xs">วันที่</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field text-sm" />
              </div>
              <div>
                <label className="label text-xs">เวลาเลิกงาน</label>
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field text-sm" />
              </div>
              <InputNum label="OT พนักงาน (แบบ 2)" value={form.otEmp} onChange={v => setForm(f => ({ ...f, otEmp: v }))} placeholder="คน" />
              <div>
                <label className="label text-xs">OT ชม. (แบบ 2) — ว่างไว้=คำนวณ</label>
                <input type="number" step="0.5" min="0" value={form.otHrs2} onChange={e => setForm(f => ({ ...f, otHrs2: e.target.value }))}
                  placeholder={`≈ ${calcOT2(form.endTime, cfg)} ชม.`} className="input-field text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={addRecord} className="btn-primary w-full text-sm flex items-center gap-1.5">
                  <Plus size={14} />เพิ่ม
                </button>
              </div>
            </div>
          )}

          {/* Add range */}
          {addMode === 'range' && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="label text-xs">วันเริ่มต้น</label>
                  <input type="date" value={batchForm.fromDate} onChange={e => setBatchForm(f => ({ ...f, fromDate: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label text-xs">วันสิ้นสุด</label>
                  <input type="date" value={batchForm.toDate} onChange={e => setBatchForm(f => ({ ...f, toDate: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label text-xs">เวลาเลิกงาน (ทุกวัน)</label>
                  <input type="time" value={batchForm.endTime} onChange={e => setBatchForm(f => ({ ...f, endTime: e.target.value }))} className="input-field text-sm" />
                </div>
                <InputNum label="OT พนักงาน (แบบ 2)" value={batchForm.otEmp} onChange={v => setBatchForm(f => ({ ...f, otEmp: v }))} placeholder="คน" />
                <div>
                  <label className="label text-xs">OT ชม. (แบบ 2) — ว่างไว้=คำนวณ</label>
                  <input type="number" step="0.5" min="0" value={batchForm.otHrs2} onChange={e => setBatchForm(f => ({ ...f, otHrs2: e.target.value }))}
                    placeholder={`≈ ${calcOT2(batchForm.endTime, cfg)} ชม.`} className="input-field text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={addBatchRecords} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus size={14} />เพิ่มทุกวันในช่วงนี้
                </button>
                {batchForm.fromDate && batchForm.toDate && (
                  <span className="text-xs text-indigo-500">
                    {Math.max(0, Math.round((new Date(batchForm.toDate) - new Date(batchForm.fromDate)) / 86400000) + 1)} วัน
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Table */}
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
                  const diff = +(r.otHrs1 - r.otHrs2).toFixed(2);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{r.date}</td>
                      <td className="px-3 py-2 text-center">{r.endTime}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{r.otEmp || '-'} คน</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-600">{fmtHr(r.otHrs1)}</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600">{fmtHr(r.otHrs2)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0'}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeRecord(r.id)} className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-3 py-2 text-sm" colSpan={3}>รวม {summary.days} วัน</td>
                    <td className="px-3 py-2 text-right text-blue-700">{summary.totalOT1.toFixed(1)} ชม.</td>
                    <td className="px-3 py-2 text-right text-orange-700">{summary.totalOT2.toFixed(1)} ชม.</td>
                    <td className={`px-3 py-2 text-right ${summary.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {summary.diff > 0 ? `+${summary.diff}` : summary.diff}
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
                  <p className="text-xl font-bold text-blue-600">{summary.totalOT1.toFixed(1)} ชม.</p>
                  <p className="text-xs text-blue-400">เฉลี่ย {(summary.totalOT1 / summary.days).toFixed(1)} ชม./วัน</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-400">OT รวม แบบที่ 2</p>
                  <p className="text-xl font-bold text-orange-600">{summary.totalOT2.toFixed(1)} ชม.</p>
                  <p className="text-xs text-orange-400">เฉลี่ย {(summary.totalOT2 / summary.days).toFixed(1)} ชม./วัน</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${summary.diff > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <p className={`text-xs ${summary.diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {summary.diff > 0 ? 'ถ้าใช้แบบ 1 จะมี OT มากกว่า' : 'แบบ 1 ประหยัด OT กว่า'}
                  </p>
                  <p className={`text-xl font-bold ${summary.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {Math.abs(summary.diff).toFixed(1)} ชม.
                  </p>
                  <p className={`text-xs ${summary.diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    เฉลี่ย {(Math.abs(summary.diff) / summary.days).toFixed(1)} ชม./วัน
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
