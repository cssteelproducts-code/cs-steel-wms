import { useState, useEffect, useRef } from 'react';
import { Scale, Clock, Search, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';

const PRIORITY_IDS = ['ปกติ', 'เร่งด่วน', 'ด่วนมาก'];
const PRIORITY_KEYS = { 'ปกติ': 'priority.normal', 'เร่งด่วน': 'priority.urgent', 'ด่วนมาก': 'priority.veryUrgent' };

const DELIVERY_TYPES = [
  { id: 'CSS', label: 'CSS.' },
  { id: 'Customer', label: 'Customer' },
  { id: 'Supplier', label: 'Sup.' }
];

export default function WeighIn() {
  const { t } = useLang();
  // Always compute Thailand date/time (UTC+7) regardless of browser timezone
  const todayStr = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const timeNow = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(11, 16);

  const [form, setForm] = useState({
    licensePlate: '', vehicleTypeId: '', warehouseId: '',
    customerId: '', deliveryType: '', priority: 'ปกติ', tareWeight: '',
    entryTime: timeNow(), notes: ''
  });
  const [masters, setMasters] = useState({ vehicleTypes: [], warehouses: [], customers: [] });
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

  useEffect(() => { fetchMasters(); }, []);

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
      toast.error(`${t('weighIn.stillInYard')}${form.licensePlate}`);
      return;
    }
    if (!form.warehouseId) { toast.error(t('weighIn.warehouseLabel')); return; }
    if (!form.vehicleTypeId) { toast.error(t('weighIn.vehicleTypeLabel')); return; }
    setLoading(true);
    try {
      const res = await api.post('/weigh-in', { ...form, entryDate: todayStr });
      if (res.data.success) {
        const savedTime = form.entryTime;
        toast.success(`${res.data.message} | เวลาเข้า: ${savedTime} น.`);
        setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', deliveryType: '', priority: 'ปกติ', tareWeight: '', entryTime: timeNow(), notes: '' });
        setPlateCheck(null);
        setCustQuery('');
        setCustName('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', deliveryType: '', priority: 'ปกติ', tareWeight: '', entryTime: timeNow(), notes: '' });
    setPlateCheck(null);
    setCustQuery('');
    setCustName('');
  };

  const Pill = ({ item, active, onClick, stretch, label }) => (
    <button type="button" onClick={onClick}
      className={`px-2 py-1.5 rounded-full text-xs font-medium border transition-all text-center leading-tight ${stretch ? 'w-full' : ''} ${
        active
          ? 'bg-red-600 border-red-600 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-600'
      }`}>
      {label || item.label || item.TypeName || item.WarehouseName}
    </button>
  );

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );

  const Label = ({ children }) => (
    <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-400">{children}</div>
  );

  return (
    <div className="h-full">
      <div className="card overflow-hidden flex flex-col p-0 h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            <Scale size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-900">{t('weighIn.title')}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 h-full">

            {/* LEFT */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('common.date')}</Label>
                  <div className="rounded-xl px-3 h-10 flex items-center text-sm font-medium text-slate-700 bg-slate-100">{todayStr}</div>
                </div>
                <div>
                  <Label><span className="flex items-center gap-1"><Clock size={10} />{t('weighIn.entryTime')}</span></Label>
                  <div className="input-field h-10 flex items-center gap-0 px-2">
                    <select value={form.entryTime.split(':')[0]} onChange={e => setForm(p => ({ ...p, entryTime: `${e.target.value}:${p.entryTime.split(':')[1]}` }))}
                      className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer">
                      {Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-slate-400 font-bold text-sm select-none">:</span>
                    <select value={form.entryTime.split(':')[1]} onChange={e => setForm(p => ({ ...p, entryTime: `${p.entryTime.split(':')[0]}:${e.target.value}` }))}
                      className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer">
                      {Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="text-red-400 text-[10px] mt-0.5">{t('weighIn.editBeforeSave')}</div>
                </div>
              </div>

              <div>
                <Label>{t('weighIn.licensePlateLabel')}</Label>
                <div className="relative">
                  <input type="text" value={form.licensePlate} onChange={handlePlateChange}
                    className="input-field w-full h-10 text-slate-900 text-xl font-bold tracking-widest uppercase placeholder:text-slate-300 placeholder:font-normal placeholder:text-sm placeholder:tracking-normal"
                    placeholder={t('weighIn.licensePlatePlaceholder')} required />
                  {checking && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {plateCheck?.inYard && (
                  <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">
                    <AlertCircle size={14} /><span className="text-xs font-medium">{t('weighIn.stillInYard')} Trip #{plateCheck.trip?.TripID}</span>
                  </div>
                )}
                {plateCheck && !plateCheck.inYard && form.licensePlate && (
                  <div className="mt-1.5 flex items-center gap-1 text-emerald-600 text-xs font-medium">
                    <CheckCircle size={12} />{t('weighIn.readyToRecord')}
                  </div>
                )}
              </div>

              <div>
                <Label>{t('weighIn.vehicleTypeLabel')}</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {masters.vehicleTypes.map(vt => (
                    <Pill key={vt.TypeID} item={vt} stretch
                      active={String(form.vehicleTypeId) === String(vt.TypeID)}
                      onClick={() => setForm(p => ({ ...p, vehicleTypeId: vt.TypeID }))} />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <div>
                <Label>{t('weighIn.warehouseLabel')}</Label>
                <div className="flex flex-wrap gap-2">
                  {masters.warehouses.map(w => (
                    <Pill key={w.WarehouseID} item={w}
                      active={String(form.warehouseId) === String(w.WarehouseID)}
                      onClick={() => setForm(p => ({ ...p, warehouseId: w.WarehouseID }))} />
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('weighIn.priorityLabel')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITY_IDS.map(id => (
                    <Pill key={id} item={{}} stretch label={t(PRIORITY_KEYS[id])}
                      active={form.priority === id}
                      onClick={() => setForm(p => ({ ...p, priority: id }))} />
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('weighIn.deliveryLabel')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {DELIVERY_TYPES.map(dt => (
                    <Pill key={dt.id} item={dt} stretch
                      active={form.deliveryType === dt.id}
                      onClick={() => setForm(p => ({ ...p, deliveryType: p.deliveryType === dt.id ? '' : dt.id }))} />
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('weighIn.tareWeightLabel')}</Label>
                <input type="number" step="0.01" value={form.tareWeight}
                  onChange={e => setForm(p => ({ ...p, tareWeight: e.target.value }))}
                  className="input-field w-full h-10 text-sm"
                  placeholder="0.00" />
              </div>

              <div>
                <Label>{t('weighIn.customerLabel')}</Label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={custQuery} onChange={e => handleCustInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCustDrop(false), 150)}
                    className="input-field w-full pl-9 pr-3 h-10 text-sm"
                    placeholder={t('weighIn.customerPlaceholder')} />
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
                  <div className="mt-1.5 text-xs text-red-600 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200">
                    {custName}
                  </div>
                )}
              </div>

              <div>
                <Label>{t('common.note')}</Label>
                <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field w-full h-10 text-sm"
                  placeholder={t('weighIn.notesPlaceholder')} />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 pt-1">
                <button type="submit" disabled={loading || plateCheck?.inYard}
                  className="py-3.5 rounded-xl text-white font-bold text-base tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 60%,#991b1b 100%)', boxShadow: '0 4px 18px rgba(185,28,28,0.3)' }}>
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('common.saving')}</span>
                    : t('weighIn.submit')}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-5 py-3.5 rounded-xl text-slate-500 text-sm font-medium flex items-center gap-2 transition-all hover:text-slate-700 bg-slate-100 border border-slate-200 whitespace-nowrap">
                  <RotateCcw size={13} />{t('common.clearForm')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
