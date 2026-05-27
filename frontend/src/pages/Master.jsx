import { useState, useEffect, useRef, useCallback, Component } from 'react';
import { Settings, Plus, Edit, Trash2, Upload, Download, Warehouse, Users, Truck, Package, Save, X, Search, MapPin, Navigation } from 'lucide-react';

class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return (
      <div className="flex items-center justify-center h-full bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-sm">
        ไม่สามารถโหลดแผนที่ได้ — กรอก GPS ด้วยตนเอง
      </div>
    );
    return this.props.children;
  }
}
import api from '../services/api';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';

// Fix Leaflet default marker icons for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// Custom red pin icon
const redPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 42" width="28" height="42">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter>
    <path filter="url(#s)" d="M14 1C7.37 1 2 6.37 2 13c0 10.5 12 28 12 28s12-17.5 12-28C26 6.37 20.63 1 14 1z" fill="#dc2626" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="5" fill="white"/>
  </svg>`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

function RecenterMap({ lat, lng, trigger }) {
  const map = useMap();
  useEffect(() => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (la && ln) map.setView([la, ln], Math.max(map.getZoom(), 15), { animate: true });
  }, [trigger]);
  return null;
}

function DraggableMarker({ lat, lng, onMove }) {
  const markerRef = useRef(null);
  const la = parseFloat(lat) || 13.7563;
  const ln = parseFloat(lng) || 100.5018;
  return (
    <Marker
      position={[la, ln]}
      icon={redPinIcon}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const m = markerRef.current;
          if (m) {
            const p = m.getLatLng();
            onMove(p.lat.toFixed(6), p.lng.toFixed(6));
          }
        }
      }}
    />
  );
}

function MapClickHandler({ onClick }) {
  useMapEvents({ click: e => onClick(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)) });
  return null;
}

const tabs = [
  { key: 'warehouses', label: 'คลังสินค้า', icon: Warehouse },
  { key: 'customers', label: 'ลูกค้า', icon: Users },
  { key: 'vehicleTypes', label: 'ประเภทรถ', icon: Truck },
  { key: 'loadingStations', label: 'สถานีขึ้นสินค้า', icon: Package }
];

export default function Master() {
  const [tab, setTab] = useState('warehouses');
  const [data, setData] = useState({});
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  // Location search state
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locSearching, setLocSearching] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const locTimer = useRef(null);
  const importRef = useRef(null);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    try {
      const res = await api.post('/master/customers/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.success) { toast.success(res.data.message); fetchData('customers'); }
    } catch (err) { toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ'); }
  };

  const searchLocation = async (q) => {
    if (!q.trim()) { setLocResults([]); return; }
    setLocSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'th,en' } }
      );
      const data = await res.json();
      setLocResults(data);
    } catch { setLocResults([]); }
    finally { setLocSearching(false); }
  };

  const handleLocInput = (v) => {
    setLocQuery(v);
    clearTimeout(locTimer.current);
    locTimer.current = setTimeout(() => searchLocation(v), 600);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th,en`,
        { headers: { 'Accept-Language': 'th,en' } }
      );
      const data = await res.json();
      if (data?.display_name) {
        setForm(p => ({ ...p, Location: data.display_name }));
        setLocQuery(data.display_name);
      }
    } catch {}
  };

  const handleMapMove = useCallback((lat, lng) => {
    setForm(p => ({ ...p, GpsLat: lat, GpsLng: lng }));
    reverseGeocode(lat, lng);
  }, []);

  const pickLocation = (item) => {
    setForm(p => ({
      ...p,
      GpsLat: parseFloat(item.lat).toFixed(6),
      GpsLng: parseFloat(item.lon).toFixed(6),
      Location: item.display_name,
    }));
    setLocQuery(item.display_name);
    setLocResults([]);
    setRecenterTrigger(t => t + 1);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Browser ไม่รองรับ Geolocation'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm(p => ({ ...p, GpsLat: lat, GpsLng: lng }));
        setRecenterTrigger(t => t + 1);
        reverseGeocode(lat, lng);
        toast.success('ดึงตำแหน่งปัจจุบันสำเร็จ');
      },
      () => toast.error('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาต Location')
    );
  };

  useEffect(() => { fetchData(tab); }, [tab]);
  useEffect(() => { fetchWarehouses(); }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/master/warehouses');
      setWarehouses(res.data.data || []);
    } catch {}
  };

  const fetchData = async (type) => {
    try {
      const endpoints = {
        warehouses: '/master/warehouses',
        customers: '/master/customers',
        vehicleTypes: '/master/vehicle-types',
        loadingStations: '/master/loading-stations'
      };
      const res = await api.get(endpoints[type]);
      setData(p => ({ ...p, [type]: res.data.data || [] }));
    } catch {}
  };

  const openCreate = () => {
    setForm({});
    setEditing(null);
    setLocQuery('');
    setLocResults([]);
    setRecenterTrigger(0);
    setModal(tab);
  };

  const openEdit = (item) => {
    setForm(item);
    setEditing(item);
    setLocQuery(item.Location || item.location || '');
    setLocResults([]);
    setRecenterTrigger(t => t + 1);
    setModal(tab);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res;
      const endpoints = {
        warehouses: '/master/warehouses',
        customers: '/master/customers',
        vehicleTypes: '/master/vehicle-types',
        loadingStations: '/master/loading-stations'
      };
      const idFields = {
        warehouses: 'WarehouseID',
        customers: 'CustomerID',
        vehicleTypes: 'TypeID',
        loadingStations: 'StationID'
      };
      const endpoint = endpoints[tab];
      const payload = getFormPayload();

      if (editing) {
        res = await api.put(`${endpoint}/${editing[idFields[tab]]}`, payload);
      } else {
        res = await api.post(endpoint, payload);
      }

      if (res.data.success) {
        toast.success(res.data.message);
        setModal(null);
        fetchData(tab);
        if (tab === 'warehouses') fetchWarehouses();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const labels = { warehouses: 'คลังสินค้า', customers: 'ลูกค้า', vehicleTypes: 'ประเภทรถ', loadingStations: 'สถานีขึ้นสินค้า' };
    const idFields = { warehouses: 'WarehouseID', customers: 'CustomerID', vehicleTypes: 'TypeID', loadingStations: 'StationID' };
    const endpoints = { warehouses: '/master/warehouses', customers: '/master/customers', vehicleTypes: '/master/vehicle-types', loadingStations: '/master/loading-stations' };
    const name = item.TypeName || item.WarehouseName || item.CustomerName || item.StationName || '';
    if (!window.confirm(`ยืนยันลบ${labels[tab]} "${name}" ?`)) return;
    try {
      const res = await api.delete(`${endpoints[tab]}/${item[idFields[tab]]}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchData(tab);
        if (tab === 'warehouses') fetchWarehouses();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const getFormPayload = () => {
    switch (tab) {
      case 'warehouses': return { warehouseCode: form.WarehouseCode || form.warehouseCode, warehouseName: form.WarehouseName || form.warehouseName, location: form.Location || form.location, gpsLat: form.GpsLat || form.gpsLat, gpsLng: form.GpsLng || form.gpsLng, isActive: form.IsActive ?? 1 };
      case 'customers': return { customerCode: form.CustomerCode || form.customerCode, customerName: form.CustomerName || form.customerName, phone: form.Phone || form.phone, address: form.Address || form.address, isActive: form.IsActive ?? 1 };
      case 'vehicleTypes': return { typeName: form.TypeName || form.typeName, description: form.Description || form.description };
      case 'loadingStations': return { stationCode: form.StationCode || form.stationCode, stationName: form.StationName || form.stationName, warehouseId: form.WarehouseID || form.warehouseId, sortOrder: form.SortOrder || form.sortOrder || 0, isActive: form.IsActive ?? 1 };
      default: return form;
    }
  };

  const renderTable = () => {
    const items = data[tab] || [];
    if (!items.length) return <p className="text-center text-slate-400 py-8">ยังไม่มีข้อมูล</p>;

    switch (tab) {
      case 'warehouses': return (
        <table className="w-full"><thead><tr className="border-b border-slate-200">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อคลัง</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">ที่ตั้ง</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">GPS</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.WarehouseID} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="table-cell font-mono text-blue-600">{i.WarehouseCode}</td>
            <td className="table-cell text-slate-900 font-medium">{i.WarehouseName}</td>
            <td className="table-cell hide-mobile text-slate-600">{i.Location || '-'}</td>
            <td className="table-cell hide-mobile text-xs text-slate-400">{i.GpsLat && i.GpsLng ? `${i.GpsLat}, ${i.GpsLng}` : '-'}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3 flex gap-1"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit size={14} /></button><button onClick={() => handleDelete(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'customers': return (
        <table className="w-full"><thead><tr className="border-b border-slate-200">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อลูกค้า</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">โทรศัพท์</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.CustomerID} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="table-cell font-mono text-blue-600">{i.CustomerCode}</td>
            <td className="table-cell text-slate-900">{i.CustomerName}</td>
            <td className="table-cell hide-mobile text-slate-600">{i.Phone || '-'}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3 flex gap-1"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit size={14} /></button><button onClick={() => handleDelete(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'vehicleTypes': return (
        <table className="w-full"><thead><tr className="border-b border-slate-200">
          <th className="table-header text-left px-4 py-2">ประเภทรถ</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">รายละเอียด</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.TypeID} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="table-cell text-slate-900 font-medium">{i.TypeName}</td>
            <td className="table-cell hide-mobile text-slate-500">{i.Description || '-'}</td>
            <td className="px-4 py-3 flex gap-1"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit size={14} /></button><button onClick={() => handleDelete(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'loadingStations': return (
        <table className="w-full"><thead><tr className="border-b border-slate-200">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อสถานี</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
          <th className="table-header text-center px-4 py-2">ลำดับ</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.StationID} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="table-cell font-mono text-blue-600">{i.StationCode}</td>
            <td className="table-cell text-slate-900 font-medium">{i.StationName}</td>
            <td className="table-cell hide-mobile text-slate-600">{i.WarehouseName || '-'}</td>
            <td className="table-cell text-center text-slate-600">{i.SortOrder}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3 flex gap-1"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit size={14} /></button><button onClick={() => handleDelete(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
    }
  };

  const renderForm = () => {
    switch (tab) {
      case 'warehouses': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสคลัง *</label><input value={form.WarehouseCode || form.warehouseCode || ''} onChange={e => setForm(p => ({ ...p, WarehouseCode: e.target.value }))} className="input-field" placeholder="W001" /></div>
          <div><label className="label">ชื่อคลัง *</label><input value={form.WarehouseName || form.warehouseName || ''} onChange={e => setForm(p => ({ ...p, WarehouseName: e.target.value }))} className="input-field" placeholder="คลังสินค้า 1" /></div>

          {/* Location search */}
          <div className="col-span-2">
            <label className="label">ค้นหาสถานที่</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={locQuery} onChange={e => handleLocInput(e.target.value)}
                className="input-field pl-9 pr-10" placeholder="พิมพ์ชื่อสถานที่ เช่น นิคมอุตสาหกรรมบางปู..." />
              {locSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />}
            </div>
            {locResults.length > 0 && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-xl max-h-40 overflow-y-auto z-[9999] relative bg-white border border-slate-200">
                {locResults.map((item, i) => (
                  <button key={i} type="button" onClick={() => pickLocation(item)}
                    className="w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors hover:bg-slate-50 border-b border-slate-100 last:border-0 text-slate-700">
                    <MapPin size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{item.display_name}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={useCurrentLocation}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors">
              <Navigation size={12} />ใช้ตำแหน่งปัจจุบัน (GPS)
            </button>
          </div>

          {/* Interactive Draggable Map */}
          <div className="col-span-2">
            <label className="label flex items-center gap-1.5">
              <MapPin size={13} className="text-red-500" />
              แผนที่ — ลากหมุดแดงหรือคลิกบนแผนที่เพื่อตั้งตำแหน่ง
            </label>
            <MapErrorBoundary>
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 240 }}>
              <MapContainer
                center={[parseFloat(form.GpsLat || form.gpsLat) || 13.5792, parseFloat(form.GpsLng || form.gpsLng) || 100.3534]}
                zoom={parseFloat(form.GpsLat || form.gpsLat) ? 15 : 11}
                style={{ height: '240px', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                <RecenterMap lat={form.GpsLat || form.gpsLat} lng={form.GpsLng || form.gpsLng} trigger={recenterTrigger} />
                <DraggableMarker
                  lat={form.GpsLat || form.gpsLat || 13.5792}
                  lng={form.GpsLng || form.gpsLng || 100.3534}
                  onMove={handleMapMove}
                />
                <MapClickHandler onClick={handleMapMove} />
              </MapContainer>
            </div>
            </MapErrorBoundary>
            <p className="text-[11px] mt-1 text-slate-400">
              ลากหมุดสีแดง หรือคลิกบนแผนที่ เพื่อเลือกตำแหน่ง · ที่อยู่จะดึงอัตโนมัติ
            </p>
          </div>

          <div className="col-span-2">
            <label className="label">ที่ตั้ง / ที่อยู่</label>
            <input value={form.Location || form.location || ''} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} className="input-field" placeholder="จะกรอกอัตโนมัติเมื่อย้ายหมุด" />
          </div>

          <div>
            <label className="label">GPS Latitude</label>
            <input type="number" step="0.000001" value={form.GpsLat || form.gpsLat || ''} onChange={e => { setForm(p => ({ ...p, GpsLat: e.target.value })); setRecenterTrigger(t => t + 1); }} className="input-field" placeholder="13.579319" />
          </div>
          <div>
            <label className="label">GPS Longitude</label>
            <input type="number" step="0.000001" value={form.GpsLng || form.gpsLng || ''} onChange={e => { setForm(p => ({ ...p, GpsLng: e.target.value })); setRecenterTrigger(t => t + 1); }} className="input-field" placeholder="100.353664" />
          </div>

          {(form.GpsLat || form.gpsLat) && (form.GpsLng || form.gpsLng) && (
            <div className="col-span-2">
              <a href={`https://www.google.com/maps?q=${form.GpsLat || form.gpsLat},${form.GpsLng || form.gpsLng}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 transition-colors">
                <MapPin size={12} />ดูตำแหน่งบน Google Maps
              </a>
            </div>
          )}
        </div>
      </>);
      case 'customers': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสลูกค้า *</label><input value={form.CustomerCode || form.customerCode || ''} onChange={e => setForm(p => ({ ...p, CustomerCode: e.target.value }))} className="input-field" placeholder="C001" /></div>
          <div><label className="label">ชื่อลูกค้า *</label><input value={form.CustomerName || form.customerName || ''} onChange={e => setForm(p => ({ ...p, CustomerName: e.target.value }))} className="input-field" placeholder="ชื่อบริษัท" /></div>
          <div><label className="label">โทรศัพท์</label><input value={form.Phone || form.phone || ''} onChange={e => setForm(p => ({ ...p, Phone: e.target.value }))} className="input-field" placeholder="02-xxx-xxxx" /></div>
          <div className="col-span-2"><label className="label">ที่อยู่</label><textarea value={form.Address || form.address || ''} onChange={e => setForm(p => ({ ...p, Address: e.target.value }))} className="input-field resize-none" rows={2} /></div>
        </div>
      </>);
      case 'vehicleTypes': return (<>
        <div><label className="label">ชื่อประเภทรถ *</label><input value={form.TypeName || form.typeName || ''} onChange={e => setForm(p => ({ ...p, TypeName: e.target.value }))} className="input-field" placeholder="รถ 10 ล้อ" /></div>
        <div className="mt-3"><label className="label">รายละเอียด</label><input value={form.Description || form.description || ''} onChange={e => setForm(p => ({ ...p, Description: e.target.value }))} className="input-field" /></div>
      </>);
      case 'loadingStations': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสสถานี *</label><input value={form.StationCode || form.stationCode || ''} onChange={e => setForm(p => ({ ...p, StationCode: e.target.value }))} className="input-field" placeholder="ST001" /></div>
          <div><label className="label">ชื่อสถานี *</label><input value={form.StationName || form.stationName || ''} onChange={e => setForm(p => ({ ...p, StationName: e.target.value }))} className="input-field" placeholder="สถานีที่ 1" /></div>
          <div><label className="label">คลังสินค้า</label><select value={form.WarehouseID || form.warehouseId || ''} onChange={e => setForm(p => ({ ...p, WarehouseID: e.target.value }))} className="input-field"><option value="">-- ทุกคลัง --</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}</select></div>
          <div><label className="label">ลำดับการแสดง</label><input type="number" value={form.SortOrder || form.sortOrder || 0} onChange={e => setForm(p => ({ ...p, SortOrder: e.target.value }))} className="input-field" /></div>
        </div>
      </>);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${tab === t.key ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">{tabs.find(t => t.key === tab)?.label}</h3>
          <div className="flex items-center gap-2">
            {tab === 'customers' && (<>
              <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <button onClick={() => importRef.current?.click()} className="btn-secondary text-sm"><Upload size={14} />Import Excel</button>
              <a href="/api/master/customers/template" download className="btn-secondary text-sm flex items-center gap-1.5"><Download size={14} />Template</a>
            </>)}
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} />เพิ่ม
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className={`rounded-2xl w-full p-6 bg-white border border-slate-200 shadow-xl ${modal === 'warehouses' ? 'max-w-xl' : 'max-w-md'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? 'แก้ไข' : 'เพิ่ม'} {tabs.find(t => t.key === tab)?.label}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
            </div>
            {renderForm()}
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} />บันทึก</>}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-6">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
