import { useState, useCallback, useEffect, useRef } from 'react';
import { Truck, Settings, X, Plus, Trash2, Fuel, Wrench, ShieldCheck, Radio, Wallet, Calculator, RefreshCw, MapPin, Search, Loader } from 'lucide-react';
import api from '../services/api';
import DraggableMap from '../components/DraggableMap';

const VEHICLE_TYPES = ['4ล้อ', '6ล้อ', '8ล้อ', '10ล้อ', '12ล้อ', 'เทรลเลอร์', 'พ่วง'];
const STORAGE_KEY = 'freightcalc_std_v1';

const makeDefaultVeh = () => ({
  kmPerL: 4, capacity: 2500,
  labor: 1154.72, laborOT: 0,
  insurance: 172.12, maintenance: 118.27, gps: 47.38,
  extras: [],
});

const DEFAULT_STD = {
  fuelPrice: 41.7,
  vehicles: Object.fromEntries(VEHICLE_TYPES.map(t => [t, makeDefaultVeh()])),
};

const fmt = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => parseFloat(v) || 0;

export default function FreightCalc() {
  const [std, setStd] = useState(() => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!s.vehicles) return DEFAULT_STD;
    const vehicles = { ...DEFAULT_STD.vehicles };
    VEHICLE_TYPES.forEach(t => { if (s.vehicles[t]) vehicles[t] = s.vehicles[t]; });
    return { fuelPrice: s.fuelPrice ?? 41.7, vehicles };
  });

  const [showStd, setShowStd] = useState(false);
  const [stdTab, setStdTab] = useState('4ล้อ');
  const [stdDraft, setStdDraft] = useState(null);

  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.get('/master/warehouses').then(r => setWarehouses(r.data.data || [])).catch(() => {});
  }, []);

  // destination map picker
  const [showDestMap, setShowDestMap] = useState(false);
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState([]);
  const [destSearching, setDestSearching] = useState(false);
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const destTimer = useRef(null);

  const searchDest = async (q) => {
    if (!q.trim()) { setDestResults([]); return; }
    setDestSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&countrycodes=th&accept-language=th,en`,
        { headers: { 'User-Agent': 'CS.Smart WMS/1.0' } }
      );
      setDestResults(await res.json());
    } catch { setDestResults([]); }
    finally { setDestSearching(false); }
  };

  const handleDestInput = (v) => {
    setDestQuery(v);
    clearTimeout(destTimer.current);
    destTimer.current = setTimeout(() => searchDest(v), 500);
  };

  const pickDestResult = (item) => {
    setDestLat(parseFloat(item.lat).toFixed(6));
    setDestLng(parseFloat(item.lon).toFixed(6));
    setDestQuery(item.display_name);
    setDestResults([]);
  };

  const confirmDest = () => {
    setDestination(destQuery);
    setShowDestMap(false);
    setDestResults([]);
  };

  const openDestMap = () => {
    setDestQuery(destination);
    setDestResults([]);
    setShowDestMap(true);
  };

  const [vehType, setVehType] = useState('4ล้อ');
  const [origin, setOrigin] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [destination, setDestination] = useState('');
  const [distKm, setDistKm] = useState('');
  const [distLoading, setDistLoading] = useState(false);
  const [toll, setToll] = useState('');
  const [others, setOthers] = useState('');
  const [hasOT, setHasOT] = useState(false);
  const [result, setResult] = useState(null);

  const handleOriginChange = (e) => {
    const name = e.target.value;
    const wh = warehouses.find(w => w.WarehouseName === name);
    setOrigin(name);
    setOriginLat(wh?.GpsLat ? String(wh.GpsLat) : '');
    setOriginLng(wh?.GpsLng ? String(wh.GpsLng) : '');
    setDistKm('');
    setResult(null);
  };

  useEffect(() => {
    if (!originLat || !originLng || !destLat || !destLng) return;
    setDistLoading(true);
    setDistKm('');
    setResult(null);
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`
    )
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          setDistKm((data.routes[0].distance / 1000).toFixed(1));
        }
      })
      .catch(() => {})
      .finally(() => setDistLoading(false));
  }, [originLat, originLng, destLat, destLng]);

  const saveStd = useCallback(() => {
    setStd(stdDraft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stdDraft));
    setShowStd(false);
  }, [stdDraft]);

  const openStd = () => {
    setStdDraft(JSON.parse(JSON.stringify(std)));
    setStdTab('4ล้อ');
    setShowStd(true);
  };

  const updateDraftVeh = (field, value) => {
    setStdDraft(d => ({
      ...d,
      vehicles: { ...d.vehicles, [stdTab]: { ...d.vehicles[stdTab], [field]: value } },
    }));
  };

  const addExtra = () => {
    setStdDraft(d => ({
      ...d,
      vehicles: {
        ...d.vehicles,
        [stdTab]: { ...d.vehicles[stdTab], extras: [...(d.vehicles[stdTab].extras || []), { name: '', amount: 0 }] },
      },
    }));
  };

  const updateExtra = (i, field, val) => {
    setStdDraft(d => {
      const extras = [...(d.vehicles[stdTab].extras || [])];
      extras[i] = { ...extras[i], [field]: val };
      return { ...d, vehicles: { ...d.vehicles, [stdTab]: { ...d.vehicles[stdTab], extras } } };
    });
  };

  const removeExtra = (i) => {
    setStdDraft(d => {
      const extras = (d.vehicles[stdTab].extras || []).filter((_, idx) => idx !== i);
      return { ...d, vehicles: { ...d.vehicles, [stdTab]: { ...d.vehicles[stdTab], extras } } };
    });
  };

  const reset = () => {
    setOrigin(''); setOriginLat(''); setOriginLng('');
    setDestination(''); setDistKm('');
    setToll(''); setOthers('');
    setHasOT(false); setResult(null);
    setDestQuery(''); setDestLat(''); setDestLng('');
  };

  const calculate = () => {
    const cfg = std.vehicles[vehType];
    const fuel = std.fuelPrice;
    const dist = num(distKm);
    const fuelCost = dist > 0 ? (dist * 2 / cfg.kmPerL) * fuel : 0;
    const laborCost = hasOT && cfg.laborOT > 0 ? cfg.laborOT : cfg.labor;
    const insuranceCost = cfg.insurance;
    const maintenanceCost = cfg.maintenance;
    const gpsCost = cfg.gps;
    const tollCost = num(toll);
    const othersCost = num(others);
    const extrasCost = (cfg.extras || []).reduce((s, e) => s + num(e.amount), 0);
    const total = fuelCost + laborCost + insuranceCost + maintenanceCost + gpsCost + tollCost + othersCost + extrasCost;
    const perKg = cfg.capacity > 0 ? total / cfg.capacity : 0;
    const perTon = cfg.capacity > 0 ? total / (cfg.capacity / 1000) : 0;

    setResult({
      vehType, origin, destination, distKm: dist, fuelPrice: fuel, hasOT,
      fuelCost, laborCost, insuranceCost, maintenanceCost, gpsCost,
      tollCost, othersCost, extrasCost, extras: cfg.extras || [],
      total, perKg, perTon, capacity: cfg.capacity,
      kmPerL: cfg.kmPerL, isOT: hasOT && cfg.laborOT > 0,
    });
  };

  const cfg = std.vehicles[vehType];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Truck size={20} className="text-red-500 flex-shrink-0" />
            คำนวณค่าขนส่ง
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">คำนวณต้นทุนค่าขนส่งต่อเที่ยว รวมขาไปและขากลับ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset}
            className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 border border-slate-200 bg-white transition-colors"
            title="ล้างค่า">
            <RefreshCw size={15} />
          </button>
          <button onClick={openStd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <Settings size={14} /> ตั้งค่า STD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: Form ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* ประเภทรถ */}
          <div className="card">
            <p className="card-header">ประเภทรถ</p>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map(t => (
                <button key={t} onClick={() => { setVehType(t); setResult(null); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    vehType === t
                      ? 'text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={vehType === t ? { background: '#dc2626' } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ต้นทาง / ปลายทาง */}
          <div className="card">
            <p className="card-header">เส้นทาง</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ต้นทาง (คลังสินค้า)</label>
                <select value={origin} onChange={handleOriginChange} className="input-field">
                  <option value="">-- เลือกคลังสินค้า --</option>
                  {warehouses.map(w => (
                    <option key={w.WarehouseID} value={w.WarehouseName}>{w.WarehouseName}</option>
                  ))}
                </select>
                {origin && !originLat && (
                  <p className="text-xs mt-1 text-amber-500">คลังนี้ยังไม่มีพิกัด GPS — กรุณาตั้งค่าใน Master</p>
                )}
              </div>
              <div>
                <label className="label">ปลายทาง <span className="text-red-500">*</span></label>
                <button type="button" onClick={openDestMap}
                  className="input-field w-full text-left flex items-center gap-2 cursor-pointer">
                  <MapPin size={14} className={destination ? 'text-red-500' : 'text-slate-300'} />
                  <span className={`truncate ${destination ? 'text-slate-800' : 'text-slate-400'}`}>
                    {destination || 'ค้นหาและปักหมุดปลายทาง...'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ค่าใช้จ่าย */}
          <div className="card">
            <p className="card-header">ค่าใช้จ่าย</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">ระยะทาง (ไป-กลับ)</label>
                <div className="input-field flex items-center gap-2 bg-slate-50 cursor-default select-none">
                  {distLoading ? (
                    <>
                      <Loader size={13} className="text-slate-400 animate-spin flex-shrink-0" />
                      <span className="text-slate-400 text-sm">กำลังคำนวณ...</span>
                    </>
                  ) : num(distKm) > 0 ? (
                    <>
                      <span className="font-semibold text-slate-800">{(num(distKm) * 2).toLocaleString()} กม.</span>
                      <span className="text-slate-400 text-xs">({distKm} × 2)</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">เลือกต้นทาง + ปลายทาง</span>
                  )}
                </div>
              </div>
              <div>
                <label className="label">ค่าทางด่วน (บ.)</label>
                <input type="number" min="0" value={toll}
                  onChange={e => { setToll(e.target.value); setResult(null); }}
                  className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="label">อื่นๆ (บ.)</label>
                <input type="number" min="0" value={others}
                  onChange={e => { setOthers(e.target.value); setResult(null); }}
                  className="input-field" placeholder="0" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-4 w-fit">
              <input type="checkbox" checked={hasOT} onChange={e => { setHasOT(e.target.checked); setResult(null); }}
                className="w-4 h-4 rounded accent-red-600" />
              <span className="text-sm font-semibold text-slate-600">🌙 มี OT (นอกเวลา)</span>
              {hasOT && cfg.laborOT === 0 && (
                <span className="text-xs text-amber-500">(ยังไม่ตั้งค่า OT — ใช้ STD แทน)</span>
              )}
            </label>
          </div>

          <button onClick={calculate}
            className="btn-primary w-full py-3 text-base">
            <Calculator size={18} /> คำนวณค่าขนส่ง
          </button>
        </div>

        {/* ── Right: Result ── */}
        <div>
          {result ? (
            <div className="card p-0 overflow-hidden sticky top-5">
              {/* Result header */}
              <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                <p className="text-white/70 text-xs font-semibold">ค่าขนส่งรวม / เที่ยว (ไป-กลับ)</p>
                <p className="text-3xl font-black mt-0.5">{fmt(result.total)}</p>
                <p className="text-white/80 text-sm">บาท</p>
                {result.origin && result.destination && (
                  <p className="text-white/60 text-xs mt-2">{result.origin} → {result.destination}</p>
                )}
                {result.distKm > 0 && (
                  <p className="text-white/60 text-xs">{result.distKm} กม. × 2 = {result.distKm * 2} กม.</p>
                )}
              </div>

              {/* Per unit */}
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">บาท / กก.</p>
                  <p className="text-lg font-black text-blue-600">{fmt(result.perKg)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">บาท / ตัน</p>
                  <p className="text-lg font-black text-emerald-600">{fmt(result.perTon)}</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="px-5 py-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">รายละเอียด</p>
                {[
                  { icon: Fuel,         label: 'ค่าเชื้อเพลิง',                   value: result.fuelCost,        note: result.distKm > 0 ? `${result.distKm * 2} กม. ÷ ${result.kmPerL} × ${fmt(result.fuelPrice)}` : null, skip: result.distKm === 0 },
                  { icon: Wallet,       label: `ค่าแรง${result.isOT ? ' (OT)' : ' STD'}`, value: result.laborCost },
                  { icon: ShieldCheck,  label: 'ประกัน + ภาษี',                   value: result.insuranceCost },
                  { icon: Wrench,       label: 'ซ่อมบำรุง',                        value: result.maintenanceCost },
                  { icon: Radio,        label: 'GPS',                              value: result.gpsCost },
                  { icon: Truck,        label: 'ค่าทางด่วน',                      value: result.tollCost,        skip: result.tollCost === 0 },
                  { icon: Truck,        label: 'อื่นๆ',                            value: result.othersCost,      skip: result.othersCost === 0 },
                  ...(result.extras || []).filter(e => e.name && num(e.amount) > 0).map(e => ({
                    icon: Wallet, label: e.name, value: num(e.amount),
                  })),
                ].filter(r => !r.skip).map((row, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <row.icon size={13} className="text-slate-300 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-sm text-slate-600">{row.label}</span>
                        {row.note && <p className="text-xs text-slate-400 leading-tight">{row.note}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-shrink-0">{fmt(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-800">รวมทั้งหมด</span>
                  <span className="text-base font-black text-red-600">{fmt(result.total)} บ.</span>
                </div>
                <p className="text-xs text-slate-400">บรรทุก {result.capacity.toLocaleString()} กก. ({(result.capacity / 1000).toFixed(1)} ตัน)</p>
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Calculator size={36} className="text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-400">กรอกข้อมูลแล้วกด<br />คำนวณค่าขนส่ง</p>
            </div>
          )}
        </div>
      </div>

      {/* ── STD SETTINGS MODAL ── */}
      {showStd && stdDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowStd(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl bg-white max-h-[90vh] flex flex-col"
            onMouseDown={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-red-500" />
                <h3 className="font-bold text-slate-800">ตั้งค่า STD ค่าขนส่ง</h3>
              </div>
              <button onClick={() => setShowStd(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Fuel price */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 border border-red-100">
                <Fuel size={16} className="text-red-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="label">ราคาน้ำมัน (STD)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min="0"
                      value={stdDraft.fuelPrice}
                      onChange={e => setStdDraft(d => ({ ...d, fuelPrice: parseFloat(e.target.value) || 0 }))}
                      className="input-field w-28 text-center font-bold" style={{ borderColor: '#fca5a5' }} />
                    <span className="text-sm text-slate-500">บาท/ลิตร</span>
                  </div>
                </div>
              </div>

              {/* Vehicle tabs */}
              <div>
                <label className="label">ค่าใช้จ่ายตามประเภทรถ</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {VEHICLE_TYPES.map(t => (
                    <button key={t} onClick={() => setStdTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        stdTab === t ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={stdTab === t ? { background: '#dc2626' } : {}}>
                      {t}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">กม./ลิตร</label>
                      <input type="number" min="0" step="0.1" value={stdDraft.vehicles[stdTab].kmPerL}
                        onChange={e => updateDraftVeh('kmPerL', parseFloat(e.target.value) || 0)}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="label">น้ำหนักบรรทุก (กก.)</label>
                      <input type="number" min="0" value={stdDraft.vehicles[stdTab].capacity}
                        onChange={e => updateDraftVeh('capacity', parseFloat(e.target.value) || 0)}
                        className="input-field" />
                    </div>
                  </div>

                  {[
                    { field: 'labor',       label: 'ค่าแรง STD (บ./เที่ยว)' },
                    { field: 'laborOT',     label: 'ค่าแรง OT (บ./เที่ยว)' },
                    { field: 'insurance',   label: 'ประกัน + ภาษี (บ./เที่ยว)' },
                    { field: 'maintenance', label: 'ซ่อมบำรุง (บ./เที่ยว)' },
                    { field: 'gps',         label: 'GPS (บ./เที่ยว)' },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <label className="label">{label}</label>
                      <input type="number" min="0" step="0.01" value={stdDraft.vehicles[stdTab][field]}
                        onChange={e => updateDraftVeh(field, parseFloat(e.target.value) || 0)}
                        className="input-field" />
                    </div>
                  ))}

                  {/* Extra items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">รายการเพิ่มเติม</label>
                      <button onClick={addExtra} className="btn-primary px-3 py-1 text-xs">
                        <Plus size={11} /> เพิ่มรายการ
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(stdDraft.vehicles[stdTab].extras || []).map((ex, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" value={ex.name}
                            onChange={e => updateExtra(i, 'name', e.target.value)}
                            placeholder="ชื่อรายการ" className="input-field flex-1" />
                          <input type="number" min="0" step="0.01" value={ex.amount}
                            onChange={e => updateExtra(i, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="0" className="input-field w-28 text-right" />
                          <span className="text-xs text-slate-400 flex-shrink-0">บ.</span>
                          <button onClick={() => removeExtra(i)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">ค่าใช้จ่ายต่อเที่ยว รวมทั้งขาไปและขากลับ</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setShowStd(false)} className="btn-secondary flex-1 py-2.5">ยกเลิก</button>
              <button onClick={saveStd} className="btn-primary flex-1 py-2.5">✓ บันทึก STD</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DESTINATION MAP MODAL ── */}
      {showDestMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowDestMap(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl bg-white max-h-[90vh] flex flex-col"
            onMouseDown={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-red-500" />
                <h3 className="font-bold text-slate-800">เลือกปลายทาง</h3>
              </div>
              <button onClick={() => setShowDestMap(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0" style={{ position: 'relative', zIndex: 10 }}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={destQuery}
                  onChange={e => handleDestInput(e.target.value)}
                  placeholder="ค้นหาสถานที่... เช่น กรุงเทพฯ, สมุทรสาคร"
                  className="input-field pl-8 pr-8"
                />
                {destSearching && (
                  <Loader size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Results inline list — replaces map while searching */}
            {destResults.length > 0 ? (
              <div className="flex-1 overflow-y-auto border-b border-slate-100">
                {destResults.map((item, i) => (
                  <button key={i} onClick={() => pickDestResult(item)}
                    className="w-full text-left px-5 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 border-b border-slate-50 last:border-b-0 leading-snug transition-colors">
                    <span className="font-semibold block">{item.display_name.split(',')[0]}</span>
                    <span className="text-slate-400 text-xs truncate block">{item.display_name}</span>
                  </button>
                ))}
              </div>
            ) : destLat && destLng ? (
              <div className="flex-1 min-h-0" style={{ minHeight: 280 }}>
                <DraggableMap
                  lat={destLat}
                  lng={destLng}
                  onMove={(lat, lng) => { setDestLat(lat); setDestLng(lng); }}
                  height={280}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-14 text-center bg-slate-50">
                <MapPin size={36} className="text-slate-200 mb-3" />
                <p className="text-sm font-semibold text-slate-400">ค้นหาและเลือกสถานที่</p>
                <p className="text-xs text-slate-300 mt-1">แผนที่จะแสดงหลังจากเลือกสถานที่</p>
              </div>
            )}

            {destLat && !destResults.length && (
              <p className="text-xs text-slate-400 text-center py-1.5 flex-shrink-0 bg-slate-50 border-t border-slate-100">
                📍 {destLat}, {destLng} — ลากหมุดเพื่อปรับตำแหน่ง
              </p>
            )}

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setShowDestMap(false)} className="btn-secondary flex-1 py-2.5">ยกเลิก</button>
              <button onClick={confirmDest} disabled={!destQuery.trim()}
                className="btn-primary flex-1 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <MapPin size={14} /> ยืนยันปลายทาง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
