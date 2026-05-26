import { useState, useEffect } from 'react';
import { Scale, Plus, Search, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime, formatWeight } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WeighIn() {
  const [form, setForm] = useState({
    licensePlate: '', vehicleTypeId: '', warehouseId: '',
    customerId: '', tareWeight: '', notes: ''
  });
  const [masters, setMasters] = useState({ vehicleTypes: [], warehouses: [], customers: [] });
  const [todayList, setTodayList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [plateCheck, setPlateCheck] = useState(null);
  const [tab, setTab] = useState('form'); // form | list

  useEffect(() => {
    fetchMasters();
    fetchTodayList();
  }, []);

  const fetchMasters = async () => {
    try {
      const [vt, wh, cu] = await Promise.all([
        api.get('/master/vehicle-types'),
        api.get('/master/warehouses'),
        api.get('/master/customers')
      ]);
      setMasters({
        vehicleTypes: vt.data.data,
        warehouses: wh.data.data,
        customers: cu.data.data
      });
    } catch {}
  };

  const fetchTodayList = async () => {
    try {
      const res = await api.get('/weigh-in/today');
      setTodayList(res.data.data || []);
    } catch {}
  };

  const checkPlate = async (plate) => {
    if (!plate || plate.length < 4) { setPlateCheck(null); return; }
    setChecking(true);
    try {
      const res = await api.get(`/weigh-in/check/${encodeURIComponent(plate.toUpperCase())}`);
      setPlateCheck(res.data);
    } catch {} finally {
      setChecking(false);
    }
  };

  const handlePlateChange = (e) => {
    const val = e.target.value.toUpperCase();
    setForm(p => ({ ...p, licensePlate: val }));
    const timer = setTimeout(() => checkPlate(val), 500);
    return () => clearTimeout(timer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (plateCheck?.inYard) {
      toast.error(`ทะเบียน ${form.licensePlate} ยังอยู่ในคลัง (Trip #${plateCheck.trip?.TripID})`);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/weigh-in', form);
      if (res.data.success) {
        toast.success(res.data.message);
        setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', tareWeight: '', notes: '' });
        setPlateCheck(null);
        fetchTodayList();
        setTab('list');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('form')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'form' ? 'bg-blue-600 text-white' : 'bg-steel-700 text-steel-300 hover:text-white'}`}
        >
          <Plus size={14} className="inline mr-1" />บันทึกชั่งเข้า
        </button>
        <button
          onClick={() => { setTab('list'); fetchTodayList(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-steel-700 text-steel-300 hover:text-white'}`}
        >
          <Scale size={14} className="inline mr-1" />รายการวันนี้ ({todayList.length})
        </button>
      </div>

      {tab === 'form' && (
        <div className="card">
          <h3 className="card-header flex items-center gap-2">
            <Scale size={20} className="text-blue-400" />สถานีชั่งเข้า (ชั่งเบา)
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* License plate */}
            <div className="sm:col-span-2">
              <label className="label">ทะเบียนรถ *</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.licensePlate}
                  onChange={handlePlateChange}
                  className="input-field text-xl font-bold tracking-wider uppercase"
                  placeholder="เช่น กข-1234"
                  required
                />
                {checking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {plateCheck?.inYard && (
                <div className="mt-2 flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-3">
                  <AlertCircle size={16} />
                  <span className="text-sm">ทะเบียนนี้ยังอยู่ในคลัง! Trip #{plateCheck.trip?.TripID} | สถานะ: {plateCheck.trip?.Status}</span>
                </div>
              )}
              {plateCheck && !plateCheck.inYard && form.licensePlate && (
                <div className="mt-2 flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle size={14} />ทะเบียนนี้ไม่อยู่ในคลัง
                </div>
              )}
            </div>

            {/* Vehicle type */}
            <div>
              <label className="label">ประเภทรถ *</label>
              <select value={form.vehicleTypeId} onChange={e => setForm(p => ({ ...p, vehicleTypeId: e.target.value }))}
                className="input-field" required>
                <option value="">-- เลือกประเภทรถ --</option>
                {masters.vehicleTypes.map(vt => (
                  <option key={vt.TypeID} value={vt.TypeID}>{vt.TypeName}</option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="label">คลังสินค้า *</label>
              <select value={form.warehouseId} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}
                className="input-field" required>
                <option value="">-- เลือกคลัง --</option>
                {masters.warehouses.map(w => (
                  <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div>
              <label className="label">ลูกค้า</label>
              <select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}
                className="input-field">
                <option value="">-- เลือกลูกค้า --</option>
                {masters.customers.map(c => (
                  <option key={c.CustomerID} value={c.CustomerID}>{c.CustomerName}</option>
                ))}
              </select>
            </div>

            {/* Tare weight */}
            <div>
              <label className="label">น้ำหนักเบา (กิโลกรัม)</label>
              <input type="number" step="0.01" value={form.tareWeight}
                onChange={e => setForm(p => ({ ...p, tareWeight: e.target.value }))}
                className="input-field" placeholder="0.00" />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="label">หมายเหตุ</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="input-field resize-none" rows={2} placeholder="หมายเหตุ (ถ้ามี)" />
            </div>

            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={loading || plateCheck?.inYard}
                className="btn-success flex-1 py-3">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังบันทึก...</> : <><Scale size={16} />บันทึกชั่งเข้า</>}
              </button>
              <button type="button" onClick={() => setForm({ licensePlate: '', vehicleTypeId: '', warehouseId: '', customerId: '', tareWeight: '', notes: '' })}
                className="btn-secondary px-6">ล้าง</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'list' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">รายการชั่งเข้าวันนี้</h3>
            <button onClick={fetchTodayList} className="text-blue-400 hover:text-blue-300 text-sm">รีเฟรช</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-steel-700">
                  <th className="table-header text-left px-4 py-2">ทะเบียน</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">ประเภท</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">ลูกค้า</th>
                  <th className="table-header text-right px-4 py-2">น้ำหนักเบา</th>
                  <th className="table-header text-left px-4 py-2">สถานะ</th>
                  <th className="table-header text-left px-4 py-2 hide-mobile">เวลา</th>
                </tr>
              </thead>
              <tbody>
                {todayList.map(t => (
                  <tr key={t.TripID} className="border-b border-steel-700/50 hover:bg-steel-700/30">
                    <td className="table-cell font-bold text-white">
                      #{t.TripID}<br />
                      <span className="text-sm font-normal">{t.LicensePlate}</span>
                    </td>
                    <td className="table-cell hide-mobile">{t.VehicleType}</td>
                    <td className="table-cell hide-mobile">{t.WarehouseName}</td>
                    <td className="table-cell hide-mobile">{t.CustomerName || '-'}</td>
                    <td className="table-cell text-right">{formatWeight(t.TareWeight)}</td>
                    <td className="table-cell"><StatusBadge status={t.Status} /></td>
                    <td className="table-cell hide-mobile">{formatDateTime(t.WeighDateTime)}</td>
                  </tr>
                ))}
                {!todayList.length && (
                  <tr><td colSpan={7} className="text-center py-8 text-steel-500">ยังไม่มีรายการวันนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
