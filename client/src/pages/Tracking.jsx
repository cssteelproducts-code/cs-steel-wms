import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '../api';

export default function Tracking() {
  const { data, isLoading } = useQuery({ queryKey: ['tracking'], queryFn: trackingApi.getVehicles, refetchInterval: 30_000 });
  if (isLoading) return <p style={{ padding: 24 }}>กำลังโหลด...</p>;
  const vehicles = data?.vehicles || [];

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>Vehicle ETA Tracking</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {vehicles.map(v => (
          <div key={v.ID} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <strong>{v.LicensePlate}</strong>
            <span style={{ marginLeft: 12, color: 'var(--muted)', fontSize: 12 }}>{v.UpdatedAt}</span>
            {v.Notes && <p style={{ fontSize: 13, marginTop: 4 }}>{v.Notes}</p>}
          </div>
        ))}
        {!vehicles.length && <p style={{ color: 'var(--muted)' }}>ยังไม่มีข้อมูล GPS</p>}
      </div>
    </div>
  );
}
