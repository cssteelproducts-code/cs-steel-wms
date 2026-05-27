import { useState, useEffect, useRef } from 'react';
import { Route, Plus, Truck, MapPin, Zap, CheckCircle, X, ChevronDown, ChevronRight, Search, Printer, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STATUS_STYLE = {
  PENDING: 'bg-slate-100 text-slate-500',
  PLANNED: 'bg-blue-100 text-blue-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-600',
  DELIVERED: 'bg-emerald-100 text-emerald-600',
  CANCELLED: 'bg-red-100 text-red-500'
};
const STATUS_LABEL = { PENDING: 'รอแผน', PLANNED: 'วางแผนแล้ว', IN_PROGRESS: 'กำลังจัดส่ง', DELIVERED: 'จัดส่งแล้ว', CANCELLED: 'ยกเลิก' };
const PLAN_STATUS_STYLE = { DRAFT: 'bg-slate-100 text-slate-500', CONFIRMED: 'bg-blue-100 text-blue-600', IN_PROGRESS: 'bg-amber-100 text-amber-600', COMPLETED: 'bg-emerald-100 text-emerald-600' };
const PLAN_STATUS_LABEL = { DRAFT: 'ร่าง', CONFIRMED: 'ยืนยัน', IN_PROGRESS: 'กำลังจัดส่ง', COMPLETED: 'เสร็จสิ้น' };

export default function DeliveryPlan() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planDetail, setPlanDetail] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [completingRoute, setCompletingRoute] = useState(null);

  // Order form
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    warehouseId: '', customerId: '', productId: '', quantity: '',
    unit: 'ตัน', deliveryAddress: '', deliveryLat: '', deliveryLng: '',
    requestedDate: new Date().toISOString().slice(0, 10),
    timeWindowStart: '08:00', timeWindowEnd: '17:00', notes: ''
  });
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custTimer, setCustTimerRef] = useState(null);
  const locTimer = useRef(null);

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ warehouseId: '', planDate: new Date().toISOString().slice(0, 10), notes: '' });

  // VRP form
  const [showVrpForm, setShowVrpForm] = useState(false);
  const [vrpVehicles, setVrpVehicles] = useState([{ licensePlate: '', driverName: '', capacityTon: 20 }]);
  const [vrpLoading, setVrpLoading] = useState(false);

  const [filterDate, setFilterDate] = useState('');
  const [expandedRoute, setExpandedRoute] = useState(null);

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (tab === 'orders') fetchOrders();
    if (tab === 'plans') fetchPlans();
  }, [tab]);

  const fetchWarehouses = async () => { try { const r = await api.get('/master/warehouses'); setWarehouses(r.data.data || []); } catch {} };
  const fetchProducts = async () => { try { const r = await api.get('/stock/products'); setProducts(r.data.data || []); } catch {} };
  const fetchCustomers = async () => { try { const r = await api.get('/master/customers'); setCustomers(r.data.data || []); } catch {} };
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = filterDate ? `?date=${filterDate}` : '';
      const r = await api.get(`/delivery/orders${q}`);
      setOrders(r.data.data || []);
    } catch {} finally { setLoading(false); }
  };
  const fetchPlans = async () => {
    setLoading(true);
    try { const r = await api.get('/delivery/plans'); setPlans(r.data.data || []); } catch {} finally { setLoading(false); }
  };
  const fetchPlanDetail = async (id) => {
    try { const r = await api.get(`/delivery/plans/${id}`); setPlanDetail(r.data.data); } catch {}
  };

  const handleCustSearch = (val) => {
    setCustSearch(val);
    clearTimeout(custTimer);
    if (!val) { setCustResults([]); return; }
    setCustTimerRef(setTimeout(() => {
      const q = val.toLowerCase();
      setCustResults(customers.filter(c => c.ARCode?.toLowerCase().includes(q) || c.CustomerName?.toLowerCase().includes(q)).slice(0, 8));
    }, 200));
  };

  const searchLocation = async (q) => {
    if (!q || q.length < 3) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&accept-language=th`);
      const data = await r.json();
      if (data[0]) {
        setOrderForm(p => ({ ...p, deliveryLat: parseFloat(data[0].lat).toFixed(6), deliveryLng: parseFloat(data[0].lon).toFixed(6) }));
        toast.success('พบพิกัด GPS แล้ว');
      }
    } catch {}
  };

  const handleAddrChange = (val) => {
    setOrderForm(p => ({ ...p, deliveryAddress: val }));
    clearTimeout(locTimer.current);
    locTimer.current = setTimeout(() => searchLocation(val), 800);
  };

  const saveOrder = async () => {
    if (!orderForm.warehouseId || !orderForm.requestedDate) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return; }
    setSavingOrder(true);
    try {
      await api.post('/delivery/orders', orderForm);
      toast.success('สร้างคำสั่งจัดส่งสำเร็จ');
      setShowOrderForm(false);
      setOrderForm({ warehouseId: '', customerId: '', productId: '', quantity: '', unit: 'ตัน', deliveryAddress: '', deliveryLat: '', deliveryLng: '', requestedDate: new Date().toISOString().slice(0, 10), timeWindowStart: '08:00', timeWindowEnd: '17:00', notes: '' });
      setCustSearch(''); setCustResults([]);
      fetchOrders();
    } catch { toast.error('สร้างไม่สำเร็จ'); } finally { setSavingOrder(false); }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm('ยกเลิกคำสั่งจัดส่งนี้?')) return;
    await api.delete(`/delivery/orders/${id}`);
    fetchOrders();
  };

  const savePlan = async () => {
    if (!planForm.warehouseId) { toast.error('กรุณาเลือกคลัง'); return; }
    setSavingPlan(true);
    try {
      const r = await api.post('/delivery/plans', planForm);
      toast.success(`สร้างแผน ${r.data.planCode} สำเร็จ`);
      setShowPlanForm(false);
      fetchPlans();
      fetchPlanDetail(r.data.planId);
      setShowVrpForm(true);
    } catch { toast.error('สร้างไม่สำเร็จ'); } finally { setSavingPlan(false); }
  };

  const runVRP = async () => {
    if (!planDetail) return;
    const valid = vrpVehicles.filter(v => v.licensePlate.trim());
    if (!valid.length) { toast.error('กรุณาระบุทะเบียนรถอย่างน้อย 1 คัน'); return; }
    setVrpLoading(true);
    try {
      const r = await api.post(`/delivery/plans/${planDetail.PlanID}/vrp`, { vehicles: valid });
      toast.success(r.data.message);
      setShowVrpForm(false);
      fetchPlanDetail(planDetail.PlanID);
    } catch (err) { toast.error(err.response?.data?.message || 'VRP ล้มเหลว'); } finally { setVrpLoading(false); }
  };

  const confirmPlan = async () => {
    setConfirming(true);
    try {
      await api.put(`/delivery/plans/${planDetail.PlanID}/confirm`);
      toast.success('ยืนยันแผนจัดส่งแล้ว');
      fetchPlanDetail(planDetail.PlanID);
    } catch { toast.error('ยืนยันไม่สำเร็จ'); } finally { setConfirming(false); }
  };

  const completeRoute = async (routeId) => {
    setCompletingRoute(routeId);
    try {
      await api.put(`/delivery/routes/${routeId}/complete`);
      toast.success('บันทึกเส้นทางเสร็จสิ้น');
      fetchPlanDetail(planDetail.PlanID);
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setCompletingRoute(null); }
  };

  const extractProvince = (addr) => {
    if (!addr) return '-';
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    const provPart = parts.find(p => /จังหวัด/.test(p));
    if (provPart) return provPart.replace('จังหวัด', '').trim();
    const filtered = parts.filter(p => !p.match(/^\d+$/) && !/Thailand|ประเทศไทย/.test(p));
    return filtered[filtered.length - 1] || '-';
  };

  const printDailyReport = () => {
    if (!planDetail) return;
    const pd = dayjs(planDetail.PlanDate);
    const beYear = pd.year() + 543;
    const dateStr = pd.format('DD/MM/') + String(beYear).slice(-2);

    const rows = (planDetail.routes || []).map((route, i) => {
      const stops = route.stops || [];
      const custNames = stops.map(s => s.CustomerName || s.DeliveryAddress || '—').join('\n');
      const provinces = [...new Set(stops.map(s => extractProvince(s.DeliveryAddress)).filter(p => p && p !== '-'))].join(' / ') || '-';
      const loadInfo = `${parseFloat(route.TotalQty || 0).toFixed(2)} ตัน\n(Max ${route.CapacityTon} ตัน)`;
      return `<tr>
        <td class="center">${i + 1}</td>
        <td class="center bold">${route.LicensePlate || '-'}</td>
        <td class="center">${route.CapacityTon} ตัน</td>
        <td class="prewrap">${custNames}</td>
        <td>${provinces}</td>
        <td>${route.DriverName || '-'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>รายงานการเดินรถส่งสินค้า ${dateStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 14pt; padding: 12mm 15mm; color: #000; }
  h2 { text-align: center; font-size: 18pt; font-weight: 700; margin-bottom: 6px; }
  .meta { text-align: center; font-size: 11pt; color: #444; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { border: 1.5px solid #222; padding: 6px 8px; background: #e8e8e8; font-weight: 700; text-align: center; font-size: 12pt; }
  td { border: 1px solid #444; padding: 5px 8px; font-size: 13pt; vertical-align: top; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .prewrap { white-space: pre-line; }
  .footer { margin-top: 18px; font-size: 10pt; color: #666; text-align: right; }
  @media print { @page { size: A4 landscape; margin: 8mm 12mm; } }
</style></head><body>
<h2>รายงานการเดินรถส่งสินค้า วันที่ ........${dateStr}........</h2>
<div class="meta">คลัง: ${planDetail.WarehouseName || '-'} &nbsp;|&nbsp; แผน: ${planDetail.PlanCode || '-'} &nbsp;|&nbsp; รวม ${planDetail.routes?.length || 0} คัน</div>
<table>
  <thead><tr>
    <th style="width:44px">ลำดับ</th>
    <th style="width:110px">ทะเบียนรถ</th>
    <th style="width:110px">น้ำหนักบรรทุก<br>ประทาก Max</th>
    <th>ชื่อร้าน</th>
    <th style="width:140px">จังหวัด</th>
    <th style="width:140px">ผู้ขับ / ฝ่ายขาย</th>
  </tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px">ไม่มีข้อมูลเส้นทาง</td></tr>'}</tbody>
</table>
<div class="footer">พิมพ์เมื่อ: ${dayjs().format('DD/MM/YYYY HH:mm')} น. &nbsp;|&nbsp; CS.Smart WMS</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
</body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=750');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const addVehicle = () => setVrpVehicles(prev => [...prev, { licensePlate: '', driverName: '', capacityTon: 20 }]);
  const removeVehicle = (i) => setVrpVehicles(prev => prev.filter((_, idx) => idx !== i));
  const updateVehicle = (i, field, val) => setVrpVehicles(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 items-center">
        <button onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <MapPin size={14} />คำสั่งจัดส่ง
        </button>
        <button onClick={() => setTab('plans')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Route size={14} />แผนจัดส่ง (VRP)
        </button>
        <button onClick={() => { fetchOrders(); fetchPlans(); }}
          className="ml-auto btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
          <RefreshCw size={13} />รีเฟรช
        </button>
      </div>

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="card-header mb-0 flex items-center gap-2"><MapPin size={18} className="text-blue-500" />คำสั่งจัดส่ง</h3>
            <div className="flex gap-2 items-center">
              <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); }}
                className="input-field w-36 text-sm py-1.5" />
              <button onClick={fetchOrders} className="text-blue-600 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">ค้นหา</button>
              <button onClick={() => setShowOrderForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />เพิ่มคำสั่ง</button>
            </div>
          </div>

          {showOrderForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">เพิ่มคำสั่งจัดส่ง</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">คลังต้นทาง *</label>
                  <select value={orderForm.warehouseId} onChange={e => setOrderForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">เลือกคลัง</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <label className="label">ลูกค้า</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={custSearch} onChange={e => handleCustSearch(e.target.value)}
                      onBlur={() => setTimeout(() => setCustResults([]), 150)}
                      className="input-field pl-8 text-sm" placeholder="ค้นหา ARCODE/ชื่อ" />
                  </div>
                  {custResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                      {custResults.map(c => (
                        <button key={c.CustomerID} type="button" onMouseDown={() => { setOrderForm(p => ({ ...p, customerId: c.CustomerID })); setCustSearch(`${c.ARCode} ${c.CustomerName}`); setCustResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0">
                          <span className="text-blue-600 font-mono">{c.ARCode}</span> <span className="text-slate-700">{c.CustomerName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">สินค้า</label>
                  <select value={orderForm.productId} onChange={e => setOrderForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">เลือกสินค้า</option>{products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} - {p.ProductName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">จำนวน (ตัน)</label>
                  <input type="number" step="0.001" value={orderForm.quantity} onChange={e => setOrderForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">วันที่ต้องการ *</label>
                  <input type="date" value={orderForm.requestedDate} onChange={e => setOrderForm(p => ({ ...p, requestedDate: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">ช่วงเวลา</label>
                  <div className="flex gap-1">
                    <input type="time" value={orderForm.timeWindowStart} onChange={e => setOrderForm(p => ({ ...p, timeWindowStart: e.target.value }))} className="input-field flex-1 text-sm" />
                    <span className="text-slate-400 self-center">—</span>
                    <input type="time" value={orderForm.timeWindowEnd} onChange={e => setOrderForm(p => ({ ...p, timeWindowEnd: e.target.value }))} className="input-field flex-1 text-sm" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">ที่อยู่จัดส่ง (ระบบจะหาพิกัด GPS อัตโนมัติ)</label>
                  <input type="text" value={orderForm.deliveryAddress} onChange={e => handleAddrChange(e.target.value)} className="input-field" placeholder="เช่น 123 ถนนพระราม2 สมุทรสาคร" />
                </div>
                <div>
                  <label className="label">พิกัด GPS</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.000001" value={orderForm.deliveryLat} onChange={e => setOrderForm(p => ({ ...p, deliveryLat: e.target.value }))} className="input-field text-xs" placeholder="Lat" />
                    <input type="number" step="0.000001" value={orderForm.deliveryLng} onChange={e => setOrderForm(p => ({ ...p, deliveryLng: e.target.value }))} className="input-field text-xs" placeholder="Lng" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">หมายเหตุ</label>
                  <input type="text" value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveOrder} disabled={savingOrder} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {savingOrder && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {savingOrder ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setShowOrderForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
              </div>
            </div>
          )}

          {loading ? <div className="text-center py-8 text-slate-500">กำลังโหลด...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200">
                  <th className="table-header text-left px-3 py-2">เลขที่</th>
                  <th className="table-header text-left px-3 py-2">ลูกค้า</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">สินค้า</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">วันที่</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">ที่อยู่</th>
                  <th className="table-header text-right px-3 py-2">ตัน</th>
                  <th className="table-header text-center px-3 py-2">สถานะ</th>
                  <th className="table-header px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.OrderID} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="table-cell font-mono text-blue-600 text-xs">{o.OrderCode}</td>
                      <td className="table-cell"><div className="font-medium text-slate-900 text-sm">{o.CustomerName || '—'}</div><div className="text-xs text-slate-400">{o.ARCode}</div></td>
                      <td className="table-cell hide-mobile text-slate-600 text-xs">{o.ProductName || '—'}</td>
                      <td className="table-cell hide-mobile text-xs text-slate-600">{dayjs(o.RequestedDate).format('DD/MM/YY')}</td>
                      <td className="table-cell hide-mobile text-xs text-slate-500 max-w-32 truncate">{o.DeliveryAddress || '—'}</td>
                      <td className="table-cell text-right font-bold text-slate-900">{parseFloat(o.Quantity || 0).toFixed(2)}</td>
                      <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[o.Status] || ''}`}>{STATUS_LABEL[o.Status] || o.Status}</span></td>
                      <td className="table-cell">
                        {o.Status === 'PENDING' && (
                          <button onClick={() => cancelOrder(o.OrderID)} className="text-red-500 hover:text-red-600 p-1"><X size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!orders.length && <tr><td colSpan={8} className="text-center py-8 text-slate-400">ยังไม่มีคำสั่งจัดส่ง</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PLANS TAB */}
      {tab === 'plans' && (
        <div className="space-y-4">
          {!planDetail ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0 flex items-center gap-2"><Route size={18} className="text-blue-500" />แผนจัดส่ง</h3>
                <button onClick={() => setShowPlanForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />สร้างแผนใหม่</button>
              </div>

              {showPlanForm && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">สร้างแผนจัดส่ง</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">คลังต้นทาง *</label>
                      <select value={planForm.warehouseId} onChange={e => setPlanForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                        <option value="">เลือก</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                      </select></div>
                    <div><label className="label">วันที่จัดส่ง *</label>
                      <input type="date" value={planForm.planDate} onChange={e => setPlanForm(p => ({ ...p, planDate: e.target.value }))} className="input-field" /></div>
                    <div className="col-span-2"><label className="label">หมายเหตุ</label>
                      <input value={planForm.notes} onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))} className="input-field" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={savePlan} disabled={savingPlan} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                      {savingPlan && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {savingPlan ? 'กำลังสร้าง...' : 'สร้างแผน'}
                    </button>
                    <button onClick={() => setShowPlanForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {plans.map(p => (
                  <div key={p.PlanID} className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer transition-colors"
                    onClick={() => fetchPlanDetail(p.PlanID)}>
                    <div>
                      <div className="font-semibold text-slate-900">{p.PlanCode}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.WarehouseName} · {dayjs(p.PlanDate).format('DD/MM/YYYY')} · {p.RouteCount} เส้นทาง · {p.OrderCount} คำสั่ง
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_STATUS_STYLE[p.Status] || ''}`}>{PLAN_STATUS_LABEL[p.Status] || p.Status}</span>
                  </div>
                ))}
                {!plans.length && <div className="text-center py-8 text-slate-400">ยังไม่มีแผนจัดส่ง</div>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plan header */}
              <div className="card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{planDetail.PlanCode}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_STATUS_STYLE[planDetail.Status] || ''}`}>{PLAN_STATUS_LABEL[planDetail.Status] || planDetail.Status}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {planDetail.WarehouseName} · {dayjs(planDetail.PlanDate).format('DD/MM/YYYY')}
                      {planDetail.routes?.length > 0 && ` · ${planDetail.routes.length} เส้นทาง · ${planDetail.routes.reduce((s, r) => s + (r.StopCount || 0), 0)} คำสั่ง`}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowVrpForm(!showVrpForm)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm rounded-lg font-semibold transition-all shadow-lg">
                      <Zap size={14} />วางแผนอัตโนมัติ VRP
                    </button>
                    {planDetail.Status === 'DRAFT' && planDetail.routes?.length > 0 && (
                      <button onClick={confirmPlan} disabled={confirming} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-60">
                        {confirming ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={14} />}
                        {confirming ? 'กำลังยืนยัน...' : 'ยืนยันแผน'}
                      </button>
                    )}
                    {planDetail.routes?.length > 0 && (
                      <button onClick={printDailyReport}
                        className="flex items-center gap-1.5 px-3 py-2 text-white text-sm rounded-lg font-medium transition-all"
                        style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 2px 10px rgba(220,38,38,0.3)' }}>
                        <Printer size={14} />พิมพ์รายงานเดินรถ
                      </button>
                    )}
                    <button onClick={() => setPlanDetail(null)} className="btn-secondary text-sm px-3 py-2"><X size={14} />ปิด</button>
                  </div>
                </div>

                {/* VRP vehicle input */}
                {showVrpForm && (
                  <div className="mt-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-blue-500" />
                      <span className="font-semibold text-slate-900 text-sm">ระบุรถสำหรับจัดส่ง (VRP จะจัดสรรคำสั่งอัตโนมัติ)</span>
                    </div>

                    <div className="space-y-2">
                      {vrpVehicles.map((v, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-slate-400 text-xs w-5">{i + 1}.</span>
                          <input value={v.licensePlate} onChange={e => updateVehicle(i, 'licensePlate', e.target.value.toUpperCase())}
                            className="input-field flex-1 text-sm uppercase font-mono" placeholder="ทะเบียนรถ" />
                          <input value={v.driverName} onChange={e => updateVehicle(i, 'driverName', e.target.value)}
                            className="input-field flex-1 text-sm" placeholder="ชื่อคนขับ" />
                          <div className="flex items-center gap-1">
                            <input type="number" value={v.capacityTon} onChange={e => updateVehicle(i, 'capacityTon', parseFloat(e.target.value))}
                              className="input-field w-20 text-sm text-right" />
                            <span className="text-slate-500 text-xs w-6">ตัน</span>
                          </div>
                          {vrpVehicles.length > 1 && (
                            <button onClick={() => removeVehicle(i)} className="text-red-500 hover:text-red-600 p-1"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={addVehicle} className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"><Plus size={13} />เพิ่มรถ</button>
                      <div className="ml-auto flex gap-2">
                        <button onClick={runVRP} disabled={vrpLoading}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm rounded-lg font-bold disabled:opacity-50">
                          <Zap size={14} className={vrpLoading ? 'animate-pulse' : ''} />
                          {vrpLoading ? 'กำลังคำนวณ...' : 'คำนวณเส้นทาง'}
                        </button>
                        <button onClick={() => setShowVrpForm(false)} className="btn-secondary text-sm px-3 py-2">ยกเลิก</button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      VRP (Vehicle Routing Problem) จะจัดสรรคำสั่งจัดส่ง PENDING ของวัน {dayjs(planDetail.PlanDate).format('DD/MM/YYYY')} ให้กับรถแต่ละคันโดยอัตโนมัติ โดยเรียงลำดับจุดส่งตามระยะทางใกล้ไกล
                    </div>
                  </div>
                )}
              </div>

              {/* Routes */}
              {planDetail.routes?.length > 0 ? (
                <div className="space-y-3">
                  {planDetail.routes.map((route, ri) => (
                    <div key={route.RouteID} className="card">
                      <div className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedRoute(expandedRoute === route.RouteID ? null : route.RouteID)}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white`}
                            style={{ background: `hsl(${(ri * 60) % 360}, 60%, 45%)` }}>
                            {ri + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <Truck size={14} className="text-slate-400" />
                              {route.LicensePlate}
                              {route.DriverName && <span className="text-slate-500 font-normal text-xs">/ {route.DriverName}</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {route.StopCount} จุดส่ง · {parseFloat(route.TotalQty || 0).toFixed(2)} ตัน / {route.CapacityTon} ตัน · {route.TotalDistKm} กม.
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[route.Status] || ''}`}>{STATUS_LABEL[route.Status] || route.Status}</span>
                          {route.Status !== 'COMPLETED' && (
                            <button onClick={e => { e.stopPropagation(); completeRoute(route.RouteID); }}
                              disabled={completingRoute === route.RouteID}
                              className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-60">
                              {completingRoute === route.RouteID
                                ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <CheckCircle size={11} />}
                              {completingRoute === route.RouteID ? 'กำลังบันทึก...' : 'เสร็จสิ้น'}
                            </button>
                          )}
                          {expandedRoute === route.RouteID ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                        </div>
                      </div>

                      {expandedRoute === route.RouteID && route.stops?.length > 0 && (
                        <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
                          {route.stops.map((stop, si) => (
                            <div key={stop.StopID} className="flex items-start gap-3 pl-2">
                              <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs text-blue-600 font-bold flex-shrink-0">{si + 1}</div>
                                {si < route.stops.length - 1 && <div className="w-px h-6 bg-slate-200 mt-1" />}
                              </div>
                              <div className="flex-1 pb-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">{stop.CustomerName || '—'}</div>
                                    <div className="text-xs text-slate-500">{stop.DeliveryAddress}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{stop.OrderCode} · {parseFloat(stop.Quantity || 0).toFixed(2)} {stop.Unit}</div>
                                  </div>
                                  {stop.DistFromPrevKm > 0 && (
                                    <span className="text-xs text-slate-400">{stop.DistFromPrevKm} กม.</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card text-center py-10 text-slate-400">
                  <Zap size={36} className="mx-auto mb-3 text-blue-400 opacity-40" />
                  กด "วางแผนอัตโนมัติ VRP" เพื่อจัดสรรเส้นทางจัดส่ง
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
