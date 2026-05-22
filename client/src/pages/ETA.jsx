import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '../api';

export default function ETA() {
  const { data: vehData, isLoading } = useQuery({ queryKey: ['tracking-vehicles'], queryFn: trackingApi.getVehicles, refetchInterval: 60_000 });
  const { data: whData } = useQuery({ queryKey: ['warehouses'], queryFn: trackingApi.getWarehouses });

  if (isLoading) return <p>กำลังโหลด...</p>;

  const vehicles = vehData?.vehicles || [];
  const warehouses = whData?.warehouses || [];

  const upcoming  = vehicles.filter(v => v.etaMinutes > 0 && v.etaMinutes <= 60);
  const arriving  = vehicles.filter(v => v.etaMinutes <= 0 && v.etaMinutes > -30);
  const departed  = vehicles.filter(v => v.etaMinutes <= -30);

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>พยากรณ์ ETA</h2>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16 }}>อัปเดตทุก 60 วินาที</p>

      {warehouses.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {warehouses.map(w => (
            <div key={w.warehouseId} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', fontSize:13 }}>
              <div style={{ fontWeight:600 }}>{w.name}</div>
              <div style={{ color:'var(--muted)', fontSize:12 }}>{w.address}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
        <ETASection title="กำลังจะมาถึง (≤60 นาที)" color="#f39c12" items={upcoming} />
        <ETASection title="ถึงแล้ว / กำลังออก" color="#27ae60" items={arriving} />
        <ETASection title="ออกไปแล้ว (>30 นาที)" color="#7f8c8d" items={departed} />
      </div>

      {vehicles.length === 0 && (
        <div style={{ marginTop:24, textAlign:'center', color:'var(--muted)' }}>
          <p>ไม่มีข้อมูลยานพาหนะ</p>
          <p style={{ fontSize:13 }}>อัปเดต ETA จากหน้า Tracking</p>
        </div>
      )}

      <div style={{ marginTop:24 }}>
        <h3 style={{ marginBottom:12 }}>ยานพาหนะทั้งหมด ({vehicles.length})</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'var(--surface)' }}>
              {['ทะเบียน','ประเภท','โซน','ETA (นาที)','สถานะ','อัปเดต'].map(h=>(
                <th key={h} style={{ padding:'7px 10px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.vehicleId} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px', fontWeight:600 }}>{v.licensePlate}</td>
                  <td style={{ padding:'7px 10px' }}>{v.vehicleType}</td>
                  <td style={{ padding:'7px 10px' }}>{v.currentZone}</td>
                  <td style={{ padding:'7px 10px' }}>
                    <span style={{ color: v.etaMinutes<=0?'#27ae60': v.etaMinutes<=30?'#e74c3c': v.etaMinutes<=60?'#f39c12':'var(--text)', fontWeight:600 }}>
                      {v.etaMinutes > 0 ? `${v.etaMinutes} นาที` : v.etaMinutes === 0 ? 'ถึงแล้ว' : `ออกไปแล้ว ${Math.abs(v.etaMinutes)} นาที`}
                    </span>
                  </td>
                  <td style={{ padding:'7px 10px' }}>{v.status}</td>
                  <td style={{ padding:'7px 10px', color:'var(--muted)', fontSize:12 }}>{v.updatedAt?.slice(11,16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ETASection({ title, color, items }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
      <h4 style={{ color, marginBottom:10, fontSize:14 }}>{title} ({items.length})</h4>
      {items.length === 0 && <p style={{ color:'var(--muted)', fontSize:13 }}>ไม่มีข้อมูล</p>}
      {items.map(v => (
        <div key={v.vehicleId} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
          <div style={{ fontWeight:600 }}>{v.licensePlate} <span style={{ color:'var(--muted)', fontWeight:400 }}>({v.vehicleType})</span></div>
          <div style={{ color:'var(--muted)', fontSize:12 }}>{v.currentZone} | {v.remark}</div>
          <div style={{ color, fontWeight:600, fontSize:13 }}>
            {v.etaMinutes > 0 ? `ถึงใน ${v.etaMinutes} นาที` : `ออกไปแล้ว ${Math.abs(v.etaMinutes)} นาที`}
          </div>
        </div>
      ))}
    </div>
  );
}
