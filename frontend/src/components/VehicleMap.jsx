import { useEffect, useRef } from 'react';

export default function VehicleMap({ vehicles = [], warehouses = [], selectedId, onSelect, height = 420 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const warehouseLayersRef = useRef([]);
  const leafletRef = useRef(null);

  // Init map once
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!document.querySelector('#leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        await new Promise(r => { link.onload = r; setTimeout(r, 3000); });
      }
      if (cancelled || !containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, { zoomControl: true }).setView([13.0, 101.5], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      mapRef.current = map;
    };

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        warehouseLayersRef.current = [];
      }
    };
  }, []);

  // Draw warehouse radius circles
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    warehouseLayersRef.current.forEach(layer => layer.remove());
    warehouseLayersRef.current = [];

    warehouses.forEach(w => {
      if (!w.GpsLat || !w.GpsLng) return;
      const radiusM = (w.RadiusKm || 5) * 1000;
      const circle = L.circle([w.GpsLat, w.GpsLng], {
        radius: radiusM,
        color: '#dc2626',
        fillColor: '#fca5a5',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '6 4'
      }).addTo(map);
      const pin = L.marker([w.GpsLat, w.GpsLng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        })
      }).bindTooltip(`<b>${w.WarehouseName}</b><br>รัศมี ${w.RadiusKm || 5} กม.`, { permanent: false }).addTo(map);
      warehouseLayersRef.current.push(circle, pin);
    });
  }, [warehouses]);

  // Update markers when vehicles change
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const currentIds = new Set(vehicles.map(v => v.vehicleId));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add / update markers
    vehicles.forEach(v => {
      if (!v.lat || !v.lng) return;
      const isMoving = v.status === 'Moving';
      const isSelected = v.vehicleId === selectedId;
      const color = isMoving ? '#22c55e' : '#ef4444';
      const shadow = isSelected ? '0 0 0 4px rgba(220,38,38,0.35)' : '0 2px 8px rgba(0,0,0,0.35)';

      const html = `
        <div style="
          width:${isSelected ? 44 : 36}px;height:${isSelected ? 44 : 36}px;
          border-radius:50%;background:${color};
          border:3px solid #fff;box-shadow:${shadow};
          display:flex;align-items:center;justify-content:center;
          transition:all 0.2s;cursor:pointer;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v7a2 2 0 01-2 2h-2M9 17a2 2 0 104 0 2 2 0 00-4 0"/>
          </svg>
        </div>`;

      const icon = L.divIcon({ className: '', html, iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36], iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18] });

      const popup = L.popup({ offset: [0, -18], className: '' }).setContent(`
        <div style="font-family:Sarabun,sans-serif;min-width:180px;padding:2px">
          <div style="font-weight:800;font-size:15px;color:#111827;margin-bottom:4px">${v.licensePlate}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px">คนขับ: ${v.driverName || '-'}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px">ความเร็ว: ${v.speed || 0} กม./ชม.</div>
          ${v.distanceKm ? `<div style="font-size:12px;color:#6b7280;margin-bottom:2px">ระยะห่างคลัง: ${v.distanceKm} กม.</div>` : ''}
          ${v.address ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">${v.address}</div>` : ''}
          <div style="margin-top:6px;display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;
            background:${isMoving ? '#dcfce7' : '#fee2e2'};color:${isMoving ? '#16a34a' : '#dc2626'}">
            ${isMoving ? '● เคลื่อนที่' : '■ จอด'}
          </div>
        </div>`);

      if (markersRef.current[v.vehicleId]) {
        markersRef.current[v.vehicleId].setLatLng([v.lat, v.lng]).setIcon(icon);
      } else {
        const marker = L.marker([v.lat, v.lng], { icon })
          .bindPopup(popup)
          .addTo(map);
        marker.on('click', () => onSelect?.(v.vehicleId));
        markersRef.current[v.vehicleId] = marker;
      }
    });

    // Fit bounds to all vehicles
    if (vehicles.filter(v => v.lat && v.lng).length > 0) {
      const bounds = L.latLngBounds(
        vehicles.filter(v => v.lat && v.lng).map(v => [v.lat, v.lng])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
    }
  }, [vehicles, selectedId]);

  // Pan to selected
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const v = vehicles.find(x => x.vehicleId === selectedId);
    if (v?.lat && v?.lng) {
      mapRef.current.setView([v.lat, v.lng], 13, { animate: true });
      markersRef.current[selectedId]?.openPopup();
    }
  }, [selectedId]);

  return (
    <div ref={containerRef}
      style={{ height, width: '100%', borderRadius: '0 0 24px 24px', overflow: 'hidden' }} />
  );
}
