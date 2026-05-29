import { useState, useCallback } from 'react';
import { Calculator, Settings, X, Plus, Trash2, Fuel, Wrench, ShieldCheck, Radio, Wallet, ChevronRight } from 'lucide-react';

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
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const [std, setStd] = useState(() => {
    const s = stored;
    if (!s.vehicles) return DEFAULT_STD;
    // Ensure all vehicle types exist
    const vehicles = { ...DEFAULT_STD.vehicles };
    VEHICLE_TYPES.forEach(t => { if (s.vehicles[t]) vehicles[t] = s.vehicles[t]; });
    return { fuelPrice: s.fuelPrice ?? 41.7, vehicles };
  });

  const [showStd, setShowStd] = useState(false);
  const [stdTab, setStdTab] = useState('4ล้อ');
  const [stdDraft, setStdDraft] = useState(null);

  const [vehType, setVehType] = useState('4ล้อ');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [distKm, setDistKm] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [toll, setToll] = useState('');
  const [others, setOthers] = useState('');
  const [hasOT, setHasOT] = useState(false);
  const [result, setResult] = useState(null);

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

  const calculate = () => {
    const cfg = std.vehicles[vehType];
    const fuel = num(fuelPrice) || std.fuelPrice;
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
      isOT: hasOT && cfg.laborOT > 0,
    });
  };

  const inputCls = 'w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none';
  const inputStyle = { border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' };
  const labelCls = 'block text-xs font-bold mb-1.5 text-gray-500';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black" style={{ color: '#111827' }}>คำนวณค่าขนส่ง</h2>
          <p className="text-sm font-medium mt-0.5 text-gray-400">คำนวณต้นทุนค่าขนส่งต่อเที่ยว (ไป-กลับ)</p>
        </div>
        <button onClick={openStd}
          className="flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-bold"
          style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', color: '#374151' }}>
          <Settings size={14} /> ตั้งค่า STD
        </button>
      </div>

      {/* Form card */}
      <div className="rounded-3xl p-6 space-y-5 bg-white" style={{ border: '1.5px solid #f3f4f6', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        {/* Vehicle type */}
        <div>
          <label className={labelCls}>ประเภทรถ <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map(t => (
              <button key={t} onClick={() => { setVehType(t); setResult(null); }}
                className="px-4 h-9 rounded-xl text-sm font-bold transition-all"
                style={vehType === t
                  ? { background: '#dc2626', color: '#fff', boxShadow: '0 3px 10px rgba(220,38,38,0.3)' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs mt-1.5 text-gray-400">
            กม./ลิตร: <b className="text-gray-600">{std.vehicles[vehType].kmPerL}</b> &nbsp;|&nbsp;
            บรรทุก: <b className="text-gray-600">{std.vehicles[vehType].capacity.toLocaleString()} กก.</b>
          </p>
        </div>

        {/* Origin / Destination */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>เขต/จังหวัดต้นทาง</label>
            <input type="text" value={origin} onChange={e => setOrigin(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="คลังสินค้า (Depot)" />
          </div>
          <div>
            <label className={labelCls}>เขต/จังหวัดปลายทาง <span className="text-red-500">*</span></label>
            <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="กรุงเทพฯ, สมุทรสาคร" />
          </div>
        </div>

        {/* Numeric inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>ระยะทาง (กม.ทางเดียว)</label>
            <input type="number" min="0" value={distKm} onChange={e => { setDistKm(e.target.value); setResult(null); }}
              className={inputCls} style={inputStyle} placeholder="0" />
            {num(distKm) > 0 && (
              <p className="text-xs mt-1 text-gray-400">ไป-กลับ {(num(distKm) * 2).toLocaleString()} กม.</p>
            )}
          </div>
          <div>
            <label className={labelCls}>น้ำมัน (บ./ลิตร)</label>
            <input type="number" min="0" step="0.1" value={fuelPrice} onChange={e => { setFuelPrice(e.target.value); setResult(null); }}
              className={inputCls} style={inputStyle} placeholder={`${std.fuelPrice} (STD)`} />
          </div>
          <div>
            <label className={labelCls}>ค่าทางด่วน (บ.)</label>
            <input type="number" min="0" value={toll} onChange={e => { setToll(e.target.value); setResult(null); }}
              className={inputCls} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>อื่นๆ (บ.)</label>
            <input type="number" min="0" value={others} onChange={e => { setOthers(e.target.value); setResult(null); }}
              className={inputCls} style={inputStyle} placeholder="0" />
          </div>
        </div>

        {/* OT checkbox */}
        <label className="flex items-center gap-2.5 cursor-pointer w-fit">
          <input type="checkbox" checked={hasOT} onChange={e => { setHasOT(e.target.checked); setResult(null); }}
            className="w-4 h-4 rounded accent-red-600" />
          <span className="text-sm font-semibold text-gray-600">🌙 มี OT (นอกเวลา)</span>
          {hasOT && std.vehicles[vehType].laborOT === 0 && (
            <span className="text-xs text-amber-500 font-semibold">(ยังไม่ได้ตั้งค่า OT — ใช้ STD แทน)</span>
          )}
        </label>

        {/* Calculate button */}
        <button onClick={calculate}
          className="w-full h-14 rounded-2xl text-base font-black text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 6px 20px rgba(220,38,38,0.35)' }}>
          <Calculator size={20} /> คำนวณค่าขนส่ง
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-3xl overflow-hidden bg-white" style={{ border: '1.5px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          {/* Result header */}
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            <div>
              <p className="text-white/70 text-xs font-semibold">ค่าขนส่งรวม / เที่ยว (ไป-กลับ)</p>
              <p className="text-white text-3xl font-black">{fmt(result.total)} <span className="text-lg font-bold">บาท</span></p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">{result.vehType} {result.origin && result.destination ? `${result.origin} → ${result.destination}` : ''}</p>
              {result.distKm > 0 && <p className="text-white/80 text-xs">{result.distKm} กม. (ไป-กลับ {result.distKm * 2} กม.)</p>}
              <p className="text-white text-sm font-black mt-1">{fmt(result.perTon)} บ./ตัน</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="p-5 space-y-2">
            {[
              { icon: Fuel,        label: 'ค่าเชื้อเพลิง',             value: result.fuelCost,        note: result.distKm > 0 ? `${result.distKm * 2} กม. ÷ ${std.vehicles[result.vehType].kmPerL} กม./ล × ${fmt(result.fuelPrice)} บ.` : 'ไม่ระบุระยะทาง', skip: result.distKm === 0 },
              { icon: Wallet,      label: `ค่าแรง${result.isOT ? ' (OT)' : ' STD'}`, value: result.laborCost },
              { icon: ShieldCheck, label: 'ประกัน + ภาษี',             value: result.insuranceCost },
              { icon: Wrench,      label: 'ซ่อมบำรุง',                  value: result.maintenanceCost },
              { icon: Radio,       label: 'GPS',                        value: result.gpsCost },
              { icon: ChevronRight,label: 'ค่าทางด่วน',               value: result.tollCost,        skip: result.tollCost === 0 },
              { icon: ChevronRight,label: 'อื่นๆ',                     value: result.othersCost,      skip: result.othersCost === 0 },
              ...(result.extras || []).filter(e => e.name).map(e => ({
                icon: ChevronRight, label: e.name, value: num(e.amount), skip: num(e.amount) === 0,
              })),
            ].filter(r => !r.skip).map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <div className="flex items-center gap-2.5">
                  <row.icon size={14} className="text-gray-400 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-gray-700">{row.label}</span>
                    {row.note && <span className="text-xs text-gray-400 ml-2">{row.note}</span>}
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-800">{fmt(row.value)} บ.</span>
              </div>
            ))}

            {/* Total row */}
            <div className="flex items-center justify-between py-3 px-3 rounded-2xl mt-2"
              style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
              <span className="text-sm font-black text-red-700">รวมทั้งหมด</span>
              <span className="text-lg font-black text-red-600">{fmt(result.total)} บ.</span>
            </div>

            {/* Per unit */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-2xl text-center" style={{ background: '#eff6ff' }}>
                <p className="text-xs text-blue-400 font-semibold">ค่าขนส่ง / กก.</p>
                <p className="text-xl font-black text-blue-600">{fmt(result.perKg)}</p>
                <p className="text-xs text-blue-400">บาท/กก.</p>
              </div>
              <div className="p-3 rounded-2xl text-center" style={{ background: '#f0fdf4' }}>
                <p className="text-xs text-emerald-400 font-semibold">ค่าขนส่ง / ตัน</p>
                <p className="text-xl font-black text-emerald-600">{fmt(result.perTon)}</p>
                <p className="text-xs text-emerald-400">บาท/ตัน</p>
              </div>
            </div>
            <p className="text-xs text-center text-gray-400 pt-1">บรรทุก {result.capacity.toLocaleString()} กก. ({(result.capacity / 1000).toFixed(1)} ตัน) · รวมขาไปและขากลับ</p>
          </div>
        </div>
      )}

      {/* ── STD SETTINGS MODAL ── */}
      {showStd && stdDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowStd(false); }}>
          <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl bg-white max-h-[90vh] flex flex-col"
            onMouseDown={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-red-500" />
                <h3 className="text-lg font-black text-gray-900">ตั้งค่า STD ค่าขนส่ง</h3>
              </div>
              <button onClick={() => setShowStd(false)} className="p-1.5 rounded-xl text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Global fuel price */}
              <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #f9fafb' }}>
                <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
                  <Fuel size={18} className="text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="text-xs font-bold text-red-600">ราคาน้ำมัน (STD)</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" step="0.1" min="0"
                        value={stdDraft.fuelPrice}
                        onChange={e => setStdDraft(d => ({ ...d, fuelPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-32 h-9 px-3 rounded-xl text-sm font-black outline-none text-center"
                        style={{ border: '1.5px solid #fecaca', color: '#dc2626', background: '#fff' }} />
                      <span className="text-sm font-semibold text-red-400">บาท/ลิตร</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle type tabs */}
              <div className="px-6 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">ค่าใช้จ่ายตามประเภทรถ</label>
                <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
                  {VEHICLE_TYPES.map(t => (
                    <button key={t} onClick={() => setStdTab(t)}
                      className="px-3 h-8 rounded-xl text-xs font-bold transition-all"
                      style={stdTab === t
                        ? { background: '#dc2626', color: '#fff' }
                        : { background: '#f3f4f6', color: '#6b7280' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle fields */}
              <div className="px-6 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>กม./ลิตร</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="0.1"
                        value={stdDraft.vehicles[stdTab].kmPerL}
                        onChange={e => updateDraftVeh('kmPerL', parseFloat(e.target.value) || 0)}
                        className={inputCls} style={inputStyle} />
                      <span className="text-xs text-gray-400 flex-shrink-0">กม./ลิตร</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>น้ำหนักบรรทุก</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0"
                        value={stdDraft.vehicles[stdTab].capacity}
                        onChange={e => updateDraftVeh('capacity', parseFloat(e.target.value) || 0)}
                        className={inputCls} style={inputStyle} />
                      <span className="text-xs text-gray-400 flex-shrink-0">กก.</span>
                    </div>
                  </div>
                </div>

                {[
                  { field: 'labor',       label: 'ค่าแรง STD',    icon: Wallet },
                  { field: 'laborOT',     label: 'ค่าแรง OT',     icon: Wallet },
                  { field: 'insurance',   label: 'ประกัน+ภาษี',   icon: ShieldCheck },
                  { field: 'maintenance', label: 'ซ่อมบำรุง',      icon: Wrench },
                  { field: 'gps',         label: 'GPS',            icon: Radio },
                ].map(({ field, label, icon: Icon }) => (
                  <div key={field}>
                    <label className={labelCls}>
                      <Icon size={11} className="inline mr-1" />{label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="0.01"
                        value={stdDraft.vehicles[stdTab][field]}
                        onChange={e => updateDraftVeh(field, parseFloat(e.target.value) || 0)}
                        className={inputCls} style={inputStyle} />
                      <span className="text-xs text-gray-400 flex-shrink-0">บ./เที่ยว</span>
                    </div>
                  </div>
                ))}

                {/* Extra items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls + ' mb-0'}>รายการค่าใช้จ่ายเพิ่มเติม</label>
                    <button onClick={addExtra}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold text-white"
                      style={{ background: '#dc2626' }}>
                      <Plus size={11} /> เพิ่มรายการ
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(stdDraft.vehicles[stdTab].extras || []).map((ex, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={ex.name}
                          onChange={e => updateExtra(i, 'name', e.target.value)}
                          placeholder="ชื่อรายการ"
                          className="flex-1 h-9 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
                        <input type="number" min="0" step="0.01" value={ex.amount}
                          onChange={e => updateExtra(i, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-28 h-9 px-3 rounded-xl text-sm text-right outline-none" style={inputStyle} />
                        <span className="text-xs text-gray-400 flex-shrink-0">บ.</span>
                        <button onClick={() => removeExtra(i)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="text-blue-400">ℹ</span> ค่าใช้จ่ายต่อเที่ยว รวมทั้งขาไปและขากลับ
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setShowStd(false)}
                className="flex-1 h-11 rounded-2xl text-sm font-bold"
                style={{ background: '#f9fafb', color: '#6b7280', border: '1.5px solid #f3f4f6' }}>
                ยกเลิก
              </button>
              <button onClick={saveStd}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                ✓ บันทึก STD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
