import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trackingApi } from '../api';
import { Navigation, AlertTriangle } from 'lucide-react';

export default function ETA() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['gps-eta'],
    queryFn:  trackingApi.getGpsEta,
    refetchInterval: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: trackingApi.saveWhMap,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gps-eta'] }),
  });

  if (isLoading) return <p style={{ padding:24 }}>กำลังโหลด GPS...</p>;

  if (!data?.success) {
    return (
      <div style={{ padding:24 }}>
        <p style={{ color:'#dc2626', fontSize:14 }}>{data?.message || 'ดึงข้อมูลไม่ได้'}</p>
      </div>
    );
  }

  if (!data.hasDtc) {
    return (
      <div style={{ padding:24, fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>
        <h2 style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>ETA ติดตามรถ</h2>
        <div style={{ display:'flex', gap:10, background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:16, alignItems:'flex-start' }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#92400e' }}>ยังไม่ได้ตั้งค่า DTC_API_TOKEN</div>
            <div style={{ fontSize:12, color:'#78350f', marginTop:4 }}>กรุณาตั้งค่า environment variable <code>DTC_API_TOKEN</code> ใน Railway dashboard</div>
          </div>
        </div>
      </div>
    );
  }

  const vehicles   = data.vehicles   || [];
  const warehouses = data.warehouses || [];

  const upcoming = vehicles.filter(v => v.warehouseId && v.etaMinutes !== null && v.etaMinutes > 0  && v.etaMinutes <= 60);
  const arriving = vehicles.filter(v => v.warehouseId && v.etaMinutes !== null && v.etaMinutes <= 0 && v.etaMinutes > -30);
  const far      = vehicles.filter(v => v.warehouseId && v.etaMinutes !== null && v.etaMinutes > 60);

  function handleWhChange(plate, whId) {
    const newMap = {};
    vehicles.forEach(v => { if (v.warehouseId) newMap[v.licensePlate] = v.warehouseId; });
    if (whId) newMap[plate] = whId;
    else delete newMap[plate];
    saveMut.mutate(newMap);
  }

  return (
    <div style={{ fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f0d0d0' }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', display:'flex', alignItems:'center', gap:8 }}>
          <Navigation size={17} color="#CC0000"/> ETA ติดตามรถ (GPS Live)
        </h2>
        <span style={{ fontSize:11, color:'#16a34a' }}>● อัปเดตทุก 60 วินาที</span>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Warehouses */}
        {warehouses.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {warehouses.map(w => (
              <div key={w.WarehouseID} style={{ background:'#fafafa', border:'1px solid #f0d0d0', borderRadius:8, padding:'6px 12px', fontSize:12 }}>
                <div style={{ fontWeight:600, color:'#1a1a1a' }}>{w.Name}</div>
                {w.Address && <div style={{ color:'#888', fontSize:11 }}>{w.Address}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {(upcoming.length > 0 || arriving.length > 0) && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            <ETASection title="กำลังจะมาถึง (≤60 นาที)" color="#f39c12" items={upcoming}/>
            <ETASection title="ถึงแล้ว / ใกล้ถึง"      color="#27ae60" items={arriving}/>
            {far.length > 0 && <ETASection title="ระยะไกล (>60 นาที)" color="#888" items={far}/>}
          </div>
        )}

        {/* GPS Vehicle Table */}
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:10, color:'#374151' }}>
            รถทั้งหมดจาก DTC GPS ({vehicles.length} คัน)
          </h3>
          {vehicles.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#bbb', border:'1px dashed #f0d0d0', borderRadius:10 }}>
              <Navigation size={36} color="#e0c0c0" strokeWidth={1}/>
              <p style={{ marginTop:8, fontSize:13 }}>ไม่พบข้อมูลรถจาก DTC GPS</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto', border:'1px solid #f0d0d0', borderRadius:10 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:600 }}>
                <thead>
                  <tr style={{ background:'#fafafa', borderBottom:'1px solid #f0d0d0' }}>
                    {['ทะเบียน','สถานะ','ความเร็ว','ตำแหน่ง','ปลายทาง','ETA','อัปเดต'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => (
                    <tr key={v.vehicleId} style={{ borderBottom:'1px solid #f5f5f5' }}>
                      <td style={{ padding:'8px 10px', fontWeight:700, whiteSpace:'nowrap' }}>{v.licensePlate}</td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        <span style={{ color: v.status === 'Run' ? '#16a34a':'#888', fontWeight:600 }}>
                          {v.status === 'Run' ? '● วิ่ง':'■ จอด'}
                        </span>
                      </td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        {v.speed > 0 ? `${Math.round(v.speed)} km/h` : '-'}
                      </td>
                      <td style={{ padding:'8px 10px', color:'#555', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>
                        {v.currentZone || '-'}
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <select
                          value={v.warehouseId || ''}
                          onChange={e => handleWhChange(v.licensePlate, e.target.value || null)}
                          style={{ fontSize:11, padding:'3px 6px', borderRadius:6, border:'1px solid #f0d0d0', background:'#fff', color:'#374151', maxWidth:130 }}
                        >
                          <option value="">-- ไม่กำหนด --</option>
                          {warehouses.map(w => (
                            <option key={w.WarehouseID} value={w.WarehouseID}>{w.Name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        <EtaBadge eta={v.etaMinutes} dist={v.distanceKm} hasWh={!!v.warehouseId}/>
                      </td>
                      <td style={{ padding:'8px 10px', color:'#9ca3af', whiteSpace:'nowrap' }}>
                        {v.updatedAt ? String(v.updatedAt).slice(11,16) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EtaBadge({ eta, dist, hasWh }) {
  if (!hasWh) return <span style={{ color:'#bbb' }}>-</span>;
  if (eta === null) return <span style={{ color:'#bbb' }}>คำนวณไม่ได้</span>;
  const color = eta <= 0 ? '#16a34a' : eta <= 30 ? '#dc2626' : eta <= 60 ? '#d97706' : '#555';
  const text  = eta <= 0 ? 'ถึงแล้ว' : `${eta} นาที`;
  return (
    <span>
      <span style={{ color, fontWeight:700 }}>{text}</span>
      {dist !== null && <span style={{ color:'#9ca3af', fontSize:11, marginLeft:4 }}>({dist}km)</span>}
    </span>
  );
}

function ETASection({ title, color, items }) {
  return (
    <div style={{ background:'#fafafa', border:'1px solid #f0d0d0', borderRadius:10, padding:12 }}>
      <div style={{ fontSize:12, fontWeight:700, color, marginBottom:8 }}>{title} ({items.length})</div>
      {items.map(v => (
        <div key={v.vehicleId} style={{ padding:'6px 0', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
          <div style={{ fontWeight:700 }}>{v.licensePlate}
            <span style={{ color: v.status === 'Run' ? '#16a34a':'#888', fontSize:11, fontWeight:400, marginLeft:6 }}>
              {v.status === 'Run' ? '● วิ่ง':'■ จอด'}
            </span>
          </div>
          {v.warehouseName && <div style={{ color:'#888', fontSize:11 }}>→ {v.warehouseName}</div>}
          <div style={{ color, fontWeight:700 }}>
            {v.etaMinutes > 0 ? `ถึงใน ${v.etaMinutes} นาที` : 'ถึงแล้ว'}
            {v.distanceKm !== null && <span style={{ fontWeight:400, color:'#9ca3af', fontSize:11, marginLeft:4 }}>({v.distanceKm}km)</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
