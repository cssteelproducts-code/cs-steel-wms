import { useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Upload, FileSpreadsheet, RefreshCw, Package, Weight, Warehouse, TrendingUp } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#65a30d','#c2410c','#1d4ed8'];

const fmt = (n, d = 2) => (typeof n === 'number' ? n.toLocaleString('th-TH', { maximumFractionDigits: d }) : '-');

function SummaryCard({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)} {p.dataKey === 'weight' ? 'ตัน' : 'ชิ้น'}
        </p>
      ))}
    </div>
  );
};

export default function StockReport() {
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeWh, setActiveWh] = useState(null); // filter by warehouse

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFileName(file.name);
    setLoading(true);
    setData(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/stock-report/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setData(res.data);
      toast.success('โหลดข้อมูลสำเร็จ');
    } catch (err) {
      toast.error(err.response?.data?.message || 'ไม่สามารถอ่านไฟล์ได้');
    } finally {
      setLoading(false);
    }
  };

  const filteredLocation = data?.locationTable?.filter(l => !activeWh || l.warehouse === activeWh) ?? [];

  return (
    <div className="space-y-4 pb-24">
      {/* Header + upload */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">รายงานสต็อกสินค้า</h1>
          {fileName && <p className="text-xs text-slate-400 mt-0.5">ไฟล์: {fileName}</p>}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={() => { setData(null); setFileName(''); setActiveWh(null); }}
              className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50">
              <RefreshCw size={14} />
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังประมวลผล...</>
              : <><Upload size={14} />อัพโหลด Excel</>}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!data && !loading && (
        <div className="card text-center py-20 text-slate-400">
          <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-base">อัพโหลดไฟล์ StockCard Excel</p>
          <p className="text-sm mt-1">รองรับไฟล์ .xlsx / .xls จาก ERP</p>
          <button onClick={() => fileRef.current?.click()}
            className="mt-5 btn-primary text-sm px-6">
            <Upload size={14} />เลือกไฟล์
          </button>
        </div>
      )}

      {loading && (
        <div className="card text-center py-20 text-slate-400">
          <span className="w-10 h-10 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mx-auto block mb-4" />
          <p className="text-sm">กำลังประมวลผลข้อมูล...</p>
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={Package} color="bg-blue-600" label="SKU ทั้งหมด"
              value={fmt(data.summary.skuCount, 0)} sub={`${fmt(data.summary.totalRows, 0)} แถว`} />
            <SummaryCard icon={Weight} color="bg-red-600" label="น้ำหนักรวม (ตัน)"
              value={fmt(data.summary.totalWeightTon)} sub={`${fmt(data.summary.totalQty, 0)} ชิ้น`} />
            <SummaryCard icon={TrendingUp} color="bg-emerald-600" label="รับเข้า (ตัน)"
              value={fmt(data.summary.movInWeightTon)} sub={`${fmt(data.summary.movInQty, 0)} ชิ้น`} />
            <SummaryCard icon={Warehouse} color="bg-orange-500" label="ยอดยกมา (ตัน)"
              value={fmt(data.summary.openingWeightTon)} sub={`${fmt(data.summary.openingQty, 0)} ชิ้น`} />
          </div>

          {/* Warehouse filter pills */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveWh(null)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!activeWh ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'}`}>
              ทุก Warehouse
            </button>
            {data.warehouseChart.map(w => (
              <button key={w.name} onClick={() => setActiveWh(activeWh === w.name ? null : w.name)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeWh === w.name ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'}`}>
                {w.name} ({fmt(w.weight, 1)} ต.)
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category bar chart */}
            <div className="card">
              <h3 className="card-header mb-4">น้ำหนักตามประเภทสินค้า (ตัน)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.categoryChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="weight" name="น้ำหนัก" radius={[0, 4, 4, 0]}>
                    {data.categoryChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Warehouse pie chart */}
            <div className="card">
              <h3 className="card-header mb-4">สัดส่วนตาม Warehouse (ตัน)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.warehouseChart} dataKey="weight" nameKey="name"
                    cx="50%" cy="45%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {data.warehouseChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${fmt(v)} ตัน`, 'น้ำหนัก']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Location table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="card-header">รายละเอียดตาม Location {activeWh ? `(${activeWh})` : ''}</h3>
              <span className="text-xs text-slate-400">{filteredLocation.length} ช่อง</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="table-header px-4 py-2 text-left">Warehouse</th>
                    <th className="table-header px-4 py-2 text-left">Location</th>
                    <th className="table-header px-4 py-2 text-right">จำนวน (ชิ้น)</th>
                    <th className="table-header px-4 py-2 text-right">น้ำหนัก (ตัน)</th>
                    <th className="table-header px-4 py-2 text-left">สินค้าหลัก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocation.slice(0, 100).map((l, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{l.warehouse}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{l.location}</td>
                      <td className="px-4 py-2 text-right">{fmt(l.qty, 0)}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-600">{fmt(l.weight)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 max-w-[200px] truncate">
                        {l.topItems.map(it => it.name).slice(0, 2).join(', ')}
                      </td>
                    </tr>
                  ))}
                  {filteredLocation.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
