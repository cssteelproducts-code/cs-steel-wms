import { useState, useEffect, useRef } from 'react';
import {
  Upload, Download, Trash2, RefreshCw, FileSpreadsheet,
  Calendar, TrendingDown, Package, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n, d = 1) => n != null && n !== '' ? parseFloat(n).toLocaleString('th-TH', { maximumFractionDigits: d }) : '-';

// Day Supply color coding: <15=red, <30=orange, <60=yellow, ≥60=green
const dsColor = (v) => {
  if (v == null || v === '') return 'text-slate-300';
  const n = parseFloat(v);
  if (n < 15)  return 'text-red-600 font-bold';
  if (n < 30)  return 'text-orange-500 font-bold';
  if (n < 60)  return 'text-yellow-600 font-semibold';
  return 'text-emerald-600 font-semibold';
};

const dsBg = (v) => {
  if (v == null || v === '') return '';
  const n = parseFloat(v);
  if (n < 15)  return 'bg-red-50';
  if (n < 30)  return 'bg-orange-50';
  if (n < 60)  return 'bg-yellow-50';
  return 'bg-emerald-50';
};

export default function DaySupply() {
  const fileRef = useRef();
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [data, setData]           = useState(null);  // { periods, pivot }
  const [showDetail, setShowDetail] = useState({});   // typeSUK → bool
  const [activeView, setActiveView] = useState('ds'); // 'ds' | 'stock' | 'sales'

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/day-supply');
      setData(res.data);
    } catch (err) {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/day-supply/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      toast.success(`บันทึก Period "${res.data.periodLabel}" สำเร็จ`);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'อัพโหลดไม่สำเร็จ';
      toast.error(msg);
    } finally { setUploading(false); }
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`ลบ Period "${label}" ?`)) return;
    try {
      await api.delete(`/day-supply/${id}`);
      toast.success('ลบสำเร็จ');
      await fetchData();
    } catch { toast.error('ลบไม่สำเร็จ'); }
  };

  const handleExportAll = () => {
    window.location.href = '/api/day-supply/export-all';
  };

  const periods  = data?.periods  || [];
  const pivot    = data?.pivot    || [];

  // Cell value accessor
  const cell = (typeSUK, periodLabel) => pivot.find(r => r.typeSUK === typeSUK)?.periods?.[periodLabel];

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Day Supply</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            อัพโหลด Stock.xlsx ทุกสัปดาห์ → ระบบสะสม Period อัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchData} disabled={loading}
            className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500 hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {periods.length > 0 && (
            <button onClick={handleExportAll}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
              <Download size={13} />Export ทุก Period
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60">
            {uploading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />ประมวลผล...</>
              : <><Upload size={14} />อัพโหลด Stock.xlsx</>}
          </button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { color: 'bg-red-100 text-red-700', label: '< 15 วัน — วิกฤต' },
          { color: 'bg-orange-100 text-orange-700', label: '15-29 วัน — ต่ำ' },
          { color: 'bg-yellow-100 text-yellow-700', label: '30-59 วัน — ปกติ' },
          { color: 'bg-emerald-100 text-emerald-700', label: '≥ 60 วัน — สูง' },
        ].map(l => (
          <span key={l.label} className={`px-2 py-0.5 rounded-full font-medium ${l.color}`}>{l.label}</span>
        ))}
      </div>

      {/* Empty state */}
      {!loading && periods.length === 0 && (
        <div className="card text-center py-20 text-slate-400">
          <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-base">ยังไม่มีข้อมูล</p>
          <p className="text-sm mt-1">อัพโหลด Stock.xlsx เพื่อเริ่มต้น</p>
          <button onClick={() => fileRef.current?.click()}
            className="mt-5 btn-primary text-sm px-6">
            <Upload size={14} />เลือกไฟล์
          </button>
        </div>
      )}

      {loading && (
        <div className="card text-center py-16">
          <span className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mx-auto block" />
        </div>
      )}

      {!loading && periods.length > 0 && (
        <>
          {/* Period list (history) */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="card-header m-0 flex items-center gap-2">
                <Calendar size={15} className="text-blue-500" />
                Period ที่บันทึก ({periods.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {periods.map(p => (
                <div key={p.PeriodID} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 text-sm">{p.PeriodLabel}</span>
                    <span className="text-xs text-slate-400 ml-2">({p.PeriodDays} วัน)</span>
                    <span className="text-xs text-slate-300 ml-2">↑ {p.FileName}</span>
                  </div>
                  <a href={`/api/day-supply/export/${p.PeriodID}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50" title="Export period นี้">
                    <Download size={14} />
                  </a>
                  <button onClick={() => handleDelete(p.PeriodID, p.PeriodLabel)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            {[
              { key: 'ds',    label: 'Day Supply (วัน)' },
              { key: 'stock', label: 'Stock NW (kg)' },
              { key: 'sales', label: 'ยอดขาย NW (kg)' },
            ].map(v => (
              <button key={v.key} onClick={() => setActiveView(v.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeView === v.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Main pivot table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm" style={{ minWidth: `${Math.max(500, 200 + periods.length * 130)}px` }}>
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="table-header whitespace-nowrap text-left px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                      ประเภทสินค้า (TypeSUK)
                    </th>
                    {periods.map(p => (
                      <th key={p.PeriodID} className="table-header whitespace-nowrap text-right px-3 py-3 min-w-[120px]">
                        {p.PeriodLabel}
                        <div className="text-[10px] font-normal text-slate-400">{p.PeriodDays} วัน</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivot.map((row, i) => {
                    const isOpen = showDetail[row.typeSUK];
                    return (
                      <>
                        <tr key={row.typeSUK}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-25'}`}>
                          <td className="px-4 py-2.5 sticky left-0 bg-white font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                            onClick={() => setShowDetail(p => ({ ...p, [row.typeSUK]: !p[row.typeSUK] }))}>
                            {isOpen ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />}
                            {row.typeSUK}
                          </td>
                          {periods.map(p => {
                            const c = cell(row.typeSUK, p.PeriodLabel);
                            const val = activeView === 'ds'    ? c?.daySupply
                                       : activeView === 'stock' ? c?.stockNW
                                       : c?.salesNW;
                            return (
                              <td key={p.PeriodID}
                                className={`px-3 py-2.5 text-right ${dsBg(activeView === 'ds' ? c?.daySupply : null)}`}>
                                <span className={activeView === 'ds' ? dsColor(c?.daySupply) : 'text-slate-700'}>
                                  {activeView === 'ds' ? fmt(val, 1) : fmt(val, 0)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                        {isOpen && (
                          <tr key={`${row.typeSUK}-detail`} className="bg-slate-50/70 border-b border-slate-100">
                            <td className="px-4 py-2 sticky left-0 bg-slate-50/70">
                              <div className="text-xs text-slate-500 space-y-0.5 pl-4">
                                <div>Stock NW (kg)</div>
                                <div>ยอดขาย NW (kg)</div>
                                <div>Day Supply (วัน)</div>
                              </div>
                            </td>
                            {periods.map(p => {
                              const c = cell(row.typeSUK, p.PeriodLabel);
                              return (
                                <td key={p.PeriodID} className="px-3 py-2 text-right">
                                  <div className="text-xs space-y-0.5">
                                    <div className="text-blue-600">{fmt(c?.stockNW, 0)}</div>
                                    <div className="text-orange-500">{fmt(c?.salesNW, 0)}</div>
                                    <div className={dsColor(c?.daySupply)}>{fmt(c?.daySupply, 1)}</div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary cards — latest period */}
          {periods.length > 0 && (
            <div className="card">
              <h3 className="card-header mb-3 flex items-center gap-2">
                <TrendingDown size={15} className="text-red-500" />
                Period ล่าสุด: {periods[periods.length - 1].PeriodLabel}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {pivot.map(row => {
                  const lastPeriod = periods[periods.length - 1];
                  const c = cell(row.typeSUK, lastPeriod.PeriodLabel);
                  const ds = c?.daySupply;
                  return (
                    <div key={row.typeSUK} className={`p-3 rounded-xl border text-center ${dsBg(ds)} border-slate-100`}>
                      <p className="text-xs text-slate-500 truncate mb-1">{row.typeSUK}</p>
                      <p className={`text-lg font-bold ${dsColor(ds)}`}>{fmt(ds, 1)}</p>
                      <p className="text-[10px] text-slate-400">วัน</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmt(c?.stockNW, 0)} kg stock
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
