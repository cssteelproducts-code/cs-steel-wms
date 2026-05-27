import { useState, useEffect, useRef } from 'react';
import { Scale, Clock, Search, AlertCircle, CheckCircle, RotateCcw, Truck, Hash, Pencil, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatWeight } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge';

const DELIVERY_TYPES = [
  { id: 'CSS', label: 'CSS.' },
  { id: 'Customer', label: 'Customer' },
  { id: 'Supplier', label: 'Sup.' }
];

export default function WeighIn() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const timeNow = () => new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState({
    licensePlate: '', vehicleTypeId: '', warehouseId: '',
    customerId: '', deliveryType: '', tareWeight: '',
    entryTime: timeNow(), notes: ''
  });
  const [masters, setMasters] = useState({ vehicleTypes: [], warehouses: [], customers: [] });
  const [todayList, setTodayList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [plateCheck, setPlateCheck] = useState(null);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custName, setCustName] = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custTimer = useRef(null);
  const plateTimer = useRef(null);
  const [editTrip, setEditTrip] = useState(null); // trip being edited
  const [editForm, setEditForm] = useState({});
  const [editCustQuery, setEditCustQuery] = useState('');
  const [editCustName, setEditCustName] = useState('');
  const [editCustResults, setEditCustResults] = useState([]);
  const [editCustDrop, setEditCustDrop] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchMasters();
    fetchTodayList();
    const interval = setInterval(fetchTodayList, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMasters = async () => {
    try {
      const [vt, wh, cu] = await Promise.all([
        api.get('/master/vehicle-types'),
        api.get('/master/warehouses'),
        api.get('/master/customers')
      ]);
      setMasters({
        vehicleTypes: vt.data.data || [],
        warehouses: wh.data.data || [],
        customers: cu.data.data || []
      });
    } catch {} finally { setPageLoading(false); }
  };

  const fetchTodayList = async () => {
    try {
      const res = await api.get('/weigh-in/today');
      setTodayList(res.data.data || []);
    } catch {}
  };

  const checkPlate = async (plate) => {
    if (!plate || plate.length < 3) { setPlateCheck(null); return; }
    setChecking(true);
    try {
      const res = await api.get(`/weigh-in/check/${encodeURIComponent(plate.toUpperCase())}`);
      setPlateCheck(res.data);
    } catch {} finally { setChecking(false); }
  };

  const handlePlateChange = (e) => {
    const val = e.target.value.toUpperCase();
    setForm(p => ({ ...p, licensePlate: val }));
    clearTimeout(plateTimer.current);
    plateTimer.current = setTimeout(() => checkPlate(val), 500);
  };

  const handleCustInput = (val) => {
    setCustQuery(val);
    setCustName('');
    setForm(p => ({ ...p, customerId: '' }));
    clearTimeout(custTimer.current);
    if (!val.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    custTimer.current = setTimeout(() => {
      const q = val.toLowerCase();
      const filtered = masters.customers.filter(c =>
        c.ARCode?.toLowerCase().includes(q) || c.CustomerName?.toLowerCase().includes(q)
      ).slice(0, 8);
      setCustResults(filtered);
      setShowCustDrop(filtered.length > 0);
    }, 200);
  };

  const pickCustomer = (c) => {
    setCustQuery(c.ARCode || '');
    setCustName(c.CustomerName);
    setForm(p => ({ ...p, customerId: c.CustomerID }));
    setShowCustDrop(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (plateCheck?.inYard) {
      toast.error(`ทะเบียน ${form.licensePlate} ยังอยู่ในคลัง`);
      return;
    }
    if (!form.warehouseId) { toast.error('กรุณาเลือกคลังสินค้า'); return; }
    if (!form.vehicleTypeId) { toast.error('กรุณาเลือกประเภทรถ'); return; }
    setLoading(true);
    try {
      const res = await api.post('/weigh-in', form);
      if (res.data.success) {
        toast.success(res.data.message);
        setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', deliveryType: '', tareWeight: '', entryTime: timeNow(), notes: '' });
        setPlateCheck(null);
        setCustQuery('');
        setCustName('');
        fetchTodayList();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  const openEdit = (t) => {
    setEditTrip(t);
    setEditForm({
      vehicleTypeId: t.VehicleTypeID || '',
      warehouseId: t.WarehouseID || '',
      customerId: t.CustomerID || '',
      deliveryType: t.DeliveryType || '',
      tareWeight: t.TareWeight || '',
      notes: t.Notes || ''
    });
    setEditCustQuery(t.CustomerARCode || '');
    setEditCustName(t.CustomerName || '');
    setEditCustResults([]);
    setEditCustDrop(false);
  };

  const handleEditCustInput = (val) => {
    setEditCustQuery(val);
    setEditCustName('');
    setEditForm(p => ({ ...p, customerId: '' }));
    if (!val.trim()) { setEditCustResults([]); setEditCustDrop(false); return; }
    const q = val.toLowerCase();
    const filtered = masters.customers.filter(c =>
      c.ARCode?.toLowerCase().includes(q) || c.CustomerName?.toLowerCase().includes(q)
    ).slice(0, 8);
    setEditCustResults(filtered);
    setEditCustDrop(filtered.length > 0);
  };

  const pickEditCustomer = (c) => {
    setEditCustQuery(c.ARCode || '');
    setEditCustName(c.CustomerName);
    setEditForm(p => ({ ...p, customerId: c.CustomerID }));
    setEditCustDrop(false);
  };

  const saveEdit = async () => {
    if (!editTrip) return;
    setEditLoading(true);
    try {
      const res = await api.put(`/weigh-in/${editTrip.TripID}`, editForm);
      if (res.data.success) {
        toast.success('แก้ไขข้อมูลสำเร็จ');
        setEditTrip(null);
        fetchTodayList();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'แก้ไขไม่สำเร็จ');
    } finally { setEditLoading(false); }
  };

  const resetForm = () => {
    setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', deliveryType: '', tareWeight: '', entryTime: timeNow(), notes: '' });
    setPlateCheck(null);
    setCustQuery('');
    setCustName('');
  };

  const Pill = ({ item, active, onClick, stretch }) => (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all text-center ${stretch ? 'w-full' : ''} ${
        active
          ? 'bg-red-600 border-red-600 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-600'
      }`}>
      {item.label || item.TypeName || item.WarehouseName}
    </button>
  );

  const totalToday = todayList.length;

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลดข้อมูล..." />
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ── Top stat bar ── */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <div className="card py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-red-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">{totalToday}</div>
            <div className="text-xs text-slate-500 mt-0.5">รถเข้าวันนี้</div>
          </div>
        </div>
        <div className="card py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Scale size={18} className="text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {todayList.filter(t => t.Status === 'Data' || t.Status === 'WeighIn').length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">อยู่ในคลัง</div>
          </div>
        </div>
        <div className="card py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {todayList.filter(t => t.Status === 'Complete').length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">เสร็จสิ้น</div>
          </div>
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 min-h-0">

        {/* ── LEFT: Form ── */}
        <div className="card overflow-hidden flex flex-col p-0">
          {/* Form body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {/* Date / Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-slate-500">วันที่</div>
                <div className="rounded-lg px-3 h-10 flex items-center text-sm font-medium text-slate-700 bg-slate-100">{todayStr}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1 text-slate-500">
                  <Clock size={10} />เวลาเข้า
                </div>
                <input type="time" value={form.entryTime}
                  onChange={e => setForm(p => ({ ...p, entryTime: e.target.value }))}
                  className="input-field w-full h-10 text-sm" />
                <div className="text-red-500 text-[10px] mt-0.5">แก้ไขเวลาได้ก่อนบันทึก</div>
              </div>
            </div>

            {/* Warehouse pills */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">คลังสินค้า *</div>
              <div className="flex flex-wrap gap-1.5">
                {masters.warehouses.map(w => (
                  <Pill key={w.WarehouseID} item={w}
                    active={String(form.warehouseId) === String(w.WarehouseID)}
                    onClick={() => setForm(p => ({ ...p, warehouseId: w.WarehouseID }))} />
                ))}
              </div>
            </div>

            {/* License plate */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ทะเบียนรถ *</div>
              <div className="relative">
                <input type="text" value={form.licensePlate} onChange={handlePlateChange}
                  className="input-field w-full py-2.5 text-slate-900 text-xl font-bold tracking-widest uppercase placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm placeholder:tracking-normal"
                  placeholder="เช่น กข-1234" required />
                {checking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {plateCheck?.inYard && (
                <div className="mt-1.5 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  <AlertCircle size={13} /><span className="text-xs font-medium">ยังอยู่ในคลัง! Trip #{plateCheck.trip?.TripID}</span>
                </div>
              )}
              {plateCheck && !plateCheck.inYard && form.licensePlate && (
                <div className="mt-1 flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <CheckCircle size={11} />พร้อมบันทึก
                </div>
              )}
            </div>

            {/* Vehicle type pills */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ประเภทรถ *</div>
              <div className="grid grid-cols-4 gap-1.5">
                {masters.vehicleTypes.map(vt => (
                  <Pill key={vt.TypeID} item={vt} stretch
                    active={String(form.vehicleTypeId) === String(vt.TypeID)}
                    onClick={() => setForm(p => ({ ...p, vehicleTypeId: vt.TypeID }))} />
                ))}
              </div>
            </div>

            {/* Delivery type pills */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ขนส่ง</div>
              <div className="grid grid-cols-3 gap-1.5">
                {DELIVERY_TYPES.map(dt => (
                  <Pill key={dt.id} item={dt} stretch
                    active={form.deliveryType === dt.id}
                    onClick={() => setForm(p => ({ ...p, deliveryType: p.deliveryType === dt.id ? '' : dt.id }))} />
                ))}
              </div>
            </div>

            {/* Customer */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ลูกค้า (ARCODE / ชื่อ)</div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={custQuery} onChange={e => handleCustInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCustDrop(false), 150)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                  placeholder="พิมพ์ ARCODE หรือชื่อลูกค้า" />
                {showCustDrop && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto">
                    {custResults.map(c => (
                      <button key={c.CustomerID} type="button" onMouseDown={() => pickCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <div className="text-sm font-semibold text-slate-900">{c.ARCode}</div>
                        <div className="text-xs text-slate-500">{c.CustomerName}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {custName && (
                <div className="mt-1 text-xs text-red-600 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200">
                  {custName}
                </div>
              )}
            </div>

            {/* Tare weight */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">น้ำหนักเบา (กก.)</div>
              <input type="number" step="0.01" value={form.tareWeight}
                onChange={e => setForm(p => ({ ...p, tareWeight: e.target.value }))}
                className="input-field w-full py-2 text-sm"
                placeholder="0.00" />
            </div>

            {/* Notes */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">หมายเหตุ</div>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="input-field w-full py-2 text-sm resize-none"
                rows={2} placeholder="หมายเหตุ (ถ้ามี)" />
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-1 pb-2">
              <button type="submit" disabled={loading || plateCheck?.inYard}
                className="w-full py-3.5 rounded-xl text-white font-bold text-base tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 60%,#991b1b 100%)', boxShadow: '0 4px 18px rgba(185,28,28,0.3)' }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />กำลังบันทึก...</span>
                  : '✓  บันทึกรับรถ'}
              </button>
              <button type="button" onClick={resetForm}
                className="w-full py-2 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-1.5 transition-all hover:text-slate-700 bg-slate-100 border border-slate-200">
                <RotateCcw size={12} />ล้างข้อมูล
              </button>
            </div>
          </form>
        </div>

        {/* ── RIGHT: Today list ── */}
        <div className="card flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Truck size={17} className="text-red-500" />
              <span className="font-semibold text-slate-900">รายการวันนี้</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{todayList.length}</span>
            </div>
            <button onClick={fetchTodayList} className="text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1">
              <RotateCcw size={11} />รีเฟรช
            </button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-4 px-4">
            {todayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Scale size={32} className="mb-2 opacity-30" />
                <span className="text-sm">ยังไม่มีรายการวันนี้</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayList.map((t, i) => (
                  <div key={t.TripID} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                    {/* Index */}
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-500 text-xs font-bold">{i + 1}</span>
                    </div>

                    {/* Plate + details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-bold text-sm tracking-wide">{t.LicensePlate}</span>
                        <span className="text-slate-400 text-xs">#{t.TripID}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {t.VehicleType}
                        {t.WarehouseName && ` · ${t.WarehouseName}`}
                        {t.CustomerName && ` · ${t.CustomerName}`}
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-slate-700">
                        {t.TareWeight ? `${Number(t.TareWeight).toLocaleString()} กก.` : '—'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.WeighDateTime ? new Date(t.WeighDateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>

                    {/* Status + Edit */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={t.Status} />
                      <button onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="แก้ไข">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Modal */}
      {editTrip && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-900">แก้ไขข้อมูลชั่งเข้า</div>
                <div className="text-xs text-slate-500 mt-0.5">{editTrip.LicensePlate} · #{editTrip.TripID}</div>
              </div>
              <button onClick={() => setEditTrip(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* คลังสินค้า */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">คลังสินค้า</div>
                <div className="flex flex-wrap gap-1.5">
                  {masters.warehouses.map(w => (
                    <Pill key={w.WarehouseID} item={w}
                      active={String(editForm.warehouseId) === String(w.WarehouseID)}
                      onClick={() => setEditForm(p => ({ ...p, warehouseId: w.WarehouseID }))} />
                  ))}
                </div>
              </div>

              {/* ประเภทรถ */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ประเภทรถ</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {masters.vehicleTypes.map(vt => (
                    <Pill key={vt.TypeID} item={vt} stretch
                      active={String(editForm.vehicleTypeId) === String(vt.TypeID)}
                      onClick={() => setEditForm(p => ({ ...p, vehicleTypeId: vt.TypeID }))} />
                  ))}
                </div>
              </div>

              {/* ประเภทขนส่ง */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ขนส่ง</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DELIVERY_TYPES.map(dt => (
                    <Pill key={dt.id} item={dt} stretch
                      active={editForm.deliveryType === dt.id}
                      onClick={() => setEditForm(p => ({ ...p, deliveryType: p.deliveryType === dt.id ? '' : dt.id }))} />
                  ))}
                </div>
              </div>

              {/* ลูกค้า */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">ลูกค้า</div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={editCustQuery} onChange={e => handleEditCustInput(e.target.value)}
                    onBlur={() => setTimeout(() => setEditCustDrop(false), 150)}
                    className="input-field w-full pl-9 pr-3 py-2 text-sm"
                    placeholder="พิมพ์ ARCODE หรือชื่อลูกค้า" />
                  {editCustDrop && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                      {editCustResults.map(c => (
                        <button key={c.CustomerID} type="button" onMouseDown={() => pickEditCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <div className="text-sm font-semibold text-slate-900">{c.ARCode}</div>
                          <div className="text-xs text-slate-500">{c.CustomerName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {editCustName && (
                  <div className="mt-1 text-xs text-red-600 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200">{editCustName}</div>
                )}
              </div>

              {/* น้ำหนักเบา */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">น้ำหนักเบา (กก.)</div>
                <input type="number" step="0.01" value={editForm.tareWeight}
                  onChange={e => setEditForm(p => ({ ...p, tareWeight: e.target.value }))}
                  className="input-field w-full py-2 text-sm" placeholder="0.00" />
              </div>

              {/* หมายเหตุ */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-500">หมายเหตุ</div>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field w-full py-2 text-sm resize-none" rows={2} />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setEditTrip(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">ยกเลิก</button>
              <button onClick={saveEdit} disabled={editLoading}
                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {editLoading ? 'กำลังบันทึก...' : 'บันทึกแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
