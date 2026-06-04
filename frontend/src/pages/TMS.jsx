import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, Upload, FileSpreadsheet, Search, RefreshCw, Trash2,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  Route, Package, Weight, Ruler, MapPin, Plus, Play, Layers,
  ArrowRight, Info, Check, X
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useLang } from '../context/LanguageContext';
import DeliveryPlan from './DeliveryPlan';

const TABS = [
  { id: 'orders',   icon: FileSpreadsheet, label: 'คำสั่งส่ง' },
  { id: 'assign',   icon: Truck,           label: 'จัดรถ' },
  { id: 'routes',   icon: Route,           label: 'วางแผนเส้นทาง' },
  { id: 'diagram',  icon: Layers,          label: 'แผนผังบรรทุก' },
  { id: 'delivery', icon: MapPin,          label: 'แผนจัดส่ง' },
];

const STATUS_COLORS = {
  PENDING: 'bg-slate-100 text-slate-600',
  PLANNED: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-emerald-100 text-emerald-700',
};

// ─── Loading Diagram SVG Component ───────────────────────────────────────────
function LoadingDiagram({ bed, placed, unplaced, summary }) {
  if (!bed) return null;
  const SVG_W = 640, SVG_H = 260;
  const PAD = 40;
  const scaleX = (SVG_W - PAD * 2) / bed.length;
  const scaleY = (SVG_H - PAD * 2) / bed.width;
  const tx = x => PAD + x * scaleX;
  const ty = y => PAD + y * scaleY;

  const frontPct = summary.totalWeightKg > 0 ? Math.round(summary.frontWeightKg / summary.totalWeightKg * 100) : 50;
  const balanced = frontPct >= 35 && frontPct <= 65;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'น้ำหนักรวม', value: `${summary.totalWeightKg.toLocaleString()} kg`, color: 'text-slate-700' },
          { label: 'บรรทุก', value: summary.utilPct != null ? `${summary.utilPct}%` : 'N/A', color: summary.utilPct > 90 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'หน้า (แคป)', value: `${summary.frontWeightKg} kg`, color: 'text-blue-600' },
          { label: 'หลัง (ท้าย)', value: `${summary.rearWeightKg} kg`, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="card py-3 px-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weight balance bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">การกระจายน้ำหนัก</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {balanced ? '✓ สมดุล' : '⚠ ควรปรับ'}
          </span>
        </div>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div className="bg-blue-400 flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${frontPct}%` }}>
            {frontPct}%
          </div>
          <div className="bg-orange-400 flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${100 - frontPct}%` }}>
            {100 - frontPct}%
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>← หน้า (แคป)</span>
          <span>หลัง (ท้ายรถ) →</span>
        </div>
      </div>

      {/* SVG top-view diagram */}
      <div className="card overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">ผังการจัดวางสินค้า (มองจากด้านบน)</h4>
          <div className="text-xs text-slate-500">{bed.plate} | กระบะ {bed.length}m × {bed.width}m</div>
        </div>
        <svg width={SVG_W} height={SVG_H} className="block" style={{ minWidth: SVG_W }}>
          {/* Truck bed outline */}
          <rect x={PAD} y={PAD} width={SVG_W - PAD * 2} height={SVG_H - PAD * 2}
            fill="#f8fafc" stroke="#334155" strokeWidth={2} rx={4} />
          {/* Cab indicator */}
          <rect x={SVG_W - PAD - 20} y={PAD} width={20} height={SVG_H - PAD * 2}
            fill="#94a3b8" rx={2} />
          <text x={SVG_W - PAD - 10} y={SVG_H / 2} textAnchor="middle" fontSize={9}
            fill="white" transform={`rotate(-90,${SVG_W - PAD - 10},${SVG_H / 2})`}>CAB</text>
          {/* Axle lines */}
          {[0.25, 0.75].map((pct, i) => (
            <line key={i} x1={tx(pct * bed.length)} y1={PAD - 8} x2={tx(pct * bed.length)} y2={SVG_H - PAD + 8}
              stroke="#64748b" strokeWidth={1.5} strokeDasharray="4,3" />
          ))}
          <text x={tx(0.25 * bed.length)} y={PAD - 12} textAnchor="middle" fontSize={9} fill="#64748b">เพลาหน้า</text>
          <text x={tx(0.75 * bed.length)} y={PAD - 12} textAnchor="middle" fontSize={9} fill="#64748b">เพลาหลัง</text>

          {/* Placed items */}
          {placed.map((item, idx) => {
            const iw = item.width * scaleY;
            const il = item.length * scaleX;
            return (
              <g key={item.id}>
                <rect x={tx(item.x)} y={ty(item.y)} width={Math.max(il - 1, 4)} height={Math.max(iw - 1, 4)}
                  fill={item.color} fillOpacity={0.75} stroke={item.color} strokeWidth={1.5} rx={2} />
                {il > 30 && iw > 14 && (
                  <text x={tx(item.x) + il / 2} y={ty(item.y) + iw / 2 + 4}
                    textAnchor="middle" fontSize={Math.min(9, iw / 2)} fill="white" fontWeight="bold">
                    {item.label?.slice(0, 10)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Dimensions */}
          <text x={PAD + (SVG_W - PAD * 2) / 2} y={SVG_H - 6} textAnchor="middle" fontSize={10} fill="#64748b">
            ← {bed.length} ม. →
          </text>
          <text x={12} y={PAD + (SVG_H - PAD * 2) / 2} textAnchor="middle" fontSize={10} fill="#64748b"
            transform={`rotate(-90,12,${PAD + (SVG_H - PAD * 2) / 2})`}>
            ← {bed.width} ม. →
          </text>
        </svg>

        {/* Legend */}
        {placed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Map(placed.map(p => [p.orderId, p])).values()].map(p => (
              <div key={p.orderId} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded" style={{ background: p.color }} />
                <span className="text-slate-600">{p.custName?.slice(0, 20)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unplaced items */}
      {unplaced.length > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 mb-2">⚠ สินค้าที่ไม่สามารถจัดวางได้ ({unplaced.length} รายการ)</p>
          {unplaced.map((u, i) => (
            <div key={i} className="text-xs text-amber-600">{u.label} — {u.reason}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Constraint Check Bar ─────────────────────────────────────────────────────
function ConstraintBar({ label, actual, limit, unit, ok }) {
  const pct = limit > 0 ? Math.min(Math.round(actual / limit * 100), 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-bold ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
          {actual.toLocaleString()} / {limit ? limit.toLocaleString() : '∞'} {unit}
          {ok ? ' ✓' : ' ✗'}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Main TMS Page ────────────────────────────────────────────────────────────
export default function TMS() {
  const { t } = useLang();
  const fileRef = useRef(null);

  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [orderLines, setOrderLines] = useState({});
  const [selectedOrders, setSelectedOrders] = useState(new Set());

  // Vehicle assignment
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [reqSummary, setReqSummary] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Route planning
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [driverNames, setDriverNames] = useState({});

  // Loading diagram
  const [diagramData, setDiagramData] = useState(null);
  const [loadingDiagram, setLoadingDiagram] = useState(false);
  const [diagramVehicleId, setDiagramVehicleId] = useState('');
  const [allVehicles, setAllVehicles] = useState([]);

  // ── fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterSearch.trim()) params.set('search', filterSearch.trim());
      const res = await api.get(`/tms/orders?${params}`);
      setOrders(res.data.data || []);
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoadingOrders(false); }
  }, [filterStatus, filterSearch]);

  const fetchPlans = async () => {
    try { const res = await api.get('/tms/plans'); setPlans(res.data.data || []); } catch {}
  };

  const fetchAllVehicles = async () => {
    try {
      const res = await api.post('/tms/suitable-vehicles', { totalWeightKg: 0, maxLengthM: 0, maxWidthM: 0 });
      setAllVehicles(res.data.data || []);
    } catch {}
  };

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => { if (activeTab === 'routes') fetchPlans(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'diagram') fetchAllVehicles(); }, [activeTab]);

  // ── import Excel ──────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/tms/import', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      toast.success(res.data.message);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ'); }
    finally { setImporting(false); }
  };

  const handleDeleteOrder = async (id) => {
    if (!confirm('ลบคำสั่งส่งนี้?')) return;
    try { await api.delete(`/tms/orders/${id}`); setOrders(o => o.filter(x => x.TmsOrderID !== id)); setSelectedOrders(s => { const n = new Set(s); n.delete(id); return n; }); } catch {}
  };

  const handleClearAll = async () => {
    if (!confirm('ลบคำสั่งส่งทั้งหมด?')) return;
    try { await api.delete('/tms/orders'); setOrders([]); setSelectedOrders(new Set()); } catch {}
  };

  // ── expand order lines ────────────────────────────────────────────────────
  const toggleExpand = async (id) => {
    const next = new Set(expandedOrders);
    if (next.has(id)) { next.delete(id); setExpandedOrders(next); return; }
    next.add(id);
    setExpandedOrders(next);
    if (!orderLines[id]) {
      try {
        const res = await api.get(`/tms/orders/${id}/lines`);
        setOrderLines(p => ({ ...p, [id]: res.data.data || [] }));
      } catch {}
    }
  };

  // ── select / deselect ─────────────────────────────────────────────────────
  const toggleSelect = (id) => setSelectedOrders(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    const visible = filtered.map(o => o.TmsOrderID);
    setSelectedOrders(selectedOrders.size === visible.length ? new Set() : new Set(visible));
  };

  // ── vehicle assignment ────────────────────────────────────────────────────
  const checkLoad = async () => {
    if (!selectedOrders.size) { toast.error('เลือกคำสั่งส่งก่อน'); return; }
    const sel = orders.filter(o => selectedOrders.has(o.TmsOrderID));
    const totalWt = sel.reduce((s, o) => s + (parseFloat(o.TotalWeightKg) || 0), 0);
    const maxLen = Math.max(...sel.map(o => parseFloat(o.MaxItemLength) || 0), 0);
    const maxWid = Math.max(...sel.map(o => parseFloat(o.MaxItemWidth) || 0), 0);
    const summary = { totalWeightKg: totalWt, maxLengthM: maxLen, maxWidthM: maxWid, orderCount: sel.length };
    setReqSummary(summary);
    setLoadingVehicles(true);
    setSelectedVehicle(null);
    try {
      const res = await api.post('/tms/suitable-vehicles', summary);
      setVehicles(res.data.data || []);
    } catch { toast.error('ไม่สามารถโหลดข้อมูลรถได้'); }
    finally { setLoadingVehicles(false); }
    setActiveTab('assign');
  };

  // ── route optimization ────────────────────────────────────────────────────
  const createPlanAndOptimize = async () => {
    if (!selectedOrders.size) { toast.error('เลือกคำสั่งส่งก่อน'); return; }
    if (!selectedVehicle && vehicles.filter(v => v.canLoad).length === 0) { toast.error('ไม่มีรถที่เหมาะสม'); return; }
    setOptimizing(true);
    try {
      // Create plan
      const pRes = await api.post('/tms/plans', { planDate: new Date().toISOString().slice(0, 10) });
      const planId = pRes.data.planId;

      // Build vehicle list
      const vList = selectedVehicle ? [selectedVehicle] : vehicles.filter(v => v.canLoad).slice(0, 3);
      const vehiclePayload = vList.map(v => ({
        vehicleId: v.VehicleID,
        licensePlate: v.LicensePlate,
        driverName: driverNames[v.VehicleID] || '',
        payloadKg: v.PayloadKg,
        bedLength: v.BedLength,
        bedWidth: v.BedWidth,
      }));

      const optRes = await api.post(`/tms/plans/${planId}/optimize`, {
        orderIds: [...selectedOrders],
        vehicles: vehiclePayload,
      });
      toast.success(optRes.data.message);
      const detailRes = await api.get(`/tms/plans/${planId}`);
      setCurrentPlan(detailRes.data.data.plan);
      setPlanDetail(detailRes.data.data);
      setActiveTab('routes');
      fetchPlans();
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setOptimizing(false); }
  };

  // ── loading diagram ───────────────────────────────────────────────────────
  const generateDiagram = async () => {
    if (!diagramVehicleId || !selectedOrders.size) { toast.error('เลือกรถและคำสั่งส่งก่อน'); return; }
    setLoadingDiagram(true);
    try {
      const res = await api.post('/tms/loading-diagram', { vehicleId: parseInt(diagramVehicleId), orderIds: [...selectedOrders] });
      setDiagramData(res.data);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setLoadingDiagram(false); }
  };

  const filtered = orders.filter(o => {
    if (filterStatus !== 'ALL' && o.Status !== filterStatus) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      return (o.CustName || '').toLowerCase().includes(q) ||
             (o.SourceOrderNo || '').toLowerCase().includes(q) ||
             (o.Province || '').toLowerCase().includes(q);
    }
    return true;
  });

  const selOrders = orders.filter(o => selectedOrders.has(o.TmsOrderID));
  const reqTotalWt = selOrders.reduce((s, o) => s + (parseFloat(o.TotalWeightKg) || 0), 0);
  const reqMaxLen = Math.max(...selOrders.map(o => parseFloat(o.MaxItemLength) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Truck size={20} className="text-red-600 flex-shrink-0" />
            ระบบวางแผนขนส่ง (TMS)
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">นำเข้าคำสั่งส่ง → จัดรถ → วางเส้นทาง → แผนผังบรรทุก</p>
        </div>
        {selectedOrders.size > 0 && activeTab !== 'delivery' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
              {selectedOrders.size} คำสั่ง · {reqTotalWt.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
            </span>
            <button onClick={checkLoad} className="btn-primary text-sm px-3 py-1.5">
              <Truck size={13} />จัดรถ
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: ORDERS ══════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="card">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchOrders()}
                  placeholder="ค้นหาลูกค้า / เลขออเดอร์ / จังหวัด..."
                  className="input-field pl-8 py-1.5 text-sm" />
              </div>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}
                className="input-field py-1.5 text-sm w-auto">
                <option value="ALL">ทุกสถานะ</option>
                <option value="PENDING">รอจัด</option>
                <option value="PLANNED">จัดแล้ว</option>
                <option value="SHIPPED">ส่งแล้ว</option>
              </select>
              <button onClick={fetchOrders} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500 hover:bg-slate-50">
                <RefreshCw size={14} />
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60">
                {importing ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />นำเข้า...</>
                  : <><Upload size={13} />Import Excel</>}
              </button>
              {orders.length > 0 && (
                <button onClick={handleClearAll} className="p-2 rounded-lg border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Select all bar */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm">
              <input type="checkbox" className="w-4 h-4 accent-red-600 cursor-pointer"
                checked={selectedOrders.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll} />
              <span className="text-slate-600">
                {selectedOrders.size > 0 ? `เลือก ${selectedOrders.size} / ${filtered.length} คำสั่ง` : `${filtered.length} คำสั่งส่ง`}
              </span>
              {selectedOrders.size > 0 && (
                <>
                  <span className="text-slate-400 text-xs">
                    น้ำหนักรวม <strong className="text-slate-700">{reqTotalWt.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</strong>
                    {reqMaxLen > 0 && <> · ยาวสุด <strong className="text-slate-700">{reqMaxLen} ม.</strong></>}
                  </span>
                  <button onClick={checkLoad} className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                    <ArrowRight size={12} />ไปจัดรถ
                  </button>
                </>
              )}
            </div>
          )}

          {/* Order list */}
          {loadingOrders ? (
            <div className="flex justify-center py-12"><span className="w-7 h-7 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-16 text-slate-400">
              <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">ไม่มีคำสั่งส่ง</p>
              <p className="text-sm mt-1">กด Import Excel เพื่อนำเข้าข้อมูล</p>
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                className="mt-4 btn-primary text-sm">
                <Upload size={14} />Import Excel
              </button>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              {filtered.map(o => (
                <div key={o.TmsOrderID} className={`border-b border-slate-100 transition-colors ${selectedOrders.has(o.TmsOrderID) ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input type="checkbox" className="w-4 h-4 accent-red-600 cursor-pointer flex-shrink-0"
                      checked={selectedOrders.has(o.TmsOrderID)} onChange={() => toggleSelect(o.TmsOrderID)} />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(o.TmsOrderID)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-slate-800">#{o.SourceOrderNo}</span>
                        {o.PoNo && <span className="text-xs text-slate-400 font-mono">{o.PoNo}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[o.Status] || 'bg-slate-100 text-slate-600'}`}>{o.Status}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{o.CustName}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><MapPin size={10} />{o.City} {o.Province}</span>
                        <span className="flex items-center gap-1"><Weight size={10} />{parseFloat(o.TotalWeightKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
                        <span className="flex items-center gap-1"><Package size={10} />{o.LineCount} รายการ</span>
                        {o.ShipByDate && <span>ส่ง {dayjs(o.ShipByDate).format('DD/MM/YY')}</span>}
                        {o.DistanceKm > 0 && <span>{o.DistanceKm} km</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleExpand(o.TmsOrderID)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                        {expandedOrders.has(o.TmsOrderID) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      <button onClick={() => handleDeleteOrder(o.TmsOrderID)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Expanded lines */}
                  {expandedOrders.has(o.TmsOrderID) && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 mb-2">รายการสินค้า</p>
                      {(orderLines[o.TmsOrderID] || []).map(l => (
                        <div key={l.LineID} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                          <span className="font-mono text-xs text-blue-600 w-36 flex-shrink-0">{l.PartCode}</span>
                          <span className="text-xs text-slate-700 flex-1 truncate">{l.PartDesc}</span>
                          <span className="text-xs text-slate-500 flex-shrink-0">{parseFloat(l.Qty).toLocaleString()} {l.UOM}</span>
                          <span className="text-xs font-semibold text-slate-700 flex-shrink-0">{parseFloat(l.TotalWeightKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
                          {l.ItemLength && <span className="text-xs text-slate-400 flex-shrink-0">{l.ItemLength}×{l.ItemWidth}m</span>}
                        </div>
                      ))}
                      {!orderLines[o.TmsOrderID] && <div className="text-xs text-slate-400 py-1">กำลังโหลด...</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: ASSIGN ══════════════════════════════════════════════════════ */}
      {activeTab === 'assign' && (
        <div className="space-y-4">
          {!reqSummary ? (
            <div className="card text-center py-12 text-slate-400">
              <Truck size={36} className="mx-auto mb-3 opacity-20" />
              <p>กลับไปเลือกคำสั่งส่งที่ tab "คำสั่งส่ง" ก่อน แล้วกด "จัดรถ"</p>
            </div>
          ) : (
            <>
              {/* Requirements summary */}
              <div className="card">
                <h3 className="card-header mb-3 flex items-center gap-2"><Info size={16} className="text-blue-500" />ความต้องการของคำสั่งส่ง</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'น้ำหนักรวม', value: `${reqSummary.totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`, icon: Weight, color: 'text-blue-600' },
                    { label: 'ความยาวสูงสุด', value: reqSummary.maxLengthM > 0 ? `${reqSummary.maxLengthM} ม.` : '-', icon: Ruler, color: 'text-purple-600' },
                    { label: 'จำนวนคำสั่ง', value: `${reqSummary.orderCount} คำสั่ง`, icon: Package, color: 'text-orange-600' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <s.icon size={20} className={`mx-auto mb-1 ${s.color}`} />
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle list */}
              <div className="card">
                <h3 className="card-header mb-3 flex items-center gap-2">
                  <Truck size={16} className="text-red-500" />รถที่สามารถใช้ได้
                  {loadingVehicles && <span className="w-4 h-4 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin ml-1" />}
                </h3>
                {vehicles.length === 0 && !loadingVehicles && (
                  <p className="text-slate-400 text-sm text-center py-6">ไม่พบรถที่พร้อมใช้งาน</p>
                )}
                <div className="space-y-3">
                  {vehicles.map(v => (
                    <div key={v.VehicleID}
                      onClick={() => setSelectedVehicle(selectedVehicle?.VehicleID === v.VehicleID ? null : v)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedVehicle?.VehicleID === v.VehicleID ? 'border-red-500 bg-red-50' : v.canLoad ? 'border-slate-200 hover:border-red-300' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${v.canLoad ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {v.canLoad ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{v.LicensePlate}</span>
                            {v.VehicleName && <span className="text-slate-500 text-sm">{v.VehicleName}</span>}
                            {v.VehicleCategory && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{v.VehicleCategory}</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                            {v.PayloadKg && <ConstraintBar label="น้ำหนัก" actual={reqSummary.totalWeightKg} limit={v.PayloadKg} unit="kg" ok={v.OkWeight} />}
                            {v.BedLength && <ConstraintBar label="ความยาว" actual={reqSummary.maxLengthM} limit={v.BedLength} unit="ม." ok={v.OkLength} />}
                            {v.BedWidth && <ConstraintBar label="ความกว้าง" actual={reqSummary.maxWidthM || 0} limit={v.BedWidth} unit="ม." ok={v.OkWidth} />}
                          </div>
                          {!v.canLoad && v.reasons?.length > 0 && (
                            <p className="text-xs text-red-500 mt-1.5">⚠ {v.reasons.join(' · ')}</p>
                          )}
                          {/* Driver name input */}
                          {selectedVehicle?.VehicleID === v.VehicleID && (
                            <div className="mt-2">
                              <input value={driverNames[v.VehicleID] || ''} onChange={e => setDriverNames(p => ({ ...p, [v.VehicleID]: e.target.value }))}
                                className="input-field text-sm py-1.5" placeholder="ชื่อพนักงานขับรถ (ถ้ามี)"
                                onClick={e => e.stopPropagation()} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action button */}
              <button onClick={createPlanAndOptimize} disabled={optimizing || vehicles.filter(v => v.canLoad).length === 0}
                className="btn-primary w-full text-base py-3 disabled:opacity-50">
                {optimizing
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังคำนวณเส้นทาง...</>
                  : <><Play size={16} />วางแผนเส้นทาง</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: ROUTES ══════════════════════════════════════════════════════ */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          {/* Plan selector */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={currentPlan?.PlanID || ''} onChange={async e => {
                const id = e.target.value;
                if (!id) { setCurrentPlan(null); setPlanDetail(null); return; }
                try {
                  const res = await api.get(`/tms/plans/${id}`);
                  setCurrentPlan(res.data.data.plan);
                  setPlanDetail(res.data.data);
                } catch {}
              }} className="input-field py-1.5 text-sm flex-1">
                <option value="">-- เลือกแผน --</option>
                {plans.map(p => (
                  <option key={p.PlanID} value={p.PlanID}>
                    {p.PlanCode} · {dayjs(p.CreatedAt).format('DD/MM/YY HH:mm')} · {p.TripCount} เที่ยว
                  </option>
                ))}
              </select>
              <button onClick={fetchPlans} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {!planDetail ? (
            <div className="card text-center py-12 text-slate-400">
              <Route size={36} className="mx-auto mb-3 opacity-20" />
              <p>เลือกแผน หรือจัดรถก่อนเพื่อสร้างแผนใหม่</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plan summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'จำนวนเที่ยว', value: planDetail.trips.length, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'จุดส่งรวม', value: planDetail.trips.reduce((s, t) => s + (t.stops?.length || 0), 0), color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'น้ำหนักรวม', value: `${planDetail.trips.reduce((s, t) => s + (parseFloat(t.TotalWeightKg) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'ระยะทางรวม', value: `${planDetail.trips.reduce((s, t) => s + (parseFloat(t.TotalDistKm) || 0), 0).toFixed(1)} km`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(s => (
                  <div key={s.label} className={`card ${s.bg}`}>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Trip cards */}
              {planDetail.trips.map((trip, ti) => (
                <div key={trip.TripID} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center font-black text-red-600">
                        {ti + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{trip.LicensePlate || 'ไม่ระบุรถ'}</div>
                        <div className="text-xs text-slate-500">
                          {trip.DriverName && <span>{trip.DriverName} · </span>}
                          {trip.TotalStops} จุด · {parseFloat(trip.TotalDistKm || 0).toFixed(1)} km · {parseFloat(trip.TotalWeightKg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                        </div>
                      </div>
                    </div>
                    {trip.PayloadKg > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-slate-500">บรรทุก</div>
                        <div className={`text-sm font-bold ${parseFloat(trip.TotalWeightKg) / trip.PayloadKg > 0.9 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {Math.round(parseFloat(trip.TotalWeightKg) / trip.PayloadKg * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Stops */}
                  <div className="space-y-0 border border-slate-100 rounded-xl overflow-hidden">
                    {(trip.stops || []).map((stop, si) => (
                      <div key={stop.StopID} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {si + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{stop.CustName}</p>
                          <p className="text-xs text-slate-500 truncate">{stop.City} {stop.Province} · {parseFloat(stop.TotalWeightKg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {si > 0 && <div className="text-xs text-slate-400">{parseFloat(stop.DistFromPrevKm || 0).toFixed(1)} km</div>}
                          <div className="text-xs font-mono text-slate-500">#{stop.SourceOrderNo}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: LOADING DIAGRAM ════════════════════════════════════════════ */}
      {activeTab === 'diagram' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="card-header mb-3 flex items-center gap-2"><Layers size={16} className="text-red-500" />สร้างแผนผังการบรรทุก</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">เลือกรถ</label>
                <select value={diagramVehicleId} onChange={e => setDiagramVehicleId(e.target.value)} className="input-field">
                  <option value="">-- เลือกรถ --</option>
                  {allVehicles.map(v => (
                    <option key={v.VehicleID} value={v.VehicleID}>
                      {v.LicensePlate} {v.BedLength ? `(${v.BedLength}×${v.BedWidth}ม., ${v.PayloadKg?.toLocaleString()}kg)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={generateDiagram} disabled={loadingDiagram || !diagramVehicleId || !selectedOrders.size}
                  className="btn-primary w-full disabled:opacity-50">
                  {loadingDiagram ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />สร้างผัง...</>
                    : <><Layers size={14} />สร้างแผนผัง ({selectedOrders.size} คำสั่ง)</>}
                </button>
              </div>
            </div>
            {selectedOrders.size === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                ⚠ กลับไป tab "คำสั่งส่ง" เลือกคำสั่งก่อน แล้วกลับมาสร้างผัง
              </p>
            )}
          </div>

          {diagramData && (
            <LoadingDiagram
              bed={diagramData.bed}
              placed={diagramData.placed}
              unplaced={diagramData.unplaced}
              summary={diagramData.summary}
            />
          )}
        </div>
      )}

      {/* ═══ TAB: DELIVERY PLAN ═══════════════════════════════════════════════ */}
      {activeTab === 'delivery' && <DeliveryPlan />}
    </div>
  );
}
