import { useEffect, useRef } from 'react';

export default function DraggableMap({ lat, lng, onMove, height = 300 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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

      const initLat = parseFloat(lat) || 13.5792;
      const initLng = parseFloat(lng) || 100.3534;

      const map = L.map(containerRef.current).setView([initLat, initLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 42" width="28" height="42">
          <filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
          <path filter="url(#ds)" d="M14 1C7.37 1 2 6.37 2 13c0 10.5 12 28 12 28s12-17.5 12-28C26 6.37 20.63 1 14 1z" fill="#dc2626" stroke="white" stroke-width="1.5"/>
          <circle cx="14" cy="13" r="5" fill="white"/>
        </svg>`,
        iconSize: [28, 42],
        iconAnchor: [14, 42],
      });

      const marker = L.marker([initLat, initLng], { icon, draggable: true }).addTo(map);

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onMove?.(p.lat.toFixed(6), p.lng.toFixed(6));
      });

      map.on('click', e => {
        marker.setLatLng(e.latlng);
        onMove?.(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
      });

      mapRef.current = map;
      markerRef.current = marker;
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!markerRef.current || !lat || !lng) return;
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln)) return;
    markerRef.current.setLatLng([la, ln]);
    mapRef.current?.setView([la, ln], 15, { animate: true });
  }, [lat, lng]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
