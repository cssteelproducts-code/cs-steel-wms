import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Plus, Edit, Trash2, Upload, Download, Warehouse, Users, Truck, Package, Save, X, Search, MapPin, Navigation, ShoppingBag, Grid3X3, LayoutGrid, Car, AlertTriangle, Wrench, CheckCircle2, Calendar, Printer } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import DraggableMap from '../components/DraggableMap';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const SKU_TYPES = ['ขายดี','ขายน้อยขายต่อเนื่อง','ขายน้อยขายไม่ต่อเนื่อง','สต็อค','NewItem','สินค้าโป๊ว','ไม่ควบคุมสต็อค','เหล็กอื่น (เกรด B)','เหล็กเกรด C','อื่นๆ'];

const tabs = [
  { key: 'warehouses',        label: 'คลังสินค้า',        icon: Warehouse   },
  { key: 'customers',         label: 'ลูกค้า',             icon: Users       },
  { key: 'vehicleTypes',      label: 'ประเภทรถ',           icon: Truck       },
  { key: 'internalVehicles',  label: 'รถขนส่งภายใน',      icon: Car         },
  { key: 'loadingStations',   label: 'สถานีขึ้นสินค้า',   icon: Package     },
  { key: 'products',          label: 'สินค้า',             icon: ShoppingBag },
  { key: 'locationTypes',     label: 'ประเภท Location',    icon: Grid3X3     },
  { key: 'locations',         label: 'Location',           icon: LayoutGrid  },
];

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
};

const ExpiryBadge = ({ date, label }) => {
  const days = daysUntil(date);
  if (days === null || days > 90) return null;
  let cls, icon, txt;
  if (days < 0)        { cls = 'bg-gray-200 text-gray-500';                 txt = `${label} หมด`; }
  else if (days === 0) { cls = 'bg-red-600 text-white ring-1 ring-red-400'; txt = `${label} วันนี้!`; }
  else if (days <= 30) { cls = 'bg-red-500 text-white';                     txt = `${label} ${days} วัน`; }
  else if (days <= 60) { cls = 'bg-orange-500 text-white';                  txt = `${label} ${days} วัน`; }
  else                 { cls = 'bg-amber-400 text-white';                    txt = `${label} ${days} วัน`; }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold whitespace-nowrap ${cls}`}>{txt}</span>;
};

const VehicleStatusBadge = ({ status }) => {
  if (status === 'รอซ่อม') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700"><Wrench size={13}/>รอซ่อม</span>
  );
  if (status === 'อุบัติเหตุ') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700"><AlertTriangle size={13}/>อุบัติเหตุ</span>
  );
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 size={13}/>พร้อมใช้</span>;
};

export default function Master() {
  const [tab, setTab] = useState('warehouses');
  const [data, setData] = useState({});
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSKUFilter, setProductSKUFilter] = useState('');
  const productImportRef = useRef(null);
  const locationsImportRef = useRef(null);
  const internalVehiclesImportRef = useRef(null);
  const [locationTypes, setLocationTypes] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [printLocation, setPrintLocation] = useState(null);
  const printLabelRef = useRef(null);
  // Location search state
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locSearching, setLocSearching] = useState(false);
  const locTimer = useRef(null);
  const importRef = useRef(null);

  const handlePrintLabel = useReactToPrint({
    content: () => printLabelRef.current,
    pageStyle: `
      @page { size: 8cm 6cm; margin: 0.3cm; }
      @media print { body { margin: 0; font-family: sans-serif; } }
    `,
  });

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    setImporting(true);
    try {
      const res = await api.post('/master/customers/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      if (res.data.success) { toast.success(res.data.message); fetchData('customers'); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/master/customers/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customer_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('ดาวน์โหลด template ไม่สำเร็จ'); }
  };

  const searchLocation = async (q) => {
    if (!q.trim()) { setLocResults([]); return; }
    setLocSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1&countrycodes=th&accept-language=th,en`,
        { headers: { 'Accept-Language': 'th,en', 'User-Agent': 'CS.Smart WMS/1.0' } }
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

  const pickLocation = (item) => {
    setForm(p => ({
      ...p,
      GpsLat: parseFloat(item.lat).toFixed(6),
      GpsLng: parseFloat(item.lon).toFixed(6),
      Location: item.display_name,
    }));
    setLocQuery(item.display_name);
    setLocResults([]);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Browser ไม่รองรับ Geolocation'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm(p => ({ ...p, GpsLat: lat, GpsLng: lng }));
        toast.success('ดึงตำแหน่งปัจจุบันสำเร็จ');
      },
      () => toast.error('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาต Location')
    );
  };

  useEffect(() => {
    fetchData(tab);
    setSelected(new Set());
    if (tab === 'locations') api.get('/master/location-types').then(r => setLocationTypes(r.data.data || [])).catch(() => {});
  }, [tab]);
  useEffect(() => {
    fetchWarehouses();
    ['warehouses', 'customers', 'vehicleTypes', 'internalVehicles', 'loadingStations', 'products', 'locationTypes', 'locations'].forEach(t => fetchData(t));
    api.get('/master/location-types').then(r => setLocationTypes(r.data.data || [])).catch(() => {});
  }, []);

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
        internalVehicles: '/master/internal-vehicles',
        loadingStations: '/master/loading-stations',
        products: '/master/products',
        locationTypes: '/master/location-types',
        locations: '/master/locations'
      };
      const res = await api.get(endpoints[type]);
      setData(p => ({ ...p, [type]: res.data.data || [] }));
    } catch {}
  };

  const handleProductImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    setImporting(true);
    try {
      const res = await api.post('/master/products/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      if (res.data.success) { toast.success(res.data.message); fetchData('products'); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally { setImporting(false); }
  };

  const handleInternalVehiclesImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    setImporting(true);
    try {
      const res = await api.post('/master/internal-vehicles/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      if (res.data.success) { toast.success(res.data.message); fetchData('internalVehicles'); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally { setImporting(false); }
  };

  const handleDownloadInternalVehiclesTemplate = async () => {
    try {
      const res = await api.get('/master/internal-vehicles/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'internal_vehicles_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('ดาวน์โหลด template ไม่สำเร็จ'); }
  };

  const handleLocationsImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    setImporting(true);
    try {
      const res = await api.post('/master/locations/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      if (res.data.success) { toast.success(res.data.message); fetchData('locations'); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally { setImporting(false); }
  };

  const handleDownloadLocationsTemplate = async () => {
    try {
      const res = await api.get('/master/locations/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'location_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('ดาวน์โหลด template ไม่สำเร็จ'); }
  };

  const handleDownloadProductTemplate = async () => {
    try {
      const res = await api.get('/master/products/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'product_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('ดาวน์โหลด template ไม่สำเร็จ'); }
  };

  const openCreate = () => {
    setForm({});
    setEditing(null);
    setLocQuery('');
    setLocResults([]);
    setModal(tab);
  };

  const openEdit = (item) => {
    setForm(item);
    setEditing(item);
    setLocQuery(item.Location || item.location || '');
    setLocResults([]);
    setModal(tab);
  };

  const openPinConfirm = () => {
    handleSave();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res;
      const endpoints = {
        warehouses: '/master/warehouses',
        customers: '/master/customers',
        vehicleTypes: '/master/vehicle-types',
        internalVehicles: '/master/internal-vehicles',
        loadingStations: '/master/loading-stations',
        products: '/master/products',
        locationTypes: '/master/location-types',
        locations: '/master/locations'
      };
      const idFields = {
        warehouses: 'WarehouseID',
        customers: 'CustomerID',
        vehicleTypes: 'TypeID',
        internalVehicles: 'VehicleID',
        loadingStations: 'StationID',
        products: 'ProductID',
        locationTypes: 'TypeID',
        locations: 'LocationID'
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
    const labels = { warehouses: 'คลังสินค้า', customers: 'ลูกค้า', vehicleTypes: 'ประเภทรถ', internalVehicles: 'รถ', loadingStations: 'สถานีขึ้นสินค้า', products: 'สินค้า', locationTypes: 'ประเภท Location', locations: 'Location' };
    const idFields = { warehouses: 'WarehouseID', customers: 'CustomerID', vehicleTypes: 'TypeID', internalVehicles: 'VehicleID', loadingStations: 'StationID', products: 'ProductID', locationTypes: 'TypeID', locations: 'LocationID' };
    const endpoints = { warehouses: '/master/warehouses', customers: '/master/customers', vehicleTypes: '/master/vehicle-types', internalVehicles: '/master/internal-vehicles', loadingStations: '/master/loading-stations', products: '/master/products', locationTypes: '/master/location-types', locations: '/master/locations' };
    const name = item.TypeName || item.WarehouseName || item.CustomerName || item.StationName || item.ProductName || item.LocationName || item.LicensePlate || '';
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

  const idField = { warehouses: 'WarehouseID', customers: 'CustomerID', vehicleTypes: 'TypeID', internalVehicles: 'VehicleID', loadingStations: 'StationID', products: 'ProductID', locationTypes: 'TypeID', locations: 'LocationID' };
  const endpointMap = { warehouses: '/master/warehouses', customers: '/master/customers', vehicleTypes: '/master/vehicle-types', internalVehicles: '/master/internal-vehicles', loadingStations: '/master/loading-stations', products: '/master/products', locationTypes: '/master/location-types', locations: '/master/locations' };

  const toggleSelect = (id) => setSelected(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () => {
    const items = data[tab] || [];
    setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i[idField[tab]])));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`ยืนยันลบ ${selected.size} รายการที่เลือก?`)) return;
    const endpoint = endpointMap[tab];
    let failed = 0;
    for (const id of selected) {
      try { await api.delete(`${endpoint}/${id}`); }
      catch { failed++; }
    }
    if (failed) toast.error(`ลบไม่สำเร็จ ${failed} รายการ`);
    else toast.success(`ลบสำเร็จ ${selected.size} รายการ`);
    setSelected(new Set());
    fetchData(tab);
    if (tab === 'warehouses') fetchWarehouses();
  };

  const getFormPayload = () => {
    switch (tab) {
      case 'warehouses': return { warehouseCode: form.WarehouseCode || form.warehouseCode, warehouseName: form.WarehouseName || form.warehouseName, location: form.Location || form.location, gpsLat: form.GpsLat || form.gpsLat, gpsLng: form.GpsLng || form.gpsLng, isActive: form.IsActive ?? 1, radiusKm: parseFloat(form.RadiusKm ?? form.radiusKm ?? 5) };
      case 'customers': return { customerCode: form.CustomerCode || form.customerCode, customerName: form.CustomerName || form.customerName, phone: form.Phone || form.phone, address: form.Address || form.address, isActive: form.IsActive ?? 1 };
      case 'vehicleTypes': return {
        typeName: form.TypeName || form.typeName,
        description: form.Description || form.description,
        startHour: parseInt(form.StartHour ?? form.startHour ?? 8),
        startMinute: parseInt(form.StartMinute ?? form.startMinute ?? 0),
        cutoffHour: parseInt(form.CutoffHour ?? form.cutoffHour ?? 16),
        cutoffMinute: parseInt(form.CutoffMinute ?? form.cutoffMinute ?? 0),
      };
      case 'loadingStations': return { stationCode: form.StationCode || form.stationCode, stationName: form.StationName || form.stationName, warehouseId: form.WarehouseID || form.warehouseId, sortOrder: form.SortOrder || form.sortOrder || 0, isActive: form.IsActive ?? 1 };
      case 'products': return { productCode: form.ProductCode, productName: form.ProductName, skuType: form.SKUType || null, categoryCode: form.CategoryCode || null, categoryName: form.CategoryName || null, materialType: form.MaterialType || null, formCode: form.FormCode || null, sizeCode: form.SizeCode || null, thickness: form.Thickness || null, targetGroup: form.TargetGroup || null, unitNetWeight: form.UnitNetWeight || null, isActive: form.IsActive ?? 1 };
      case 'locationTypes': return { typeCode: form.TypeCode || form.typeCode, typeName: form.TypeName || form.typeName, sortOrder: form.SortOrder || 0, isActive: form.IsActive ?? 1 };
      case 'locations': return { locationCode: form.LocationCode || form.locationCode, locationName: form.LocationName || form.locationName, warehouseId: form.WarehouseID || form.warehouseId || null, locationTypeId: form.LocationTypeID || form.locationTypeId || null, isActive: form.IsActive ?? 1 };
      case 'internalVehicles': return {
        licensePlate: form.LicensePlate || '',
        vehicleName: form.VehicleName || null,
        vehicleCategory: form.VehicleCategory || null,
        actExpiry: form.ActExpiry || null,
        insuranceExpiry: form.InsuranceExpiry || null,
        inspectionExpiry: form.InspectionExpiry || null,
        otherDocName: form.OtherDocName || null,
        otherDocExpiry: form.OtherDocExpiry || null,
        insuranceCompany: form.InsuranceCompany || null,
        insuranceType: form.InsuranceType || null,
        actCompany: form.ActCompany || null,
        taxExpiry: form.TaxExpiry || null,
        bedWidth: form.BedWidth || null,
        bedLength: form.BedLength || null,
        bedHeight: form.BedHeight || null,
        payloadKg: form.PayloadKg || null,
        vehicleStatus: form.VehicleStatus || 'พร้อมใช้',
        symptoms: form.Symptoms || null,
        repairEntryDate: form.RepairEntryDate || null,
        estimatedCompletionDate: form.EstimatedCompletionDate || null,
        notes: form.Notes || null,
        isActive: form.IsActive ?? 1,
      };
      default: return form;
    }
  };

  const Checkbox = ({ id, checked, onChange }) => (
    <input type="checkbox" checked={checked} onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-4 h-4 rounded accent-red-600 cursor-pointer flex-shrink-0" />
  );

  const renderTable = () => {
    const items = data[tab] || [];
    if (!items.length) return <p className="text-center text-slate-400 py-8">ยังไม่มีข้อมูล</p>;
    const idf = idField[tab];
    const allChecked = items.length > 0 && selected.size === items.length;

    const selectAllRow = (
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
        <Checkbox id="all" checked={allChecked} onChange={toggleSelectAll} />
        <span className="text-xs text-gray-400">เลือกทั้งหมด ({items.length} รายการ)</span>
      </div>
    );

    switch (tab) {
      case 'internalVehicles': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          <div className="space-y-0">
            {items.map(i => {
              const sel = selected.has(i.VehicleID);
              const needsRepair = i.VehicleStatus === 'รอซ่อม' || i.VehicleStatus === 'อุบัติเหตุ';
              return (
                <div key={i.VehicleID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <div className="pt-0.5 flex-shrink-0"><Checkbox id={i.VehicleID} checked={sel} onChange={() => toggleSelect(i.VehicleID)} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-base">{i.LicensePlate}</span>
                      {i.VehicleName && <span className="text-slate-500 text-sm">{i.VehicleName}</span>}
                      {i.VehicleCategory && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{i.VehicleCategory}</span>}
                    </div>
                    {needsRepair && (
                      <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 flex flex-wrap gap-2">
                        {i.Symptoms && <span>อาการ: {i.Symptoms}</span>}
                        {i.RepairEntryDate && <span>เข้าซ่อม: {new Date(i.RepairEntryDate).toLocaleDateString('th-TH')}</span>}
                        {i.EstimatedCompletionDate && <span>คาดเสร็จ: {new Date(i.EstimatedCompletionDate).toLocaleDateString('th-TH')}</span>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <ExpiryBadge date={i.InsuranceExpiry} label="ประกันภัย คงเหลือ" />
                      <ExpiryBadge date={i.ActExpiry} label="พ.ร.บ. คงเหลือ" />
                      <ExpiryBadge date={i.TaxExpiry} label="ภาษีรถ คงเหลือ" />
                    </div>
                  </div>
                  <div className="flex-shrink-0"><VehicleStatusBadge status={i.VehicleStatus} /></div>
                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'warehouses': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          <div className="space-y-0">
            {items.map(i => {
              const sel = selected.has(i[idf]);
              return (
                <div key={i.WarehouseID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <Checkbox id={i[idf]} checked={sel} onChange={() => toggleSelect(i[idf])} />
                  <div className="flex-shrink-0">
                    <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold font-mono" style={{ background: '#eff6ff', color: '#2563eb' }}>{i.WarehouseCode}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{i.WarehouseName}</p>
                    {i.Location ? (
                      <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs" title={i.Location}>
                        <MapPin size={10} className="inline mr-1 text-gray-300" />
                        {i.Location.length > 60 ? i.Location.slice(0, 60) + '…' : i.Location}
                      </p>
                    ) : <p className="text-xs text-gray-300 mt-0.5">ยังไม่ระบุที่ตั้ง</p>}
                  </div>
                  <div className="hide-mobile flex-shrink-0 flex items-center gap-2">
                    {i.GpsLat && i.GpsLng ? (
                      <a href={`https://www.google.com/maps?q=${i.GpsLat},${i.GpsLng}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium" style={{ background: '#f0fdf4', color: '#16a34a' }}
                        onClick={e => e.stopPropagation()}>
                        <MapPin size={10} />{parseFloat(i.GpsLat).toFixed(4)}, {parseFloat(i.GpsLng).toFixed(4)}
                      </a>
                    ) : <span className="text-xs text-gray-300">ไม่มี GPS</span>}
                    {i.RadiusKm != null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium" style={{ background: '#fef3c7', color: '#d97706' }}>⊙ {i.RadiusKm} กม.</span>
                    )}
                  </div>
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-xl text-xs font-semibold ${i.IsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{i.IsActive ? '● ใช้งาน' : '○ ปิด'}</span>
                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'customers': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          <div className="space-y-0">
            {items.map(i => {
              const sel = selected.has(i[idf]);
              return (
                <div key={i.CustomerID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <Checkbox id={i[idf]} checked={sel} onChange={() => toggleSelect(i[idf])} />
                  <span className="flex-shrink-0 inline-block px-2.5 py-1 rounded-xl text-xs font-bold font-mono" style={{ background: '#eff6ff', color: '#2563eb' }}>{i.CustomerCode}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{i.CustomerName}</p>
                    {i.Address && <p className="text-xs text-gray-400 truncate mt-0.5">{i.Address}</p>}
                  </div>
                  {i.Phone && <span className="hide-mobile flex-shrink-0 text-xs text-gray-500 font-medium">{i.Phone}</span>}
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-xl text-xs font-semibold ${i.IsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{i.IsActive ? '● ใช้งาน' : '○ ปิด'}</span>
                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'vehicleTypes': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          <div className="space-y-0">
            {items.map(i => {
              const sel = selected.has(i[idf]);
              const sh = String(i.StartHour ?? 8).padStart(2,'0');
              const sm = String(i.StartMinute ?? 0).padStart(2,'0');
              const ch = String(i.CutoffHour ?? 16).padStart(2,'0');
              const cm = String(i.CutoffMinute ?? 0).padStart(2,'0');
              return (
                <div key={i.TypeID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <Checkbox id={i[idf]} checked={sel} onChange={() => toggleSelect(i[idf])} />
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}><Truck size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{i.TypeName}</p>
                    {i.Description && <p className="text-xs text-gray-400 mt-0.5">{i.Description}</p>}
                  </div>
                  <div className="hide-mobile flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">เปิดรับ</span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700">{sh}:{sm}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-xs text-gray-400">ปิด</span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-700">{ch}:{cm}</span>
                  </div>
                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'loadingStations': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          <div className="space-y-0">
            {items.map(i => {
              const sel = selected.has(i[idf]);
              return (
                <div key={i.StationID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <Checkbox id={i[idf]} checked={sel} onChange={() => toggleSelect(i[idf])} />
                  <span className="flex-shrink-0 inline-block px-2.5 py-1 rounded-xl text-xs font-bold font-mono" style={{ background: '#eff6ff', color: '#2563eb' }}>{i.StationCode}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{i.StationName}</p>
                    {i.WarehouseName && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Warehouse size={10} />{i.WarehouseName}</p>}
                  </div>
                  {i.SortOrder > 0 && <span className="hide-mobile flex-shrink-0 text-xs text-gray-400">ลำดับ {i.SortOrder}</span>}
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-xl text-xs font-semibold ${i.IsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{i.IsActive ? '● ใช้งาน' : '○ ปิด'}</span>
                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'locationTypes': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          {items.map(i => (
            <div key={i.TypeID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${selected.has(i.TypeID) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
              <Checkbox id={i.TypeID} checked={selected.has(i.TypeID)} onChange={() => toggleSelect(i.TypeID)} />
              <span className="flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold font-mono" style={{ background: '#eff6ff', color: '#2563eb' }}>{i.TypeCode}</span>
              <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{i.TypeName}</p><p className="text-xs text-gray-400">ลำดับ {i.SortOrder}</p></div>
              <span className={`flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold ${i.IsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{i.IsActive ? '● ใช้งาน' : '○ ปิด'}</span>
              <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700"><Edit size={14} /></button>
                <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {!items.length && <p className="text-center text-slate-400 py-8 text-sm">ยังไม่มีข้อมูล</p>}
        </div>
      );
      case 'locations': return (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {selectAllRow}
          {items.map(i => {
            const ltColor = i.LocationTypeName ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-400';
            return (
              <div key={i.LocationID} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all group ${selected.has(i.LocationID) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                <Checkbox id={i.LocationID} checked={selected.has(i.LocationID)} onChange={() => toggleSelect(i.LocationID)} />
                <span className="flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold font-mono" style={{ background: '#eff6ff', color: '#2563eb' }}>{i.LocationCode}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{i.LocationName}</p>
                  {i.WarehouseName && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Warehouse size={10} />{i.WarehouseName}</p>}
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${ltColor}`}>
                  {i.LocationTypeName || 'ไม่ระบุประเภท'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setPrintLocation(i); }}
                  title="พิมพ์บาร์โค้ด"
                  className="flex-shrink-0 p-1.5 rounded-xl hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                >
                  <Printer size={14} />
                </button>
                <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {!items.length && <p className="text-center text-slate-400 py-8 text-sm">ยังไม่มีข้อมูล</p>}
        </div>
      );
      case 'products': {
        const skuColor = { 'ขายดี':'bg-emerald-50 text-emerald-700','ขายน้อยขายต่อเนื่อง':'bg-amber-50 text-amber-700','ขายน้อยขายไม่ต่อเนื่อง':'bg-orange-50 text-orange-700','สินค้าโป๊ว':'bg-red-50 text-red-500' };
        const filtered = items.filter(i => {
          const q = productSearch.toLowerCase();
          const matchSearch = !q || i.ProductCode?.toLowerCase().includes(q) || i.ProductName?.toLowerCase().includes(q) || i.CategoryName?.toLowerCase().includes(q);
          const matchSKU = !productSKUFilter || i.SKUType === productSKUFilter;
          return matchSearch && matchSKU;
        });
        return (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ค้นหารหัส / ชื่อ / หมวด..." className="input-field pl-8 py-1.5 text-sm" />
              </div>
              <select value={productSKUFilter} onChange={e => setProductSKUFilter(e.target.value)} className="input-field py-1.5 text-sm w-auto">
                <option value="">ทุก TypeSKU</option>
                {SKU_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-xs text-gray-400 self-center">{filtered.length} รายการ</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <div className="space-y-0">
                {filtered.map(i => (
                  <div key={i.ProductID} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 transition-all group hover:bg-gray-50">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-blue-600 truncate block">{i.ProductCode}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{i.ProductName}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        {i.CategoryName && <span>{i.CategoryName}</span>}
                        {i.SizeCode && <span className="font-mono">{i.SizeCode}</span>}
                        {i.Thickness > 0 && <span>{i.Thickness}mm</span>}
                        {i.UnitNetWeight > 0 && <span>{i.UnitNetWeight} กก./ชิ้น</span>}
                      </p>
                    </div>
                    {i.SKUType && <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${skuColor[i.SKUType] || 'bg-slate-100 text-slate-500'}`}>{i.SKUType}</span>}
                    <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(i)} className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(i)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {!filtered.length && <p className="text-center text-slate-400 py-8 text-sm">ไม่พบสินค้า</p>}
              </div>
            </div>
          </div>
        );
      }
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
            <label className="label">ค้นหาสถานที่ในไทย</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={locQuery} onChange={e => handleLocInput(e.target.value)}
                className="input-field pl-9 pr-10"
                placeholder="เช่น นิคมอุตสาหกรรมบางปู, ถนนสุขุมวิท สมุทรปราการ..." />
              {locSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />}
            </div>
            {locResults.length > 0 && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto z-[9999] relative bg-white border border-slate-200">
                {locResults.map((item, i) => {
                  const addr = item.address || {};
                  const short = [addr.road, addr.suburb, addr.city || addr.town || addr.county, addr.state].filter(Boolean).join(', ');
                  return (
                    <button key={i} type="button" onClick={() => pickLocation(item)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors hover:bg-red-50 border-b border-slate-100 last:border-0">
                      <MapPin size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-800 font-medium line-clamp-1">{short || item.display_name}</p>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.display_name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {locResults.length === 0 && !locSearching && locQuery.trim() && (
              <p className="text-xs text-slate-400 mt-1">ไม่พบผลลัพธ์ — ลองพิมพ์ชื่ออำเภอ/จังหวัด</p>
            )}
            <button type="button" onClick={useCurrentLocation}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors">
              <Navigation size={12} />ใช้ตำแหน่งปัจจุบัน (GPS)
            </button>
          </div>

          <div className="col-span-2">
            <label className="label">ที่ตั้ง / ที่อยู่</label>
            <input value={form.Location || form.location || ''} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} className="input-field" placeholder="จะกรอกอัตโนมัติเมื่อเลือกจากผลค้นหา" />
          </div>

          {/* Map — shows as soon as GPS coords exist, draggable to fine-tune */}
          {(form.GpsLat || form.gpsLat) && (form.GpsLng || form.gpsLng) ? (<>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">ยืนยันตำแหน่ง <span className="text-slate-400 font-normal">(ลากหมุดเพื่อปรับตำแหน่ง)</span></label>
                <a href={`https://www.google.com/maps?q=${form.GpsLat||form.gpsLat},${form.GpsLng||form.gpsLng}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors">
                  <MapPin size={11} />Google Maps
                </a>
              </div>
              <div className="rounded-xl overflow-hidden border-2 border-red-100" style={{ height: 260 }}>
                <DraggableMap
                  lat={form.GpsLat || form.gpsLat}
                  lng={form.GpsLng || form.gpsLng}
                  height={260}
                  onMove={(la, ln) => setForm(p => ({ ...p, GpsLat: la, GpsLng: ln }))}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono text-right">
                {form.GpsLat || form.gpsLat}, {form.GpsLng || form.gpsLng}
              </p>
            </div>
          </>) : (
            <div className="col-span-2 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 py-6 text-slate-400">
              <MapPin size={24} className="text-slate-300" />
              <p className="text-sm">ค้นหาสถานที่หรือใส่ GPS เพื่อแสดงแผนที่</p>
            </div>
          )}

          <div>
            <label className="label">GPS Latitude</label>
            <input type="number" step="0.000001" value={form.GpsLat || form.gpsLat || ''} onChange={e => setForm(p => ({ ...p, GpsLat: e.target.value }))} className="input-field" placeholder="13.579319" />
          </div>
          <div>
            <label className="label">GPS Longitude</label>
            <input type="number" step="0.000001" value={form.GpsLng || form.gpsLng || ''} onChange={e => setForm(p => ({ ...p, GpsLng: e.target.value }))} className="input-field" placeholder="100.353664" />
          </div>
          <div>
            <label className="label">รัศมีคลัง (กม.) <span className="text-gray-400 font-normal">— รถเข้าถึงถือว่าถึงแล้ว</span></label>
            <input type="number" step="0.5" min="0.5" value={form.RadiusKm ?? form.radiusKm ?? 5} onChange={e => setForm(p => ({ ...p, RadiusKm: e.target.value }))} className="input-field" placeholder="5" />
          </div>
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
      case 'vehicleTypes': return (
        <div className="space-y-3">
          <div><label className="label">ชื่อประเภทรถ *</label><input value={form.TypeName || form.typeName || ''} onChange={e => setForm(p => ({ ...p, TypeName: e.target.value }))} className="input-field" placeholder="รถ 10 ล้อ" /></div>
          <div><label className="label">รายละเอียด</label><input value={form.Description || form.description || ''} onChange={e => setForm(p => ({ ...p, Description: e.target.value }))} className="input-field" /></div>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fef9f0', border: '1px solid #fde68a' }}>
            <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">⏰ ช่วงเวลารับสินค้า (ใช้คำนวณ ในเวลา/นอกเวลา)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-amber-700">เวลาเปิดรับ</label>
                <input type="time"
                  value={`${String(form.StartHour ?? form.startHour ?? 8).padStart(2,'0')}:${String(form.StartMinute ?? form.startMinute ?? 0).padStart(2,'0')}`}
                  onChange={e => {
                    const [h, m] = e.target.value.split(':');
                    setForm(p => ({ ...p, StartHour: parseInt(h), StartMinute: parseInt(m) }));
                  }}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="label text-amber-700">เวลาปิดรับ (Cutoff)</label>
                <input type="time"
                  value={`${String(form.CutoffHour ?? form.cutoffHour ?? 16).padStart(2,'0')}:${String(form.CutoffMinute ?? form.cutoffMinute ?? 0).padStart(2,'0')}`}
                  onChange={e => {
                    const [h, m] = e.target.value.split(':');
                    setForm(p => ({ ...p, CutoffHour: parseInt(h), CutoffMinute: parseInt(m) }));
                  }}
                  className="input-field w-full" />
              </div>
            </div>
            <p className="text-xs text-amber-600">
              รถที่ชั่งเข้าภายในช่วงเวลานี้ถือเป็น "ในเวลา" นอกจากนี้คือ "นอกเวลา"
            </p>
          </div>
        </div>
      );
      case 'loadingStations': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสสถานี *</label><input value={form.StationCode || form.stationCode || ''} onChange={e => setForm(p => ({ ...p, StationCode: e.target.value }))} className="input-field" placeholder="ST001" /></div>
          <div><label className="label">ชื่อสถานี *</label><input value={form.StationName || form.stationName || ''} onChange={e => setForm(p => ({ ...p, StationName: e.target.value }))} className="input-field" placeholder="สถานีที่ 1" /></div>
          <div><label className="label">คลังสินค้า</label><select value={form.WarehouseID || form.warehouseId || ''} onChange={e => setForm(p => ({ ...p, WarehouseID: e.target.value }))} className="input-field"><option value="">-- ทุกคลัง --</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}</select></div>
          <div><label className="label">ลำดับการแสดง</label><input type="number" value={form.SortOrder || form.sortOrder || 0} onChange={e => setForm(p => ({ ...p, SortOrder: e.target.value }))} className="input-field" /></div>
        </div>
      </>);
      case 'locationTypes': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสประเภท *</label><input value={form.TypeCode || form.typeCode || ''} onChange={e => setForm(p => ({ ...p, TypeCode: e.target.value }))} className="input-field font-mono" placeholder="FAST" disabled={!!editing} /></div>
          <div><label className="label">ชื่อประเภท *</label><input value={form.TypeName || form.typeName || ''} onChange={e => setForm(p => ({ ...p, TypeName: e.target.value }))} className="input-field" placeholder="ขายดี" /></div>
          <div><label className="label">ลำดับ</label><input type="number" value={form.SortOrder || 0} onChange={e => setForm(p => ({ ...p, SortOrder: e.target.value }))} className="input-field" /></div>
          {editing && <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="ltActive" checked={form.IsActive ?? 1} onChange={e => setForm(p => ({ ...p, IsActive: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="ltActive" className="text-sm text-slate-600 cursor-pointer">ใช้งาน</label>
          </div>}
        </div>
      </>);
      case 'locations': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัส Location *</label><input value={form.LocationCode || form.locationCode || ''} onChange={e => setForm(p => ({ ...p, LocationCode: e.target.value }))} className="input-field font-mono" placeholder="A-01-01" disabled={!!editing} /></div>
          <div><label className="label">ชื่อ Location *</label><input value={form.LocationName || form.locationName || ''} onChange={e => setForm(p => ({ ...p, LocationName: e.target.value }))} className="input-field" placeholder="ชั้น A แถว 1 ช่อง 1" /></div>
          <div><label className="label">คลังสินค้า</label>
            <select value={form.WarehouseID || form.warehouseId || ''} onChange={e => setForm(p => ({ ...p, WarehouseID: e.target.value }))} className="input-field">
              <option value="">-- ทุกคลัง --</option>
              {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
            </select>
          </div>
          <div><label className="label">ประเภท Location (SKU Matching)</label>
            <select value={form.LocationTypeID || form.locationTypeId || ''} onChange={e => setForm(p => ({ ...p, LocationTypeID: e.target.value }))} className="input-field">
              <option value="">-- ไม่ระบุ --</option>
              {locationTypes.map(lt => <option key={lt.TypeID} value={lt.TypeID}>{lt.TypeCode} — {lt.TypeName}</option>)}
            </select>
          </div>
          {editing && <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="locActive" checked={form.IsActive ?? 1} onChange={e => setForm(p => ({ ...p, IsActive: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="locActive" className="text-sm text-slate-600 cursor-pointer">ใช้งาน</label>
          </div>}
        </div>
      </>);
      case 'internalVehicles': {
        const status = form.VehicleStatus || 'พร้อมใช้';
        const showRepair = status === 'รอซ่อม' || status === 'อุบัติเหตุ';
        return (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* ข้อมูลรถ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">ทะเบียนรถ *</label>
                <input value={form.LicensePlate || ''} onChange={e => setForm(p => ({ ...p, LicensePlate: e.target.value }))}
                  className="input-field font-bold text-base" placeholder="กก-1234" />
              </div>
              <div>
                <label className="label">ชื่อ / รุ่นรถ</label>
                <input value={form.VehicleName || ''} onChange={e => setForm(p => ({ ...p, VehicleName: e.target.value }))}
                  className="input-field" placeholder="ISUZU NPR 130" />
              </div>
              <div>
                <label className="label">ประเภทรถ</label>
                <input value={form.VehicleCategory || ''} onChange={e => setForm(p => ({ ...p, VehicleCategory: e.target.value }))}
                  className="input-field" placeholder="รถยก, รถลาก, รถดั้ม..." />
              </div>
            </div>

            {/* ขนาดกะบะบรรทุก */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <p className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                ขนาดกะบะบรรทุก (เมตร) และน้ำหนักบรรทุก
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-sky-700">กว้าง (ม.)</label>
                  <input type="number" step="0.01" min="0" value={form.BedWidth || ''}
                    onChange={e => setForm(p => ({ ...p, BedWidth: e.target.value }))}
                    className="input-field" placeholder="2.00" />
                </div>
                <div>
                  <label className="label text-sky-700">ยาว (ม.)</label>
                  <input type="number" step="0.01" min="0" value={form.BedLength || ''}
                    onChange={e => setForm(p => ({ ...p, BedLength: e.target.value }))}
                    className="input-field" placeholder="4.50" />
                </div>
                <div>
                  <label className="label text-sky-700">สูง (ม.)</label>
                  <input type="number" step="0.01" min="0" value={form.BedHeight || ''}
                    onChange={e => setForm(p => ({ ...p, BedHeight: e.target.value }))}
                    className="input-field" placeholder="1.80" />
                </div>
                <div>
                  <label className="label text-sky-700">น้ำหนักบรรทุก (กก.)</label>
                  <input type="number" step="1" min="0" value={form.PayloadKg || ''}
                    onChange={e => setForm(p => ({ ...p, PayloadKg: e.target.value }))}
                    className="input-field" placeholder="5000" />
                </div>
              </div>
            </div>

            {/* ข้อมูลประกันภัย / พรบ. / ภาษีรถ */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fef9f0', border: '1px solid #fde68a' }}>
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5"><Calendar size={13}/>ข้อมูลประกันภัย/พรบ./ภาษี</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-amber-700">บริษัท ประกันภัย</label>
                  <input value={form.InsuranceCompany || ''} onChange={e => setForm(p => ({ ...p, InsuranceCompany: e.target.value }))}
                    className="input-field" placeholder="ชื่อบริษัทประกัน" />
                </div>
                <div>
                  <label className="label text-amber-700">ประเภทประกัน</label>
                  <input value={form.InsuranceType || ''} onChange={e => setForm(p => ({ ...p, InsuranceType: e.target.value }))}
                    className="input-field" placeholder="เช่น ชั้น 1, ชั้น 2, ชั้น 3+" />
                </div>
                <div>
                  <label className="label text-amber-700">วันหมดอายุ (ประกัน)</label>
                  <input type="date" value={form.InsuranceExpiry ? form.InsuranceExpiry.split('T')[0] : ''}
                    onChange={e => setForm(p => ({ ...p, InsuranceExpiry: e.target.value }))}
                    className="input-field" />
                  {form.InsuranceExpiry && <p className="text-[10px] mt-0.5"><ExpiryBadge date={form.InsuranceExpiry} label="ประกัน" /></p>}
                </div>
                <div>
                  <label className="label text-amber-700">บริษัท พรบ.</label>
                  <input value={form.ActCompany || ''} onChange={e => setForm(p => ({ ...p, ActCompany: e.target.value }))}
                    className="input-field" placeholder="ชื่อบริษัท พรบ." />
                </div>
                <div>
                  <label className="label text-amber-700">วันหมดอายุ (พรบ.)</label>
                  <input type="date" value={form.ActExpiry ? form.ActExpiry.split('T')[0] : ''}
                    onChange={e => setForm(p => ({ ...p, ActExpiry: e.target.value }))}
                    className="input-field" />
                  {form.ActExpiry && <p className="text-[10px] mt-0.5"><ExpiryBadge date={form.ActExpiry} label="พ.ร.บ." /></p>}
                </div>
                <div className="col-span-2">
                  <label className="label text-amber-700">วันต่อภาษีรถ</label>
                  <input type="date" value={form.TaxExpiry ? form.TaxExpiry.split('T')[0] : ''}
                    onChange={e => setForm(p => ({ ...p, TaxExpiry: e.target.value }))}
                    className="input-field" />
                  {form.TaxExpiry && <p className="text-[10px] mt-0.5"><ExpiryBadge date={form.TaxExpiry} label="ภาษีรถ" /></p>}
                </div>
              </div>
            </div>

            {/* สถานะรถ */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: showRepair ? '#fef3f2' : '#f0fdf4', border: `1px solid ${showRepair ? '#fecaca' : '#bbf7d0'}` }}>
              <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: showRepair ? '#dc2626' : '#16a34a' }}>
                <Car size={13}/>สถานะรถ
              </p>
              <div>
                <label className="label">สถานะ</label>
                <div className="flex gap-2 flex-wrap">
                  {['พร้อมใช้', 'รอซ่อม', 'อุบัติเหตุ'].map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm(p => ({ ...p, VehicleStatus: s }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        status === s
                          ? s === 'พร้อมใช้' ? 'bg-emerald-600 text-white border-emerald-600'
                            : s === 'รอซ่อม' ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {showRepair && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">อาการ / รายละเอียด</label>
                    <textarea value={form.Symptoms || ''} onChange={e => setForm(p => ({ ...p, Symptoms: e.target.value }))}
                      className="input-field resize-none" rows={2} placeholder="อธิบายอาการที่พบ..." />
                  </div>
                  <div>
                    <label className="label">วันที่เข้าซ่อม</label>
                    <input type="date" value={form.RepairEntryDate ? form.RepairEntryDate.split('T')[0] : ''}
                      onChange={e => setForm(p => ({ ...p, RepairEntryDate: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="label">วันที่คาดว่าจะเสร็จ</label>
                    <input type="date" value={form.EstimatedCompletionDate ? form.EstimatedCompletionDate.split('T')[0] : ''}
                      onChange={e => setForm(p => ({ ...p, EstimatedCompletionDate: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>
              )}
            </div>

            {/* หมายเหตุ */}
            <div>
              <label className="label">หมายเหตุ</label>
              <textarea value={form.Notes || ''} onChange={e => setForm(p => ({ ...p, Notes: e.target.value }))}
                className="input-field resize-none" rows={2} />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ivActive" checked={form.IsActive ?? 1}
                  onChange={e => setForm(p => ({ ...p, IsActive: e.target.checked ? 1 : 0 }))} />
                <label htmlFor="ivActive" className="text-sm text-slate-600 cursor-pointer">ใช้งาน</label>
              </div>
            )}
          </div>
        );
      }
      case 'products': return (<>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">รหัสสินค้า *</label><input value={form.ProductCode || ''} onChange={e => setForm(p => ({ ...p, ProductCode: e.target.value }))} className="input-field font-mono" placeholder="06-GQ0190190100CSS" disabled={!!editing} /></div>
          <div><label className="label">TypeSKU</label>
            <select value={form.SKUType || ''} onChange={e => setForm(p => ({ ...p, SKUType: e.target.value }))} className="input-field">
              <option value="">-- ไม่ระบุ --</option>
              {SKU_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label">ชื่อสินค้า *</label><input value={form.ProductName || ''} onChange={e => setForm(p => ({ ...p, ProductName: e.target.value }))} className="input-field" placeholder="ท่อเหลี่ยม GQ 19x19 (1.00mm.) CSS" /></div>
          <div><label className="label">รหัสหมวด</label><input value={form.CategoryCode || ''} onChange={e => setForm(p => ({ ...p, CategoryCode: e.target.value }))} className="input-field" placeholder="06" /></div>
          <div><label className="label">ชื่อหมวด</label><input value={form.CategoryName || ''} onChange={e => setForm(p => ({ ...p, CategoryName: e.target.value }))} className="input-field" placeholder="แป๊ปเหลี่ยม" /></div>
          <div><label className="label">ประเภทวัสดุ</label><input value={form.MaterialType || ''} onChange={e => setForm(p => ({ ...p, MaterialType: e.target.value }))} className="input-field" placeholder="GQ, HR, AL" /></div>
          <div><label className="label">รูปแบบ (Form)</label><input value={form.FormCode || ''} onChange={e => setForm(p => ({ ...p, FormCode: e.target.value }))} className="input-field" placeholder="CSS, CWM" /></div>
          <div><label className="label">ขนาด (Size)</label><input value={form.SizeCode || ''} onChange={e => setForm(p => ({ ...p, SizeCode: e.target.value }))} className="input-field font-mono" placeholder="19X19" /></div>
          <div><label className="label">ความหนา (mm)</label><input type="number" step="0.01" value={form.Thickness || ''} onChange={e => setForm(p => ({ ...p, Thickness: e.target.value }))} className="input-field" placeholder="1.00" /></div>
          <div><label className="label">กลุ่มเป้าหมาย</label><input value={form.TargetGroup || ''} onChange={e => setForm(p => ({ ...p, TargetGroup: e.target.value }))} className="input-field" placeholder="ท่อขนาดเล็ก" /></div>
          <div><label className="label">น้ำหนัก/ชิ้น (กก.)</label><input type="number" step="0.001" value={form.UnitNetWeight || ''} onChange={e => setForm(p => ({ ...p, UnitNetWeight: e.target.value }))} className="input-field" placeholder="3.490" /></div>
          {editing && <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="pActive" checked={form.IsActive ?? 1} onChange={e => setForm(p => ({ ...p, IsActive: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="pActive" className="text-sm text-slate-600 cursor-pointer">ใช้งาน</label>
          </div>}
        </div>
      </>);
    }
  };

  const summaryItems = [
    { key: 'warehouses', label: 'คลังสินค้า', unit: 'คลัง', icon: Warehouse, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'customers', label: 'ลูกค้า', unit: 'ราย', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'vehicleTypes', label: 'ประเภทรถ', unit: 'ประเภท', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'internalVehicles', label: 'รถขนส่งภายใน', unit: 'คัน', icon: Car, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { key: 'loadingStations', label: 'สถานีขึ้นสินค้า', unit: 'สถานี', icon: Package, color: 'text-red-600', bg: 'bg-red-50' },
    { key: 'products', label: 'สินค้า', unit: 'รายการ', icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

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
            {tab === 'internalVehicles' && (<>
              <input ref={internalVehiclesImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInternalVehiclesImport} />
              <button onClick={() => !importing && internalVehiclesImportRef.current?.click()} disabled={importing}
                className="btn-secondary text-sm flex items-center gap-1.5">
                {importing ? <><span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />กำลังนำเข้า...</> : <><Upload size={14} />Import</>}
              </button>
              <button onClick={handleDownloadInternalVehiclesTemplate} className="btn-secondary text-sm flex items-center gap-1.5"><Download size={14} />Template</button>
            </>)}
            {tab === 'customers' && (<>
              <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <button onClick={() => !importing && importRef.current?.click()} disabled={importing}
                className="btn-secondary text-sm flex items-center gap-1.5">
                {importing ? <><span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />กำลังนำเข้า...</> : <><Upload size={14} />Import</>}
              </button>
              <button onClick={handleDownloadTemplate} className="btn-secondary text-sm"><Download size={14} />Template</button>
            </>)}
            {tab === 'products' && (<>
              <input ref={productImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleProductImport} />
              <button onClick={() => !importing && productImportRef.current?.click()} disabled={importing}
                className="btn-secondary text-sm flex items-center gap-1.5">
                {importing ? <><span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />กำลังนำเข้า...</> : <><Upload size={14} />Import</>}
              </button>
              <button onClick={handleDownloadProductTemplate} className="btn-secondary text-sm"><Download size={14} />Template</button>
            </>)}
            {tab === 'locations' && (<>
              <input ref={locationsImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleLocationsImport} />
              <button onClick={() => !importing && locationsImportRef.current?.click()} disabled={importing}
                className="btn-secondary text-sm flex items-center gap-1.5">
                {importing ? <><span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />กำลังนำเข้า...</> : <><Upload size={14} />Import</>}
              </button>
              <button onClick={handleDownloadLocationsTemplate} className="btn-secondary text-sm"><Download size={14} />Template</button>
            </>)}
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} />เพิ่ม
            </button>
          </div>
        </div>
        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-2xl">
            <span className="text-sm font-semibold text-red-700">เลือก {selected.size} รายการ</span>
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
              <Trash2 size={12} />ลบที่เลือก
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto">ยกเลิก</button>
          </div>
        )}
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>

      {printLocation && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-bold text-slate-800 flex items-center gap-2"><Printer size={15} />พิมพ์บาร์โค้ด Location</span>
              <button onClick={() => setPrintLocation(null)} className="text-gray-400 hover:text-gray-700 p-1"><X size={16} /></button>
            </div>
            <div className="p-6 flex justify-center">
              <div ref={printLabelRef} className="border border-gray-200 rounded-xl p-5 text-center" style={{ width: 220 }}>
                <QRCodeSVG
                  value={printLocation.LocationCode}
                  size={170}
                  level="M"
                  includeMargin={false}
                />
                <div className="mt-3 font-black text-2xl font-mono tracking-wide text-slate-900">
                  {printLocation.LocationCode}
                </div>
                {printLocation.LocationName && printLocation.LocationName !== printLocation.LocationCode && (
                  <div className="text-sm text-gray-600 mt-1 leading-tight">{printLocation.LocationName}</div>
                )}
                {printLocation.WarehouseName && (
                  <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                    <Warehouse size={10} />{printLocation.WarehouseName}
                  </div>
                )}
                {printLocation.LocationTypeName && (
                  <div className="mt-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      {printLocation.LocationTypeName}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={handlePrintLabel} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Printer size={14} />พิมพ์
              </button>
              <button onClick={() => setPrintLocation(null)} className="btn-secondary px-5">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className={`rounded-2xl w-full p-6 bg-white border border-slate-200 shadow-xl ${modal === 'warehouses' ? 'max-w-xl' : modal === 'internalVehicles' ? 'max-w-lg' : 'max-w-md'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? 'แก้ไข' : 'เพิ่ม'} {tabs.find(t => t.key === tab)?.label}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
            </div>
            {renderForm()}
            <div className="flex gap-3 mt-5">
              <button onClick={openPinConfirm} disabled={saving} className="btn-primary flex-1">
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
