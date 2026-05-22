import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transportCostApi } from '../../api';

const VT = ['4 ล้อ','6 ล้อ','8 ล้อ','10 ล้อ','12 ล้อ','เทเลอร์','พ่วง'];

export default function Cost() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState('calc');
  const { data: settingsData } = useQuery({ queryKey: ['cost-settings'], queryFn: transportCostApi.getSettings });

  const [calcForm, setCalcForm] = useState({ zone:'', weightKg:'', vehicleType:'4 ล้อ', distKm:'', quantity:1 });
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState(null);

  const calc = useMutation({
    mutationFn: transportCostApi.calculate,
    onSuccess: (res) => { if (res.success) setResult(res.breakdown); },
  });

  const saveSettings = useMutation({
    mutationFn: transportCostApi.saveSettings,
    onSuccess: () => qc.invalidateQueries(['cost-settings']),
  });

  const displaySettings = settings || settingsData?.settings || { zones:[], fuelCostPerLiter:35, avgFuelEfficiencyKmL:5, vehicleSurcharge:{} };

  function handleCalc() {
    calc.mutate(calcForm);
  }

  function setZoneField(idx, field, value) {
    const zones = [...displaySettings.zones];
    zones[idx] = { ...zones[idx], [field]: parseFloat(value) || 0 };
    setSettings({ ...displaySettings, zones });
  }

  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {[['calc','คำนวณค่าขนส่ง'],['settings','ตั้งค่า']].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)}
            style={{ background:subTab===k?'var(--accent2)':'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px', fontSize:13, cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {subTab === 'calc' && (
        <div style={{ maxWidth:500 }}>
          <h4 style={{ marginBottom:12 }}>คำนวณค่าขนส่ง</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <select value={calcForm.zone} onChange={e => setCalcForm(f=>({...f,zone:e.target.value}))}>
              <option value="">เลือกโซน</option>
              {displaySettings.zones.map(z => <option key={z.name} value={z.name}>{z.name} (~{z.distKm} กม.)</option>)}
            </select>
            <input type="number" placeholder="ระยะทาง กม. (ถ้าไม่ใช่โซนมาตรฐาน)" value={calcForm.distKm} onChange={e=>setCalcForm(f=>({...f,distKm:e.target.value}))} />
            <input type="number" placeholder="น้ำหนักสินค้า (กก.)" value={calcForm.weightKg} onChange={e=>setCalcForm(f=>({...f,weightKg:e.target.value}))} />
            <select value={calcForm.vehicleType} onChange={e=>setCalcForm(f=>({...f,vehicleType:e.target.value}))}>
              {VT.map(v=><option key={v}>{v}</option>)}
            </select>
            <input type="number" placeholder="จำนวนหน่วย (เพื่อคำนวณต้นทุน/หน่วย)" value={calcForm.quantity} onChange={e=>setCalcForm(f=>({...f,quantity:e.target.value}))} />
            <button className="btn-primary" onClick={handleCalc} disabled={calc.isPending}>คำนวณ</button>
          </div>
          {result && (
            <div style={{ marginTop:16, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16 }}>
              <h4 style={{ marginBottom:10 }}>ผลการคำนวณ</h4>
              {[['ค่าพื้นฐาน', result.baseCost],['ค่าน้ำหนัก', result.weightCost],['ค่าเชื้อเพลิง', result.fuelCost],['ค่าเพิ่มเติมรถ', result.surcharge]].map(([l,v])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13, borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--muted)' }}>{l}</span>
                  <span>{v?.toLocaleString()} บ.</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontWeight:700, color:'var(--accent)' }}>
                <span>รวมทั้งหมด</span><span>{result.totalCost?.toLocaleString()} บ.</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13 }}>
                <span style={{ color:'var(--muted)' }}>ต้นทุน/หน่วย</span>
                <span>{result.perUnit?.toLocaleString()} บ.</span>
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>ระยะทาง: {result.distKm} กม.</div>
            </div>
          )}
        </div>
      )}

      {subTab === 'settings' && (
        <div>
          <h4 style={{ marginBottom:12 }}>ตั้งค่าค่าขนส่ง</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, maxWidth:400, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, color:'var(--muted)' }}>ราคาน้ำมัน (บ./ล.)</label>
              <input type="number" value={displaySettings.fuelCostPerLiter}
                onChange={e => setSettings(s => ({ ...(s||displaySettings), fuelCostPerLiter: parseFloat(e.target.value)||35 }))} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'var(--muted)' }}>ประหยัดน้ำมัน (กม./ล.)</label>
              <input type="number" value={displaySettings.avgFuelEfficiencyKmL}
                onChange={e => setSettings(s => ({ ...(s||displaySettings), avgFuelEfficiencyKmL: parseFloat(e.target.value)||5 }))} />
            </div>
          </div>
          <h5 style={{ marginBottom:8, fontSize:13 }}>โซนราคา</h5>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16, maxWidth:600 }}>
            {displaySettings.zones.map((z,i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'150px 80px 90px 90px', gap:8, alignItems:'center' }}>
                <input placeholder="ชื่อโซน" value={z.name} onChange={e => {
                  const zones=[...displaySettings.zones]; zones[i]={...zones[i],name:e.target.value};
                  setSettings(s=>({...(s||displaySettings),zones}));
                }} />
                <input type="number" placeholder="กม." value={z.distKm} onChange={e=>setZoneField(i,'distKm',e.target.value)} />
                <input type="number" placeholder="ราคาพื้นฐาน" value={z.baseCost} onChange={e=>setZoneField(i,'baseCost',e.target.value)} />
                <input type="number" placeholder="บ./กก." value={z.perKgRate} onChange={e=>setZoneField(i,'perKgRate',e.target.value)} />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => saveSettings.mutate(displaySettings)} disabled={saveSettings.isPending}>บันทึกการตั้งค่า</button>
        </div>
      )}
    </div>
  );
}
