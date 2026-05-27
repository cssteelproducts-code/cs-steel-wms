import { useState, useEffect } from 'react';
import { Boxes, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Package, Plus, RefreshCw, CheckCircle, X, Edit2 } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [filterWh, setFilterWh] = useState('');

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ productCode: '', productName: '', unit: 'ตัน', category: '', description: '' });

  // Transaction form
  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ warehouseId: '', productId: '', txType: 'IN', quantity: '', refDocNo: '', remark: '' });

  // Count form
  const [showCountForm, setShowCountForm] = useState(false);
  const [countForm, setCountForm] = useState({ warehouseId: '', countDate: new Date().toISOString().slice(0, 10), remark: '' });

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
    try { const r = await api.get(`/stock/balance${filterWh ? '?warehouseId=' + filterWh : ''}`); setBalance(r.data.data || []); } catch {}
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
    try { const r = await api.get(`/stock/count${filterWh ? '?warehouseId=' + filterWh : ''}`); setCounts(r.data.data || []); } catch {}
    finally { setLoading(false); }
  };
  const fetchCountDetail = async (id) => {
    try { const r = await api.get(`/stock/count/${id}`); setCountDetail(r.data.data); } catch {}
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
    if (!countForm.warehouseId) { toast.error('กรุณาเลือกคลังสินค้า'); return; }
    setSaving(true);
    try {
      const r = await api.post('/stock/count', countForm);
      toast.success(`สร้างรายการนับสต็อก ${r.data.countCode}`);
      setShowCountForm(false);
      fetchCounts();
      fetchCountDetail(r.data.countId);
    } catch { toast.error('สร้างไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const updateActualQty = async (itemId, val) => {
    if (!countDetail) return;
    const updated = countDetail.items.map(i => i.ItemID === itemId ? { ...i, ActualQty: val === '' ? null : parseFloat(val) } : i);
    setCountDetail(prev => ({ ...prev, items: updated }));
  };

  const saveCountItems = async () => {
    setSaving(true);
    try {
      const items = countDetail.items.filter(i => i.ActualQty !== null).map(i => ({ itemId: i.ItemID, actualQty: i.ActualQty, remark: i.Remark }));
      await api.put(`/stock/count/${countDetail.CountID}/items`, { items });
      toast.success('บันทึกยอดนับแล้ว');
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const confirmCount = async () => {
    if (!window.confirm('ยืนยันการนับสต็อก? ระบบจะปรับยอดสต็อกทันที')) return;
    setSaving(true);
    try {
      await api.put(`/stock/count/${countDetail.CountID}/confirm`);
      toast.success('ยืนยันการนับสต็อกสำเร็จ');
      setCountDetail(null); fetchCounts(); fetchBalance();
    } catch (err) { toast.error(err.response?.data?.message || 'ยืนยันไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const TX_COLOR = { IN: 'text-emerald-600', OUT: 'text-red-500', ADJUST: 'text-amber-600', COUNT: 'text-blue-500' };
  const TX_SIGN = { IN: '+', OUT: '-', ADJUST: '±', COUNT: '±' };

  return (
    <div className="space-y-4">
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
          {!countDetail ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0 flex items-center gap-2"><ClipboardList size={18} className="text-blue-500" />การนับสต็อก</h3>
                <button onClick={() => setShowCountForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />สร้างรายการนับ</button>
              </div>

              {showCountForm && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">สร้างรายการนับสต็อกใหม่</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">คลังสินค้า *</label>
                      <select value={countForm.warehouseId} onChange={e => setCountForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                        <option value="">เลือกคลัง</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                      </select></div>
                    <div><label className="label">วันที่นับ</label>
                      <input type="date" value={countForm.countDate} onChange={e => setCountForm(p => ({ ...p, countDate: e.target.value }))} className="input-field" /></div>
                    <div className="col-span-2"><label className="label">หมายเหตุ</label>
                      <input type="text" value={countForm.remark} onChange={e => setCountForm(p => ({ ...p, remark: e.target.value }))} className="input-field" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCount} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                      {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {saving ? 'กำลังสร้าง...' : 'สร้างรายการ'}
                    </button>
                    <button onClick={() => setShowCountForm(false)} className="btn-secondary text-sm px-4 py-2">ยกเลิก</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {counts.map(c => (
                  <div key={c.CountID} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer transition-colors"
                    onClick={() => fetchCountDetail(c.CountID)}>
                    <div>
                      <div className="font-semibold text-slate-900">{c.CountCode}</div>
                      <div className="text-xs text-slate-500">{c.WarehouseName} · {dayjs(c.CountDate).format('DD/MM/YYYY')} · {c.OperatorName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hide-mobile">
                        <div className="text-xs text-slate-500">{c.FilledCount}/{c.ItemCount} รายการ</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.Status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-600' : c.Status === 'CANCELLED' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'}`}>
                        {c.Status === 'CONFIRMED' ? 'ยืนยันแล้ว' : c.Status === 'CANCELLED' ? 'ยกเลิก' : 'ร่าง'}
                      </span>
                    </div>
                  </div>
                ))}
                {!counts.length && <div className="text-center py-8 text-slate-400">ยังไม่มีรายการนับสต็อก</div>}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="card-header mb-0">{countDetail.CountCode}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{countDetail.WarehouseName} · {dayjs(countDetail.CountDate).format('DD/MM/YYYY')}</div>
                </div>
                <div className="flex gap-2">
                  {countDetail.Status === 'DRAFT' && (
                    <>
                      <button onClick={saveCountItems} disabled={saving} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
                        {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {saving ? 'กำลังบันทึก...' : 'บันทึกยอดนับ'}
                      </button>
                      <button onClick={confirmCount} disabled={saving} className="btn-success text-sm px-3 py-1.5 flex items-center gap-1.5">
                        {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={13} />}
                        {saving ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                      </button>
                    </>
                  )}
                  <button onClick={() => setCountDetail(null)} className="btn-secondary text-sm px-3 py-1.5"><X size={13} />ปิด</button>
                </div>
              </div>

              {countDetail.Status === 'CONFIRMED' && (
                <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle size={15} />รายการนี้ยืนยันแล้ว ยอดสต็อกถูกปรับแล้ว
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">รหัส</th>
                    <th className="table-header text-left px-3 py-2">สินค้า</th>
                    <th className="table-header text-right px-3 py-2">ยอดระบบ</th>
                    <th className="table-header text-right px-3 py-2">ยอดนับจริง</th>
                    <th className="table-header text-right px-3 py-2">ส่วนต่าง</th>
                  </tr></thead>
                  <tbody>
                    {countDetail.items?.map(item => {
                      const variance = item.ActualQty !== null ? item.ActualQty - item.SystemQty : null;
                      return (
                        <tr key={item.ItemID} className="border-b border-slate-100">
                          <td className="table-cell font-mono text-xs text-blue-600">{item.ProductCode}</td>
                          <td className="table-cell text-slate-900">{item.ProductName}</td>
                          <td className="table-cell text-right text-slate-600">{parseFloat(item.SystemQty).toFixed(3)} {item.Unit}</td>
                          <td className="table-cell text-right">
                            {countDetail.Status === 'DRAFT' ? (
                              <input type="number" step="0.001"
                                value={item.ActualQty === null ? '' : item.ActualQty}
                                onChange={e => updateActualQty(item.ItemID, e.target.value)}
                                className="w-24 bg-white border border-slate-300 text-slate-900 text-right px-2 py-1 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            ) : (
                              <span>{item.ActualQty !== null ? parseFloat(item.ActualQty).toFixed(3) : '—'} {item.Unit}</span>
                            )}
                          </td>
                          <td className={`table-cell text-right font-bold ${variance === null ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {variance !== null ? (variance > 0 ? '+' : '') + variance.toFixed(3) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
