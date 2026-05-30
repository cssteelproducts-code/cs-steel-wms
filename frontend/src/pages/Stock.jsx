import { useState, useEffect } from 'react';
import { Boxes, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Package, Plus, RefreshCw, CheckCircle, X, Edit2, Upload, ChevronLeft, History } from 'lucide-react';

import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const TX_TYPES = [
  { id: 'IN', label: 'รับเข้า', color: 'text-emerald-600' },
  { id: 'OUT', label: 'จ่ายออก', color: 'text-red-500' },
  { id: 'ADJUST', label: 'ปรับ', color: 'text-amber-600' }
];

export default function Stock() {
  const [tab, setTab] = useState('balance');
  const [balance, setBalance] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [counts, setCounts] = useState([]);
  const [countDetail, setCountDetail] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterWh, setFilterWh] = useState('');

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ productCode: '', productName: '', unit: 'ตัน', category: '', description: '' });

  // Transaction form
  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ warehouseId: '', productId: '', txType: 'IN', quantity: '', refDocNo: '', remark: '' });

  // Count state
  const [showCountForm, setShowCountForm] = useState(false);
  const [countForm, setCountForm] = useState({ countName: '', countDate: new Date(Date.now()+7*3600000).toISOString().slice(0,10), remark: '' });
  const [selectedCountId, setSelectedCountId] = useState(null);
  const [itemFilter, setItemFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [entryModal, setEntryModal] = useState(null); // { item }
  const [entryForm, setEntryForm] = useState({ qty: '', note: '' });
  const [entryHistory, setEntryHistory] = useState(null); // { item, entries }
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    if (tab === 'balance') fetchBalance();
    if (tab === 'products') fetchProducts();
    if (tab === 'transactions') fetchTransactions();
    if (tab === 'count') fetchCounts();
  }, [tab, filterWh]);

  const fetchWarehouses = async () => {
    try { const r = await api.get('/master/warehouses'); setWarehouses(r.data.data || []); } catch {}
  };
  const fetchBalance = async () => {
    setLoading(true);
    try { const r = await api.get(`/stock/balance${filterWh ? '?warehouseId=' + filterWh : ''}`); setBalance(r.data.data || []); setLastUpdate(new Date()); } catch {}
    finally { setLoading(false); }
  };
  const fetchProducts = async () => {
    setLoading(true);
    try { const r = await api.get('/stock/products'); setProducts(r.data.data || []); } catch {}
    finally { setLoading(false); }
  };
  const fetchTransactions = async () => {
    setLoading(true);
    try { const r = await api.get(`/stock/transactions${filterWh ? '?warehouseId=' + filterWh : ''}`); setTransactions(r.data.data || []); } catch {}
    finally { setLoading(false); }
  };
  const fetchCounts = async () => {
    setLoading(true);
    try { const r = await api.get('/stock/count'); setCounts(r.data.data || []); } catch {}
    finally { setLoading(false); }
  };
  const fetchCountDetail = async (id) => {
    try { const r = await api.get(`/stock/count/${id}`); setCountDetail(r.data.data); setSelectedItems(new Set()); } catch {}
  };

  const saveProduct = async () => {
    setSaving(true);
    try {
      if (editingProduct) { await api.put(`/stock/products/${editingProduct.ProductID}`, productForm); }
      else { await api.post('/stock/products', productForm); }
      toast.success('บันทึกสำเร็จ');
      setShowProductForm(false); setEditingProduct(null);
      fetchProducts();
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const saveTx = async () => {
    if (!txForm.warehouseId || !txForm.productId || !txForm.quantity) {
      toast.error('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    setSaving(true);
    try {
      await api.post('/stock/transaction', txForm);
      toast.success('บันทึกรายการสำเร็จ');
      setShowTxForm(false);
      setTxForm({ warehouseId: '', productId: '', txType: 'IN', quantity: '', refDocNo: '', remark: '' });
      fetchBalance(); fetchTransactions();
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const createCount = async () => {
    if (!countForm.countName) { toast.error('กรุณาระบุชื่อรายการนับ'); return; }
    setSaving(true);
    try {
      const r = await api.post('/stock/count', countForm);
      toast.success(`สร้างรายการ ${r.data.countCode}`);
      setShowCountForm(false);
      fetchCounts();
      setSelectedCountId(r.data.countId);
      fetchCountDetail(r.data.countId);
    } catch { toast.error('สร้างไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCountId) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/stock/count/${selectedCountId}/import-excel`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(r.data.message);
      fetchCountDetail(selectedCountId);
    } catch (err) { toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ'); }
    setImportLoading(false);
    e.target.value = '';
  };

  const addEntry = async () => {
    if (!entryModal || !entryForm.qty) { toast.error('กรุณากรอกยอดนับ'); return; }
    setSaving(true);
    try {
      await api.post(`/stock/count/${selectedCountId}/entries`, { itemId: entryModal.item.ItemID, countedQty: parseFloat(entryForm.qty), note: entryForm.note });
      toast.success('บันทึกยอดนับสำเร็จ');
      setEntryModal(null);
      setEntryForm({ qty: '', note: '' });
      fetchCountDetail(selectedCountId);
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const loadEntryHistory = async (item) => {
    try {
      const r = await api.get(`/stock/count/${selectedCountId}/entries/${item.ItemID}`);
      setEntryHistory({ item, entries: r.data.data || [] });
    } catch {}
  };

  const closeItems = async (all = false) => {
    const itemIds = all ? [] : [...selectedItems];
    setSaving(true);
    try {
      await api.put(`/stock/count/${selectedCountId}/close-items`, all ? { all: true } : { itemIds });
      toast.success('ปิดรายการสำเร็จ');
      setSelectedItems(new Set());
      fetchCountDetail(selectedCountId);
      fetchCounts();
    } catch { toast.error('ปิดไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const reopenItems = async () => {
    setSaving(true);
    try {
      await api.put(`/stock/count/${selectedCountId}/reopen-items`, { itemIds: [...selectedItems] });
      toast.success('เปิดรายการใหม่สำเร็จ');
      setSelectedItems(new Set());
      fetchCountDetail(selectedCountId);
    } catch { toast.error('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  // dummy placeholder to maintain function reference
  const confirmCount = async () => {
    setSaving(false);
  };

  const TX_COLOR = { IN: 'text-emerald-600', OUT: 'text-red-500', ADJUST: 'text-amber-600', COUNT: 'text-blue-500' };
  const TX_SIGN = { IN: '+', OUT: '-', ADJUST: '±', COUNT: '±' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <Boxes size={20} className="text-blue-500 flex-shrink-0" />
            สต๊อกสินค้า
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchBalance} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'balance', icon: Boxes, label: 'ยอดสต็อก' },
          { id: 'transactions', icon: ArrowDownToLine, label: 'รับ-จ่ายสินค้า' },
          { id: 'count', icon: ClipboardList, label: 'นับสต็อก' },
          { id: 'products', icon: Package, label: 'รายการสินค้า' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Warehouse filter */}
      {tab !== 'products' && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">คลัง:</label>
          <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="input-field w-48">
            <option value="">ทุกคลัง</option>
            {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
          </select>
        </div>
      )}

      {/* BALANCE TAB */}
      {tab === 'balance' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2"><Boxes size={18} className="text-blue-500" />ยอดสต็อกสินค้า</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowTxForm(true)} className="btn-primary text-sm px-3 py-1.5">
                <Plus size={13} />บันทึกรับ-จ่าย
              </button>
              <button onClick={fetchBalance} className="text-blue-500 hover:text-blue-600 text-sm"><RefreshCw size={14} /></button>
            </div>
          </div>
          {loading ? <div className="text-center py-8 text-slate-500">กำลังโหลด...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">รหัสสินค้า</th>
                    <th className="table-header text-left px-3 py-2">ชื่อสินค้า</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">หมวดหมู่</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">คลัง</th>
                    <th className="table-header text-right px-3 py-2">ยอดคงเหลือ</th>
                    <th className="table-header text-right px-3 py-2 hide-mobile">อัปเดต</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.map(s => (
                    <tr key={s.StockID} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="table-cell font-mono text-blue-600">{s.ProductCode}</td>
                      <td className="table-cell font-medium text-slate-900">{s.ProductName}</td>
                      <td className="table-cell hide-mobile text-slate-500">{s.Category || '—'}</td>
                      <td className="table-cell hide-mobile">{s.WarehouseName}</td>
                      <td className="table-cell text-right">
                        <span className={`font-bold ${s.Quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {parseFloat(s.Quantity).toFixed(3)}
                        </span>
                        <span className="text-slate-400 ml-1 text-xs">{s.Unit}</span>
                      </td>
                      <td className="table-cell text-right hide-mobile text-slate-400 text-xs">{dayjs(s.LastUpdated).format('DD/MM HH:mm')}</td>
                    </tr>
                  ))}
                  {!balance.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีข้อมูลสต็อก</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Inline Tx Form */}
          {showTxForm && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">บันทึกรับ / จ่ายสินค้า</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">คลังสินค้า *</label>
                  <select value={txForm.warehouseId} onChange={e => setTxForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">เลือกคลัง</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">สินค้า *</label>
                  <select value={txForm.productId} onChange={e => setTxForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">เลือกสินค้า</option>
                    {products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} - {p.ProductName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภท *</label>
                  <select value={txForm.txType} onChange={e => setTxForm(p => ({ ...p, txType: e.target.value }))} className="input-field">
                    {TX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">จำนวน *</label>
                  <input type="number" step="0.001" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" placeholder="0.000" />
                </div>
                <div>
                  <label className="label">เลขเอกสารอ้างอิง</label>
                  <input type="text" value={txForm.refDocNo} onChange={e => setTxForm(p => ({ ...p, refDocNo: e.target.value }))} className="input-field" placeholder="เลขใบสั่ง/DO" />
                </div>
                <div>
                  <label className="label">หมายเหตุ</label>
                  <input type="text" value={txForm.remark} onChange={e => setTxForm(p => ({ ...p, remark: e.target.value }))} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveTx} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setShowTxForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab === 'transactions' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2"><ArrowDownToLine size={18} className="text-blue-500" />ประวัติรับ-จ่ายสินค้า</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowTxForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />บันทึกใหม่</button>
              <button onClick={fetchTransactions} className="text-blue-500 hover:text-blue-600 text-sm"><RefreshCw size={14} /></button>
            </div>
          </div>
          {showTxForm && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="label">คลัง *</label>
                  <select value={txForm.warehouseId} onChange={e => setTxForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">เลือก</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select></div>
                <div><label className="label">สินค้า *</label>
                  <select value={txForm.productId} onChange={e => setTxForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">เลือก</option>{products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} {p.ProductName}</option>)}
                  </select></div>
                <div><label className="label">ประเภท</label>
                  <select value={txForm.txType} onChange={e => setTxForm(p => ({ ...p, txType: e.target.value }))} className="input-field">
                    {TX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select></div>
                <div><label className="label">จำนวน *</label>
                  <input type="number" step="0.001" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" /></div>
                <div><label className="label">เอกสาร</label>
                  <input type="text" value={txForm.refDocNo} onChange={e => setTxForm(p => ({ ...p, refDocNo: e.target.value }))} className="input-field" /></div>
                <div><label className="label">หมายเหตุ</label>
                  <input type="text" value={txForm.remark} onChange={e => setTxForm(p => ({ ...p, remark: e.target.value }))} className="input-field" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveTx} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setShowTxForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="table-header text-left px-3 py-2">วันที่</th>
                <th className="table-header text-left px-3 py-2">ประเภท</th>
                <th className="table-header text-left px-3 py-2">สินค้า</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">คลัง</th>
                <th className="table-header text-right px-3 py-2">จำนวน</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">เอกสาร</th>
              </tr></thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.TxID} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-cell text-xs">{dayjs(t.TxDate).format('DD/MM/YY HH:mm')}</td>
                    <td className={`table-cell font-semibold ${TX_COLOR[t.TxType] || 'text-slate-600'}`}>{TX_TYPES.find(x => x.id === t.TxType)?.label || t.TxType}</td>
                    <td className="table-cell"><div className="font-medium text-slate-900">{t.ProductName}</div><div className="text-xs text-slate-500">{t.ProductCode}</div></td>
                    <td className="table-cell hide-mobile text-slate-600">{t.WarehouseName}</td>
                    <td className="table-cell text-right font-bold">
                      <span className={TX_COLOR[t.TxType]}>{TX_SIGN[t.TxType]}{Math.abs(t.Quantity).toFixed(3)} {t.Unit}</span>
                    </td>
                    <td className="table-cell hide-mobile text-slate-400 text-xs">{t.RefDocNo || t.Remark || '—'}</td>
                  </tr>
                ))}
                {!transactions.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีรายการ</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COUNT TAB */}
      {tab === 'count' && (
        <div className="space-y-4">
          {/* Session list */}
          {!selectedCountId && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0 flex items-center gap-2"><ClipboardList size={18} className="text-blue-500" />รายการนับสต็อก</h3>
                <button onClick={() => setShowCountForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />สร้างรายการนับ</button>
              </div>
              {showCountForm && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">สร้างรายการนับสต็อกใหม่</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="label">ชื่อรายการ *</label>
                      <input value={countForm.countName} onChange={e => setCountForm(p => ({ ...p, countName: e.target.value }))} className="input-field" placeholder="เช่น นับสต็อกเดือนพฤษภาคม 2569" /></div>
                    <div><label className="label">วันที่นับ</label>
                      <input type="date" value={countForm.countDate} onChange={e => setCountForm(p => ({ ...p, countDate: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">หมายเหตุ</label>
                      <input value={countForm.remark} onChange={e => setCountForm(p => ({ ...p, remark: e.target.value }))} className="input-field" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCount} disabled={saving} className="btn-primary text-sm px-4 py-2">{saving ? 'กำลังสร้าง...' : 'สร้างรายการ'}</button>
                    <button onClick={() => setShowCountForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {counts.map(c => {
                  const STATUS = { DRAFT: { l: 'ร่าง', cls: 'bg-slate-100 text-slate-600' }, OPEN: { l: 'กำลังนับ', cls: 'bg-blue-100 text-blue-600' }, CLOSED: { l: 'ปิดแล้ว', cls: 'bg-emerald-100 text-emerald-600' }, CANCELLED: { l: 'ยกเลิก', cls: 'bg-red-100 text-red-500' } };
                  const s = STATUS[c.Status] || STATUS.DRAFT;
                  return (
                    <div key={c.CountID} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer transition-colors"
                      onClick={() => { setSelectedCountId(c.CountID); fetchCountDetail(c.CountID); setItemFilter('all'); }}>
                      <div>
                        <div className="font-semibold text-slate-900">{c.CountName || c.CountCode}</div>
                        <div className="text-xs text-slate-500">{c.CountCode} · {dayjs(c.CountDate).format('DD/MM/YYYY')} · {c.OperatorName}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.ItemCount > 0 && <div className="text-xs text-slate-500 hide-mobile">ปิด {c.ClosedCount}/{c.ItemCount}</div>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.l}</span>
                      </div>
                    </div>
                  );
                })}
                {!counts.length && <div className="text-center py-8 text-slate-400">ยังไม่มีรายการนับสต็อก</div>}
              </div>
            </div>
          )}

          {/* Session detail */}
          {selectedCountId && countDetail && (
            <div className="space-y-4">
              {/* Header */}
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => { setSelectedCountId(null); setCountDetail(null); fetchCounts(); }} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></button>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">{countDetail.CountName || countDetail.CountCode}</div>
                    <div className="text-xs text-slate-500">{countDetail.CountCode} · {dayjs(countDetail.CountDate).format('DD/MM/YYYY')} · {countDetail.OperatorName}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {countDetail.Status !== 'CANCELLED' && countDetail.Status !== 'CLOSED' && (
                      <label className={`btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5 cursor-pointer ${importLoading ? 'opacity-50' : ''}`}>
                        <Upload size={13} />{importLoading ? 'กำลังนำเข้า...' : 'Import Excel'}
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} disabled={importLoading} />
                      </label>
                    )}
                    {selectedItems.size > 0 && (
                      <>
                        <button onClick={() => closeItems(false)} disabled={saving} className="btn-success text-sm px-3 py-1.5"><CheckCircle size={13} />ปิด {selectedItems.size} รายการ</button>
                        <button onClick={reopenItems} disabled={saving} className="btn-secondary text-sm px-3 py-1.5">เปิดใหม่</button>
                      </>
                    )}
                    {countDetail.Status === 'OPEN' && selectedItems.size === 0 && (
                      <button onClick={() => closeItems(true)} disabled={saving} className="btn-secondary text-sm px-3 py-1.5">ปิดทั้งหมด</button>
                    )}
                  </div>
                </div>
                {/* Stats bar */}
                {countDetail.items?.length > 0 && (() => {
                  const total = countDetail.items.length;
                  const closed = countDetail.items.filter(i => i.IsClosed).length;
                  const withEntry = countDetail.items.filter(i => i.EntryCount > 0).length;
                  const mismatch = countDetail.items.filter(i => i.LatestCount != null && Math.abs(i.LatestCount - i.SystemQty) > 0.001).length;
                  return (
                    <div className="flex gap-4 flex-wrap text-xs">
                      {[['ทั้งหมด','all',total,'text-slate-600'],['ยังนับอยู่','open',total-closed,'text-blue-600'],['ปิดแล้ว','closed',closed,'text-emerald-600'],['ไม่ตรง','mismatch',mismatch,'text-red-500']].map(([l,f,n,cls])=>(
                        <button key={f} onClick={() => setItemFilter(f)} className={`px-3 py-1 rounded-full border font-semibold transition-colors ${itemFilter===f?'border-blue-400 bg-blue-50 text-blue-700':'border-slate-200 '+cls}`}>{l}: {n}</button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Items table */}
              <div className="card p-0 overflow-hidden">
                {countDetail.items?.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Upload size={32} className="mx-auto mb-2 opacity-40" />
                    <div className="text-sm">ยังไม่มีสินค้า — กด <b>Import Excel</b> เพื่อนำเข้าข้อมูล</div>
                  </div>
                )}
                {countDetail.items?.length > 0 && (() => {
                  const filtered = countDetail.items.filter(i => {
                    if (itemFilter === 'open') return !i.IsClosed;
                    if (itemFilter === 'closed') return i.IsClosed;
                    if (itemFilter === 'mismatch') return i.LatestCount != null && Math.abs(i.LatestCount - i.SystemQty) > 0.001;
                    return true;
                  });
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 w-8"><input type="checkbox" onChange={e => { if(e.target.checked) setSelectedItems(new Set(filtered.map(i=>i.ItemID))); else setSelectedItems(new Set()); }} checked={selectedItems.size > 0 && filtered.every(i => selectedItems.has(i.ItemID))} /></th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">รหัส / สินค้า</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 hide-mobile">Location</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">ยอดระบบ</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">ยอดนับล่าสุด</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">ส่วนต่าง</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">ครั้งที่นับ</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">สถานะ</th>
                          <th className="px-3 py-2"></th>
                        </tr></thead>
                        <tbody>
                          {filtered.map(item => {
                            const variance = item.LatestCount != null ? item.LatestCount - item.SystemQty : null;
                            const rowBg = item.IsClosed ? 'bg-slate-50' : variance != null && Math.abs(variance) > 0.001 ? 'bg-red-50/30' : '';
                            return (
                              <tr key={item.ItemID} className={`border-b border-slate-100 ${rowBg}`}>
                                <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedItems.has(item.ItemID)} onChange={e => { const s = new Set(selectedItems); e.target.checked ? s.add(item.ItemID) : s.delete(item.ItemID); setSelectedItems(s); }} /></td>
                                <td className="px-3 py-2">
                                  <div className="font-mono text-xs text-blue-600">{item.ItemCode}</div>
                                  <div className="text-slate-800 font-medium text-xs leading-tight">{item.ExternalName}</div>
                                  {item.TypeSKU && <div className="text-xs text-slate-400">{item.TypeSKU}</div>}
                                </td>
                                <td className="px-3 py-2 hide-mobile text-xs text-slate-500 font-mono">{item.Location || '—'}</td>
                                <td className="px-3 py-2 text-right text-slate-700 font-semibold">{parseFloat(item.SystemQty).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:3})}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-900">{item.LatestCount != null ? parseFloat(item.LatestCount).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:3}) : <span className="text-slate-300">—</span>}</td>
                                <td className={`px-3 py-2 text-right font-bold ${variance == null ? 'text-slate-300' : Math.abs(variance) < 0.001 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {variance != null ? (variance >= 0 ? '+' : '') + parseFloat(variance).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:3}) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.EntryCount > 0 ? (
                                    <button onClick={() => loadEntryHistory(item)} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mx-auto">
                                      <History size={11} />{item.EntryCount} ครั้ง
                                    </button>
                                  ) : <span className="text-slate-300 text-xs">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.IsClosed
                                    ? <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">ปิดแล้ว</span>
                                    : <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">นับอยู่</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {!item.IsClosed && countDetail.Status !== 'CANCELLED' && (
                                    <button onClick={() => { setEntryModal({ item }); setEntryForm({ qty: '', note: '' }); }}
                                      className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 whitespace-nowrap">
                                      + ใส่ยอด
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Entry modal */}
          {entryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setEntryModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-slate-900 mb-1">ใส่ยอดนับ</h3>
                <p className="text-xs text-slate-500 mb-4">{entryModal.item.ExternalName}<br />{entryModal.item.ItemCode} · {entryModal.item.Location}</p>
                <div className="space-y-3">
                  <div>
                    <label className="label">ยอดนับ *</label>
                    <input type="number" step="1" value={entryForm.qty} onChange={e => setEntryForm(p => ({ ...p, qty: e.target.value }))} className="input-field text-right text-lg font-bold" placeholder="0" autoFocus />
                    <div className="text-xs text-slate-400 mt-1">ยอดระบบ: {parseFloat(entryModal.item.SystemQty).toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="label">หมายเหตุ</label>
                    <input value={entryForm.note} onChange={e => setEntryForm(p => ({ ...p, note: e.target.value }))} className="input-field" placeholder="(ไม่บังคับ)" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={addEntry} disabled={saving} className="btn-primary flex-1">{saving ? 'กำลังบันทึก...' : 'บันทึกยอด'}</button>
                  <button onClick={() => setEntryModal(null)} className="btn-secondary">ยกเลิก</button>
                </div>
              </div>
            </div>
          )}

          {/* Entry history modal */}
          {entryHistory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setEntryHistory(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">ประวัติการนับ</h3>
                    <p className="text-xs text-slate-500">{entryHistory.item.ExternalName}</p>
                  </div>
                  <button onClick={() => setEntryHistory(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {entryHistory.entries.map((e, i) => (
                    <div key={e.EntryID} className={`flex items-center justify-between p-3 rounded-xl border ${i===0?'border-blue-200 bg-blue-50':'border-slate-100'}`}>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{parseFloat(e.CountedQty).toLocaleString()} <span className="text-xs font-normal text-slate-500">นับครั้งที่ {entryHistory.entries.length - i}</span></div>
                        {e.Note && <div className="text-xs text-slate-500">{e.Note}</div>}
                        <div className="text-xs text-slate-400">{e.CountedByName} · {dayjs(e.CountedAt).format('DD/MM HH:mm')}</div>
                      </div>
                      {i === 0 && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">ล่าสุด</span>}
                    </div>
                  ))}
                  {!entryHistory.entries.length && <div className="text-center text-slate-400 py-4">ยังไม่มีการนับ</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2"><Package size={18} className="text-blue-500" />รายการสินค้า</h3>
            <button onClick={() => { setShowProductForm(true); setEditingProduct(null); setProductForm({ productCode: '', productName: '', unit: 'ตัน', category: '', description: '' }); }}
              className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />เพิ่มสินค้า</button>
          </div>

          {showProductForm && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">รหัสสินค้า *</label>
                  <input value={productForm.productCode} onChange={e => setProductForm(p => ({ ...p, productCode: e.target.value }))} className="input-field" placeholder="เช่น STL-001" disabled={!!editingProduct} /></div>
                <div><label className="label">ชื่อสินค้า *</label>
                  <input value={productForm.productName} onChange={e => setProductForm(p => ({ ...p, productName: e.target.value }))} className="input-field" /></div>
                <div><label className="label">หน่วย</label>
                  <input value={productForm.unit} onChange={e => setProductForm(p => ({ ...p, unit: e.target.value }))} className="input-field" placeholder="ตัน / กก. / ม. / แผ่น" /></div>
                <div><label className="label">หมวดหมู่</label>
                  <input value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="input-field" /></div>
                <div className="col-span-2"><label className="label">รายละเอียด</label>
                  <input value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} className="input-field" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProduct} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setShowProductForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="table-header text-left px-3 py-2">รหัส</th>
                <th className="table-header text-left px-3 py-2">ชื่อสินค้า</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">หน่วย</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">หมวดหมู่</th>
                <th className="table-header text-center px-3 py-2">สถานะ</th>
                <th className="table-header px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.ProductID} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-cell font-mono text-blue-600 font-semibold">{p.ProductCode}</td>
                    <td className="table-cell font-medium text-slate-900">{p.ProductName}</td>
                    <td className="table-cell hide-mobile text-slate-600">{p.Unit}</td>
                    <td className="table-cell hide-mobile text-slate-500">{p.Category || '—'}</td>
                    <td className="table-cell text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.IsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {p.IsActive ? 'ใช้งาน' : 'ปิด'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => { setEditingProduct(p); setProductForm({ productCode: p.ProductCode, productName: p.ProductName, unit: p.Unit, category: p.Category || '', description: p.Description || '', isActive: p.IsActive }); setShowProductForm(true); }}
                        className="text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีสินค้า</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
