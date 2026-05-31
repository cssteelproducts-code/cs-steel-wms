import { useState, useEffect, useRef } from 'react';
import { Route, Plus, Truck, MapPin, Zap, CheckCircle, X, ChevronDown, ChevronRight, Search, Printer, RefreshCw } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useLang } from '../context/LanguageContext';

const STATUS_STYLE = {
  PENDING: 'bg-slate-100 text-slate-500',
  PLANNED: 'bg-blue-100 text-blue-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-600',
  DELIVERED: 'bg-emerald-100 text-emerald-600',
  CANCELLED: 'bg-red-100 text-red-500'
};
const PLAN_STATUS_STYLE = { DRAFT: 'bg-slate-100 text-slate-500', CONFIRMED: 'bg-blue-100 text-blue-600', IN_PROGRESS: 'bg-amber-100 text-amber-600', COMPLETED: 'bg-emerald-100 text-emerald-600' };

export default function DeliveryPlan() {
  const { t } = useLang();

  const STATUS_LABEL = {
    PENDING: t('delivery.statusPending'), PLANNED: t('delivery.statusPlanned'),
    IN_PROGRESS: t('delivery.statusInProgress'), DELIVERED: t('delivery.statusDelivered'),
    CANCELLED: t('status.cancelled')
  };
  const PLAN_STATUS_LABEL = {
    DRAFT: t('delivery.statusDraft'), CONFIRMED: t('delivery.statusConfirmed'),
    IN_PROGRESS: t('delivery.statusInProgress'), COMPLETED: t('status.complete')
  };

  const [tab, setTab] = useState('orders');
  const [lastUpdate, setLastUpdate] = useState(null);
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

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ warehouseId: '', planDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [showVrpForm, setShowVrpForm] = useState(false);
  const [vrpVehicles, setVrpVehicles] = useState([{ licensePlate: '', driverName: '', capacityTon: 20 }]);
  const [vrpLoading, setVrpLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [expandedRoute, setExpandedRoute] = useState(null);

  useEffect(() => { fetchWarehouses(); fetchProducts(); fetchCustomers(); }, []);
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
      setLastUpdate(new Date());
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
        toast.success(t('delivery.gpsLabel'));
      }
    } catch {}
  };

  const handleAddrChange = (val) => {
    setOrderForm(p => ({ ...p, deliveryAddress: val }));
    clearTimeout(locTimer.current);
    locTimer.current = setTimeout(() => searchLocation(val), 800);
  };

  const saveOrder = async () => {
    if (!orderForm.warehouseId || !orderForm.requestedDate) { toast.error(t('common.noData')); return; }
    setSavingOrder(true);
    try {
      await api.post('/delivery/orders', orderForm);
      toast.success(t('common.save'));
      setShowOrderForm(false);
      setOrderForm({ warehouseId: '', customerId: '', productId: '', quantity: '', unit: 'ตัน', deliveryAddress: '', deliveryLat: '', deliveryLng: '', requestedDate: new Date().toISOString().slice(0, 10), timeWindowStart: '08:00', timeWindowEnd: '17:00', notes: '' });
      setCustSearch(''); setCustResults([]);
      fetchOrders();
    } catch { toast.error(t('common.noData')); } finally { setSavingOrder(false); }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm(t('common.confirm'))) return;
    await api.delete(`/delivery/orders/${id}`);
    fetchOrders();
  };

  const savePlan = async () => {
    if (!planForm.warehouseId) { toast.error(t('delivery.sourceWarehouse')); return; }
    setSavingPlan(true);
    try {
      const r = await api.post('/delivery/plans', planForm);
      toast.success(t('common.save'));
      setShowPlanForm(false);
      fetchPlans();
      fetchPlanDetail(r.data.planId);
      setShowVrpForm(true);
    } catch { toast.error(t('common.noData')); } finally { setSavingPlan(false); }
  };

  const runVRP = async () => {
    if (!planDetail) return;
    const valid = vrpVehicles.filter(v => v.licensePlate.trim());
    if (!valid.length) { toast.error(t('delivery.addVehicle')); return; }
    setVrpLoading(true);
    try {
      const r = await api.post(`/delivery/plans/${planDetail.PlanID}/vrp`, { vehicles: valid });
      toast.success(r.data.message);
      setShowVrpForm(false);
      fetchPlanDetail(planDetail.PlanID);
    } catch (err) { toast.error(err.response?.data?.message || t('common.noData')); } finally { setVrpLoading(false); }
  };

  const confirmPlan = async () => {
    setConfirming(true);
    try {
      await api.put(`/delivery/plans/${planDetail.PlanID}/confirm`);
      toast.success(t('delivery.confirmPlan'));
      fetchPlanDetail(planDetail.PlanID);
    } catch { toast.error(t('common.noData')); } finally { setConfirming(false); }
  };

  const completeRoute = async (routeId) => {
    setCompletingRoute(routeId);
    try {
      await api.put(`/delivery/routes/${routeId}/complete`);
      toast.success(t('status.complete'));
      fetchPlanDetail(planDetail.PlanID);
    } catch { toast.error(t('common.noData')); } finally { setCompletingRoute(null); }
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
      return `<tr>
        <td class="center">${i + 1}</td>
        <td class="center bold">${route.LicensePlate || '-'}</td>
        <td class="center">${route.CapacityTon} t</td>
        <td class="prewrap">${custNames}</td>
        <td>${provinces}</td>
        <td>${route.DriverName || '-'}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${dateStr}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:14pt;padding:12mm 15mm;color:#000}h2{text-align:center;font-size:18pt;font-weight:700;margin-bottom:6px}.meta{text-align:center;font-size:11pt;color:#444;margin-bottom:14px}table{width:100%;border-collapse:collapse}th{border:1.5px solid #222;padding:6px 8px;background:#e8e8e8;font-weight:700;text-align:center;font-size:12pt}td{border:1px solid #444;padding:5px 8px;font-size:13pt;vertical-align:top}.center{text-align:center}.bold{font-weight:700}.prewrap{white-space:pre-line}.footer{margin-top:18px;font-size:10pt;color:#666;text-align:right}@media print{@page{size:A4 landscape;margin:8mm 12mm}}</style></head><body>
<h2>${dateStr} — ${planDetail.WarehouseName || '-'}</h2>
<table><thead><tr><th>No.</th><th>${t('common.licensePlate')}</th><th>ton</th><th>${t('common.customer')}</th><th>${t('common.address') || 'Address'}</th><th>${t('delivery.driverPH')}</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px">—</td></tr>'}</tbody></table>
<div class="footer">${dayjs().format('DD/MM/YYYY HH:mm')}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=750');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const addVehicle = () => setVrpVehicles(prev => [...prev, { licensePlate: '', driverName: '', capacityTon: 20 }]);
  const removeVehicle = (i) => setVrpVehicles(prev => prev.filter((_, idx) => idx !== i));
  const updateVehicle = (i, field, val) => setVrpVehicles(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <Route size={20} className="text-blue-500 flex-shrink-0" />
            {t('page.delivery')}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={() => { fetchOrders(); fetchPlans(); }}
          className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <MapPin size={14} />{t('delivery.tabOrders')}
        </button>
        <button onClick={() => setTab('plans')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Route size={14} />{t('delivery.tabPlans')}
        </button>
      </div>

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="card-header mb-0 flex items-center gap-2"><MapPin size={18} className="text-blue-500" />{t('delivery.ordersTitle')}</h3>
            <div className="flex gap-2 items-center">
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="input-field w-36 text-sm py-1.5" />
              <button onClick={fetchOrders} className="text-blue-600 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">{t('delivery.searchBtn')}</button>
              <button onClick={() => setShowOrderForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />{t('delivery.addOrder')}</button>
            </div>
          </div>

          {showOrderForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{t('delivery.addOrderTitle')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('delivery.sourceWarehouse')}</label>
                  <select value={orderForm.warehouseId} onChange={e => setOrderForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">{t('delivery.selectWarehouse')}</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <label className="label">{t('delivery.customerLabel')}</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={custSearch} onChange={e => handleCustSearch(e.target.value)}
                      onBlur={() => setTimeout(() => setCustResults([]), 150)}
                      className="input-field pl-8 text-sm" placeholder={t('weighIn.customerPlaceholder')} />
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
                  <label className="label">{t('delivery.productLabel')}</label>
                  <select value={orderForm.productId} onChange={e => setOrderForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">{t('delivery.selectProduct')}</option>
                    {products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} - {p.ProductName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('delivery.quantityLabel')}</label>
                  <input type="number" step="0.001" value={orderForm.quantity} onChange={e => setOrderForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">{t('delivery.requestedDate')}</label>
                  <input type="date" value={orderForm.requestedDate} onChange={e => setOrderForm(p => ({ ...p, requestedDate: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">{t('delivery.timeWindow')}</label>
                  <div className="flex gap-1">
                    <input type="time" value={orderForm.timeWindowStart} onChange={e => setOrderForm(p => ({ ...p, timeWindowStart: e.target.value }))} className="input-field flex-1 text-sm" />
                    <span className="text-slate-400 self-center">—</span>
                    <input type="time" value={orderForm.timeWindowEnd} onChange={e => setOrderForm(p => ({ ...p, timeWindowEnd: e.target.value }))} className="input-field flex-1 text-sm" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">{t('delivery.addressLabel')}</label>
                  <input type="text" value={orderForm.deliveryAddress} onChange={e => handleAddrChange(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label">{t('delivery.gpsLabel')}</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.000001" value={orderForm.deliveryLat} onChange={e => setOrderForm(p => ({ ...p, deliveryLat: e.target.value }))} className="input-field text-xs" placeholder="Lat" />
                    <input type="number" step="0.000001" value={orderForm.deliveryLng} onChange={e => setOrderForm(p => ({ ...p, deliveryLng: e.target.value }))} className="input-field text-xs" placeholder="Lng" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">{t('common.note')}</label>
                  <input type="text" value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveOrder} disabled={savingOrder} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {savingOrder && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {savingOrder ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setShowOrderForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {loading ? <div className="text-center py-8 text-slate-500">{t('common.loading')}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200">
                  <th className="table-header text-left px-3 py-2">{t('delivery.colOrderNo')}</th>
                  <th className="table-header text-left px-3 py-2">{t('delivery.colCustomer')}</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">{t('delivery.colProduct')}</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">{t('delivery.colDate')}</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">{t('delivery.colAddress')}</th>
                  <th className="table-header text-right px-3 py-2">{t('delivery.colTon')}</th>
                  <th className="table-header text-center px-3 py-2">{t('delivery.colStatus')}</th>
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
                  {!orders.length && <tr><td colSpan={8} className="text-center py-8 text-slate-400">{t('delivery.noOrders')}</td></tr>}
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
                <h3 className="card-header mb-0 flex items-center gap-2"><Route size={18} className="text-blue-500" />{t('delivery.plansTitle')}</h3>
                <button onClick={() => setShowPlanForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />{t('delivery.createPlan')}</button>
              </div>

              {showPlanForm && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">{t('delivery.createPlanTitle')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('delivery.sourceWarehouse')}</label>
                      <select value={planForm.warehouseId} onChange={e => setPlanForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                        <option value="">{t('common.select')}</option>
                        {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('delivery.planDate')}</label>
                      <input type="date" value={planForm.planDate} onChange={e => setPlanForm(p => ({ ...p, planDate: e.target.value }))} className="input-field" />
                    </div>
                    <div className="col-span-2">
                      <label className="label">{t('common.note')}</label>
                      <input value={planForm.notes} onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))} className="input-field" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={savePlan} disabled={savingPlan} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                      {savingPlan && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {savingPlan ? t('delivery.creating') : t('delivery.createPlanBtn')}
                    </button>
                    <button onClick={() => setShowPlanForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
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
                        {p.WarehouseName} · {dayjs(p.PlanDate).format('DD/MM/YYYY')} · {p.RouteCount} {t('delivery.routes')} · {p.OrderCount}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_STATUS_STYLE[p.Status] || ''}`}>{PLAN_STATUS_LABEL[p.Status] || p.Status}</span>
                  </div>
                ))}
                {!plans.length && <div className="text-center py-8 text-slate-400">{t('delivery.noPlans')}</div>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{planDetail.PlanCode}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_STATUS_STYLE[planDetail.Status] || ''}`}>{PLAN_STATUS_LABEL[planDetail.Status] || planDetail.Status}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {planDetail.WarehouseName} · {dayjs(planDetail.PlanDate).format('DD/MM/YYYY')}
                      {planDetail.routes?.length > 0 && ` · ${planDetail.routes.length} ${t('delivery.routes')} · ${planDetail.routes.reduce((s, r) => s + (r.StopCount || 0), 0)} ${t('delivery.stops')}`}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowVrpForm(!showVrpForm)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm rounded-lg font-semibold transition-all shadow-lg">
                      <Zap size={14} />{t('delivery.vrpBtn')}
                    </button>
                    {planDetail.Status === 'DRAFT' && planDetail.routes?.length > 0 && (
                      <button onClick={confirmPlan} disabled={confirming} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-60">
                        {confirming ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={14} />}
                        {confirming ? t('delivery.confirming') : t('delivery.confirmPlan')}
                      </button>
                    )}
                    {planDetail.routes?.length > 0 && (
                      <button onClick={printDailyReport}
                        className="flex items-center gap-1.5 px-3 py-2 text-white text-sm rounded-lg font-medium transition-all"
                        style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 2px 10px rgba(220,38,38,0.3)' }}>
                        <Printer size={14} />{t('delivery.printReport')}
                      </button>
                    )}
                    <button onClick={() => setPlanDetail(null)} className="btn-secondary text-sm px-3 py-2"><X size={14} />{t('delivery.close')}</button>
                  </div>
                </div>

                {showVrpForm && (
                  <div className="mt-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-blue-500" />
                      <span className="font-semibold text-slate-900 text-sm">{t('delivery.vrpTitle')}</span>
                    </div>
                    <div className="space-y-2">
                      {vrpVehicles.map((v, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-slate-400 text-xs w-5">{i + 1}.</span>
                          <input value={v.licensePlate} onChange={e => updateVehicle(i, 'licensePlate', e.target.value.toUpperCase())}
                            className="input-field flex-1 text-sm uppercase font-mono" placeholder={t('delivery.platePH')} />
                          <input value={v.driverName} onChange={e => updateVehicle(i, 'driverName', e.target.value)}
                            className="input-field flex-1 text-sm" placeholder={t('delivery.driverPH')} />
                          <div className="flex items-center gap-1">
                            <input type="number" value={v.capacityTon} onChange={e => updateVehicle(i, 'capacityTon', parseFloat(e.target.value))}
                              className="input-field w-20 text-sm text-right" />
                            <span className="text-slate-500 text-xs w-6">{t('delivery.capacityLabel')}</span>
                          </div>
                          {vrpVehicles.length > 1 && (
                            <button onClick={() => removeVehicle(i)} className="text-red-500 hover:text-red-600 p-1"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addVehicle} className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"><Plus size={13} />{t('delivery.addVehicle')}</button>
                      <div className="ml-auto flex gap-2">
                        <button onClick={runVRP} disabled={vrpLoading}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm rounded-lg font-bold disabled:opacity-50">
                          <Zap size={14} className={vrpLoading ? 'animate-pulse' : ''} />
                          {vrpLoading ? t('delivery.calculating') : t('delivery.calcRoute')}
                        </button>
                        <button onClick={() => setShowVrpForm(false)} className="btn-secondary text-sm px-3 py-2">{t('common.cancel')}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {planDetail.routes?.length > 0 ? (
                <div className="space-y-3">
                  {planDetail.routes.map((route, ri) => (
                    <div key={route.RouteID} className="card">
                      <div className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedRoute(expandedRoute === route.RouteID ? null : route.RouteID)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
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
                              {route.StopCount} {t('delivery.stops')} · {parseFloat(route.TotalQty || 0).toFixed(2)} / {route.CapacityTon} t · {route.TotalDistKm} {t('unit.km')}
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
                              {completingRoute === route.RouteID ? t('common.saving') : t('status.complete')}
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
                                    <span className="text-xs text-slate-400">{stop.DistFromPrevKm} {t('unit.km')}</span>
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
                  {t('delivery.vrpBtn')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
