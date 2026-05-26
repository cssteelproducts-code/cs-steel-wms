import { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Warehouse, Users, Truck, Package, Save, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

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
    setModal(tab);
  };

  const openEdit = (item) => {
    setForm(item);
    setEditing(item);
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
    if (!items.length) return <p className="text-center text-steel-500 py-8">ยังไม่มีข้อมูล</p>;

    switch (tab) {
      case 'warehouses': return (
        <table className="w-full"><thead><tr className="border-b border-steel-700">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อคลัง</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">ที่ตั้ง</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">GPS</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.WarehouseID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
            <td className="table-cell font-mono text-blue-400">{i.WarehouseCode}</td>
            <td className="table-cell text-white font-medium">{i.WarehouseName}</td>
            <td className="table-cell hide-mobile">{i.Location || '-'}</td>
            <td className="table-cell hide-mobile text-xs text-steel-500">{i.GpsLat && i.GpsLng ? `${i.GpsLat}, ${i.GpsLng}` : '-'}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-steel-600 text-steel-400 hover:text-white"><Edit size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'customers': return (
        <table className="w-full"><thead><tr className="border-b border-steel-700">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อลูกค้า</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">โทรศัพท์</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.CustomerID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
            <td className="table-cell font-mono text-blue-400">{i.CustomerCode}</td>
            <td className="table-cell text-white">{i.CustomerName}</td>
            <td className="table-cell hide-mobile">{i.Phone || '-'}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-steel-600 text-steel-400 hover:text-white"><Edit size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'vehicleTypes': return (
        <table className="w-full"><thead><tr className="border-b border-steel-700">
          <th className="table-header text-left px-4 py-2">ประเภทรถ</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">รายละเอียด</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.TypeID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
            <td className="table-cell text-white font-medium">{i.TypeName}</td>
            <td className="table-cell hide-mobile text-steel-400">{i.Description || '-'}</td>
            <td className="px-4 py-3"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-steel-600 text-steel-400 hover:text-white"><Edit size={14} /></button></td>
          </tr>)}
        </tbody></table>
      );
      case 'loadingStations': return (
        <table className="w-full"><thead><tr className="border-b border-steel-700">
          <th className="table-header text-left px-4 py-2">รหัส</th>
          <th className="table-header text-left px-4 py-2">ชื่อสถานี</th>
          <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
          <th className="table-header text-center px-4 py-2">ลำดับ</th>
          <th className="table-header text-center px-4 py-2">สถานะ</th>
          <th className="table-header px-4 py-2" />
        </tr></thead><tbody>
          {items.map(i => <tr key={i.StationID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
            <td className="table-cell font-mono text-blue-400">{i.StationCode}</td>
            <td className="table-cell text-white font-medium">{i.StationName}</td>
            <td className="table-cell hide-mobile">{i.WarehouseName || '-'}</td>
            <td className="table-cell text-center">{i.SortOrder}</td>
            <td className="table-cell text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${i.IsActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>{i.IsActive ? 'ใช้งาน' : 'ปิด'}</span></td>
            <td className="px-4 py-3"><button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-steel-600 text-steel-400 hover:text-white"><Edit size={14} /></button></td>
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
          <div className="col-span-2"><label className="label">ที่ตั้ง</label><input value={form.Location || form.location || ''} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} className="input-field" placeholder="ที่อยู่คลัง" /></div>
          <div><label className="label">GPS Latitude</label><input type="number" step="0.000001" value={form.GpsLat || form.gpsLat || ''} onChange={e => setForm(p => ({ ...p, GpsLat: e.target.value }))} className="input-field" placeholder="13.756331" /></div>
          <div><label className="label">GPS Longitude</label><input type="number" step="0.000001" value={form.GpsLng || form.gpsLng || ''} onChange={e => setForm(p => ({ ...p, GpsLng: e.target.value }))} className="input-field" placeholder="100.501765" /></div>
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-steel-700 text-steel-300 hover:text-white'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">{tabs.find(t => t.key === tab)?.label}</h3>
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus size={14} />เพิ่ม
          </button>
        </div>
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-steel-800 border border-steel-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editing ? 'แก้ไข' : 'เพิ่ม'} {tabs.find(t => t.key === tab)?.label}
              </h3>
              <button onClick={() => setModal(null)} className="text-steel-400 hover:text-white p-1"><X size={18} /></button>
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
