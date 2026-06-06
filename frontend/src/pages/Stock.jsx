import { useState, useEffect } from 'react';
import { Boxes, ArrowDownToLine, ClipboardList, Package, Plus, RefreshCw, CheckCircle, X, Edit2, Upload, ChevronLeft, History } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useLang } from '../context/LanguageContext';

const TX_KEYS = {
  IN:     { id: 'IN',     labelKey: 'stock.txIn',     color: 'text-emerald-600', sign: '+' },
  OUT:    { id: 'OUT',    labelKey: 'stock.txOut',    color: 'text-red-500',     sign: '-' },
  ADJUST: { id: 'ADJUST', labelKey: 'stock.txAdjust', color: 'text-amber-600',  sign: '±' },
  COUNT:  { id: 'COUNT',  labelKey: 'stock.txAdjust', color: 'text-blue-500',   sign: '±' },
};

export default function Stock() {
  const { t } = useLang();
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

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ productCode: '', productName: '', unit: 'ตัน', category: '', description: '' });

  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ warehouseId: '', productId: '', txType: 'IN', quantity: '', refDocNo: '', remark: '' });

  const [showCountForm, setShowCountForm] = useState(false);
  const [countForm, setCountForm] = useState({ countName: '', countDate: new Date(Date.now()+7*3600000).toISOString().slice(0,10), remark: '' });
  const [selectedCountId, setSelectedCountId] = useState(null);
  const [itemFilter, setItemFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [entryModal, setEntryModal] = useState(null);
  const [entryForm, setEntryForm] = useState({ qty: '', note: '' });
  const [entryHistory, setEntryHistory] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const TABS = [
    { id: 'balance',      icon: Boxes,          labelKey: 'stock.tabBalance' },
    { id: 'transactions', icon: ArrowDownToLine, labelKey: 'stock.tabTransactions' },
    { id: 'count',        icon: ClipboardList,   labelKey: 'stock.tabCount' },
    { id: 'products',     icon: Package,         labelKey: 'stock.tabProducts' },
  ];

  const TX_TYPES = [
    { id: 'IN',     label: t('stock.txIn') },
    { id: 'OUT',    label: t('stock.txOut') },
    { id: 'ADJUST', label: t('stock.txAdjust') },
  ];

  const COUNT_STATUS = {
    DRAFT: { l: t('stockCount.statusDraft'), cls: 'bg-slate-100 text-slate-600' },
    OPEN: { l: t('stockCount.statusOpen'), cls: 'bg-blue-100 text-blue-600' },
    CLOSED: { l: t('stockCount.statusClosed'), cls: 'bg-emerald-100 text-emerald-600' },
    CANCELLED: { l: t('status.cancelled'), cls: 'bg-red-100 text-red-500' }
  };

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
      toast.success(t('common.save'));
      setShowProductForm(false); setEditingProduct(null);
      fetchProducts();
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
  };

  const saveTx = async () => {
    if (!txForm.warehouseId || !txForm.productId || !txForm.quantity) { toast.error(t('common.noData')); return; }
    setSaving(true);
    try {
      await api.post('/stock/transaction', txForm);
      toast.success(t('common.save'));
      setShowTxForm(false);
      setTxForm({ warehouseId: '', productId: '', txType: 'IN', quantity: '', refDocNo: '', remark: '' });
      fetchBalance(); fetchTransactions();
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
  };

  const createCount = async () => {
    if (!countForm.countName) { toast.error(t('stock.countNameLabel')); return; }
    setSaving(true);
    try {
      const r = await api.post('/stock/count', countForm);
      toast.success(t('common.save'));
      setShowCountForm(false);
      fetchCounts();
      setSelectedCountId(r.data.countId);
      fetchCountDetail(r.data.countId);
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
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
    } catch (err) { toast.error(err.response?.data?.message || t('common.noData')); }
    setImportLoading(false);
    e.target.value = '';
  };

  const addEntry = async () => {
    if (!entryModal || !entryForm.qty) { toast.error(t('common.noData')); return; }
    setSaving(true);
    try {
      await api.post(`/stock/count/${selectedCountId}/entries`, { itemId: entryModal.item.ItemID, countedQty: parseFloat(entryForm.qty), note: entryForm.note });
      toast.success(t('common.save'));
      setEntryModal(null);
      setEntryForm({ qty: '', note: '' });
      fetchCountDetail(selectedCountId);
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
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
      toast.success(t('common.save'));
      setSelectedItems(new Set());
      fetchCountDetail(selectedCountId);
      fetchCounts();
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
  };

  const reopenItems = async () => {
    setSaving(true);
    try {
      await api.put(`/stock/count/${selectedCountId}/reopen-items`, { itemIds: [...selectedItems] });
      toast.success(t('common.save'));
      setSelectedItems(new Set());
      fetchCountDetail(selectedCountId);
    } catch { toast.error(t('common.noData')); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <Boxes size={20} className="text-blue-500 flex-shrink-0" />
            {t('stock.title')}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={fetchBalance} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tb.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <tb.icon size={14} />{t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab !== 'products' && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">{t('stock.warehouseFilter')}</label>
          <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="input-field w-48">
            <option value="">{t('stock.allWarehouses')}</option>
            {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
          </select>
        </div>
      )}

      {/* BALANCE TAB */}
      {tab === 'balance' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2"><Boxes size={18} className="text-blue-500" />{t('stock.balanceTitle')}</h3>
            <div className="flex gap-2">
              <button onClick={() => { fetchProducts(); setShowTxForm(true); }} className="btn-primary text-sm px-3 py-1.5">
                <Plus size={13} />{t('stock.recordTx')}
              </button>
              <button onClick={fetchBalance} className="text-blue-500 hover:text-blue-600 text-sm"><RefreshCw size={14} /></button>
            </div>
          </div>
          {loading ? <div className="text-center py-8 text-slate-500">{t('common.loading')}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">{t('stock.colProductCode')}</th>
                    <th className="table-header text-left px-3 py-2">{t('stock.colProductName')}</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.colCategory')}</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.colWarehouse')}</th>
                    <th className="table-header text-right px-3 py-2">{t('stock.colBalance')}</th>
                    <th className="table-header text-right px-3 py-2 hide-mobile">{t('stock.colUpdated')}</th>
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
                  {!balance.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('stock.noBalance')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {showTxForm && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{t('stock.txTitle')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('stock.warehouseLabel')}</label>
                  <select value={txForm.warehouseId} onChange={e => setTxForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">{t('stock.selectWarehouse')}</option>
                    {warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('stock.productLabel')}</label>
                  <select value={txForm.productId} onChange={e => setTxForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">{t('stock.selectProduct')}</option>
                    {products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} - {p.ProductName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('stock.typeLabel')}</label>
                  <select value={txForm.txType} onChange={e => setTxForm(p => ({ ...p, txType: e.target.value }))} className="input-field">
                    {TX_TYPES.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('stock.quantityLabel')}</label>
                  <input type="number" step="0.001" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" placeholder="0.000" />
                </div>
                <div>
                  <label className="label">{t('stock.refDoc')}</label>
                  <input type="text" value={txForm.refDocNo} onChange={e => setTxForm(p => ({ ...p, refDocNo: e.target.value }))} className="input-field" placeholder={t('stock.refDocPH')} />
                </div>
                <div>
                  <label className="label">{t('common.note')}</label>
                  <input type="text" value={txForm.remark} onChange={e => setTxForm(p => ({ ...p, remark: e.target.value }))} className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveTx} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setShowTxForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab === 'transactions' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0 flex items-center gap-2"><ArrowDownToLine size={18} className="text-blue-500" />{t('stock.txHistoryTitle')}</h3>
            <div className="flex gap-2">
              <button onClick={() => { fetchProducts(); setShowTxForm(true); }} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />{t('stock.recordNew')}</button>
              <button onClick={fetchTransactions} className="text-blue-500 hover:text-blue-600 text-sm"><RefreshCw size={14} /></button>
            </div>
          </div>
          {showTxForm && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="label">{t('stock.warehouseLabel')}</label>
                  <select value={txForm.warehouseId} onChange={e => setTxForm(p => ({ ...p, warehouseId: e.target.value }))} className="input-field">
                    <option value="">{t('common.select')}</option>{warehouses.map(w => <option key={w.WarehouseID} value={w.WarehouseID}>{w.WarehouseName}</option>)}
                  </select></div>
                <div><label className="label">{t('stock.productLabel')}</label>
                  <select value={txForm.productId} onChange={e => setTxForm(p => ({ ...p, productId: e.target.value }))} className="input-field">
                    <option value="">{t('common.select')}</option>{products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.ProductCode} {p.ProductName}</option>)}
                  </select></div>
                <div><label className="label">{t('stock.typeLabel')}</label>
                  <select value={txForm.txType} onChange={e => setTxForm(p => ({ ...p, txType: e.target.value }))} className="input-field">
                    {TX_TYPES.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                  </select></div>
                <div><label className="label">{t('stock.quantityLabel')}</label>
                  <input type="number" step="0.001" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" /></div>
                <div><label className="label">{t('stock.refDoc')}</label>
                  <input type="text" value={txForm.refDocNo} onChange={e => setTxForm(p => ({ ...p, refDocNo: e.target.value }))} className="input-field" /></div>
                <div><label className="label">{t('common.note')}</label>
                  <input type="text" value={txForm.remark} onChange={e => setTxForm(p => ({ ...p, remark: e.target.value }))} className="input-field" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveTx} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setShowTxForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="table-header text-left px-3 py-2">{t('common.date')}</th>
                <th className="table-header text-left px-3 py-2">{t('stock.typeLabel')}</th>
                <th className="table-header text-left px-3 py-2">{t('stock.colProductName')}</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.colWarehouse')}</th>
                <th className="table-header text-right px-3 py-2">{t('stock.quantityLabel')}</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.refDoc')}</th>
              </tr></thead>
              <tbody>
                {transactions.map(tx => {
                  const cfg = TX_KEYS[tx.TxType] || TX_KEYS.ADJUST;
                  return (
                    <tr key={tx.TxID} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="table-cell text-xs">{dayjs(tx.TxDate).format('DD/MM/YY HH:mm')}</td>
                      <td className={`table-cell font-semibold ${cfg.color}`}>{TX_TYPES.find(x => x.id === tx.TxType)?.label || tx.TxType}</td>
                      <td className="table-cell"><div className="font-medium text-slate-900">{tx.ProductName}</div><div className="text-xs text-slate-500">{tx.ProductCode}</div></td>
                      <td className="table-cell hide-mobile text-slate-600">{tx.WarehouseName}</td>
                      <td className="table-cell text-right font-bold">
                        <span className={cfg.color}>{cfg.sign}{Math.abs(tx.Quantity).toFixed(3)} {tx.Unit}</span>
                      </td>
                      <td className="table-cell hide-mobile text-slate-400 text-xs">{tx.RefDocNo || tx.Remark || '—'}</td>
                    </tr>
                  );
                })}
                {!transactions.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('stock.noTransactions')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COUNT TAB */}
      {tab === 'count' && (
        <div className="space-y-4">
          {!selectedCountId && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0 flex items-center gap-2"><ClipboardList size={18} className="text-blue-500" />{t('stock.countListTitle')}</h3>
                <button onClick={() => setShowCountForm(true)} className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />{t('stock.createCount')}</button>
              </div>
              {showCountForm && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">{t('stock.createCountTitle')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="label">{t('stock.countNameLabel')}</label>
                      <input value={countForm.countName} onChange={e => setCountForm(p => ({ ...p, countName: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">{t('stock.countDateLabel')}</label>
                      <input type="date" value={countForm.countDate} onChange={e => setCountForm(p => ({ ...p, countDate: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">{t('common.note')}</label>
                      <input value={countForm.remark} onChange={e => setCountForm(p => ({ ...p, remark: e.target.value }))} className="input-field" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCount} disabled={saving} className="btn-primary text-sm px-4 py-2">{saving ? t('stock.countCreating') : t('stock.createCountBtn')}</button>
                    <button onClick={() => setShowCountForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {counts.map(c => {
                  const s = COUNT_STATUS[c.Status] || COUNT_STATUS.DRAFT;
                  return (
                    <div key={c.CountID} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer transition-colors"
                      onClick={() => { setSelectedCountId(c.CountID); fetchCountDetail(c.CountID); setItemFilter('all'); }}>
                      <div>
                        <div className="font-semibold text-slate-900">{c.CountName || c.CountCode}</div>
                        <div className="text-xs text-slate-500">{c.CountCode} · {dayjs(c.CountDate).format('DD/MM/YYYY')} · {c.OperatorName}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.ItemCount > 0 && <div className="text-xs text-slate-500 hide-mobile">{c.ClosedCount}/{c.ItemCount}</div>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.l}</span>
                      </div>
                    </div>
                  );
                })}
                {!counts.length && <div className="text-center py-8 text-slate-400">{t('stock.noCountSessions')}</div>}
              </div>
            </div>
          )}

          {selectedCountId && countDetail && (
            <div className="space-y-4">
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
                        <Upload size={13} />{importLoading ? t('stockCount.importing') : t('stockCount.importExcel')}
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} disabled={importLoading} />
                      </label>
                    )}
                    {selectedItems.size > 0 && (
                      <>
                        <button onClick={() => closeItems(false)} disabled={saving} className="btn-success text-sm px-3 py-1.5"><CheckCircle size={13} />{t('stockCount.closeSelected').replace('{n}', selectedItems.size)}</button>
                        <button onClick={reopenItems} disabled={saving} className="btn-secondary text-sm px-3 py-1.5">{t('stockCount.reopen')}</button>
                      </>
                    )}
                    {countDetail.Status === 'OPEN' && selectedItems.size === 0 && (
                      <button onClick={() => closeItems(true)} disabled={saving} className="btn-secondary text-sm px-3 py-1.5">{t('stockCount.closeAll')}</button>
                    )}
                  </div>
                </div>
                {countDetail.items?.length > 0 && (() => {
                  const total = countDetail.items.length;
                  const closed = countDetail.items.filter(i => i.IsClosed).length;
                  const mismatch = countDetail.items.filter(i => i.LatestCount != null && Math.abs(i.LatestCount - i.SystemQty) > 0.001).length;
                  return (
                    <div className="flex gap-4 flex-wrap text-xs">
                      {[
                        [t('stockCount.all'),'all',total,'text-slate-600'],
                        [t('stockCount.open'),'open',total-closed,'text-blue-600'],
                        [t('stockCount.closed'),'closed',closed,'text-emerald-600'],
                        [t('stockCount.mismatch'),'mismatch',mismatch,'text-red-500']
                      ].map(([l,f,n,cls])=>(
                        <button key={f} onClick={() => setItemFilter(f)} className={`px-3 py-1 rounded-full border font-semibold transition-colors ${itemFilter===f?'border-blue-400 bg-blue-50 text-blue-700':'border-slate-200 '+cls}`}>{l}: {n}</button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="card p-0 overflow-hidden">
                {countDetail.items?.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Upload size={32} className="mx-auto mb-2 opacity-40" />
                    <div className="text-sm">{t('stock.noCountSessions')}</div>
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
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('stockCount.itemCode')} / {t('stockCount.itemName')}</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 hide-mobile">{t('stockCount.location')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('stockCount.systemQty')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('stockCount.counted')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('stockCount.diff')}</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500"></th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{t('stockCount.lockStatus')}</th>
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
                                <td className="px-3 py-2 text-right text-slate-700 font-semibold">{parseFloat(item.SystemQty).toLocaleString(undefined,{maximumFractionDigits:3})}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-900">{item.LatestCount != null ? parseFloat(item.LatestCount).toLocaleString(undefined,{maximumFractionDigits:3}) : <span className="text-slate-300">—</span>}</td>
                                <td className={`px-3 py-2 text-right font-bold ${variance == null ? 'text-slate-300' : Math.abs(variance) < 0.001 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {variance != null ? (variance >= 0 ? '+' : '') + parseFloat(variance).toLocaleString(undefined,{maximumFractionDigits:3}) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.EntryCount > 0 ? (
                                    <button onClick={() => loadEntryHistory(item)} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mx-auto">
                                      <History size={11} />{item.EntryCount}
                                    </button>
                                  ) : <span className="text-slate-300 text-xs">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.IsClosed
                                    ? <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">{t('stockCount.statusClosed')}</span>
                                    : <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{t('stockCount.open')}</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {!item.IsClosed && countDetail.Status !== 'CANCELLED' && (
                                    <button onClick={() => { setEntryModal({ item }); setEntryForm({ qty: '', note: '' }); }}
                                      className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 whitespace-nowrap">
                                      + {t('stockCount.enterQty')}
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

          {entryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEntryModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-slate-900 mb-1">{t('stockCount.enterQty')}</h3>
                <p className="text-xs text-slate-500 mb-4">{entryModal.item.ExternalName}<br />{entryModal.item.ItemCode} · {entryModal.item.Location}</p>
                <div className="space-y-3">
                  <div>
                    <label className="label">{t('stockCount.counted')}</label>
                    <input type="number" step="1" value={entryForm.qty} onChange={e => setEntryForm(p => ({ ...p, qty: e.target.value }))} className="input-field text-right text-lg font-bold" placeholder="0" autoFocus />
                    <div className="text-xs text-slate-400 mt-1">{t('stockCount.systemQty')}: {parseFloat(entryModal.item.SystemQty).toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="label">{t('common.note')}</label>
                    <input value={entryForm.note} onChange={e => setEntryForm(p => ({ ...p, note: e.target.value }))} className="input-field" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={addEntry} disabled={saving} className="btn-primary flex-1">{saving ? t('common.saving') : t('common.save')}</button>
                  <button onClick={() => setEntryModal(null)} className="btn-secondary">{t('common.cancel')}</button>
                </div>
              </div>
            </div>
          )}

          {entryHistory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEntryHistory(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{t('dash.history')}</h3>
                    <p className="text-xs text-slate-500">{entryHistory.item.ExternalName}</p>
                  </div>
                  <button onClick={() => setEntryHistory(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {entryHistory.entries.map((e, i) => (
                    <div key={e.EntryID} className={`flex items-center justify-between p-3 rounded-xl border ${i===0?'border-blue-200 bg-blue-50':'border-slate-100'}`}>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{parseFloat(e.CountedQty).toLocaleString()} <span className="text-xs font-normal text-slate-500">#{entryHistory.entries.length - i}</span></div>
                        {e.Note && <div className="text-xs text-slate-500">{e.Note}</div>}
                        <div className="text-xs text-slate-400">{e.CountedByName} · {dayjs(e.CountedAt).format('DD/MM HH:mm')}</div>
                      </div>
                      {i === 0 && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{t('common.justArrived')}</span>}
                    </div>
                  ))}
                  {!entryHistory.entries.length && <div className="text-center text-slate-400 py-4">{t('common.noData')}</div>}
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
            <h3 className="card-header mb-0 flex items-center gap-2"><Package size={18} className="text-blue-500" />{t('stock.productTitle')}</h3>
            <button onClick={() => { setShowProductForm(true); setEditingProduct(null); setProductForm({ productCode: '', productName: '', unit: 'ตัน', category: '', description: '' }); }}
              className="btn-primary text-sm px-3 py-1.5"><Plus size={13} />{t('stock.addProduct')}</button>
          </div>

          {showProductForm && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{editingProduct ? t('stock.editProductTitle') : t('stock.addProductTitle')}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('stock.productCode')}</label>
                  <input value={productForm.productCode} onChange={e => setProductForm(p => ({ ...p, productCode: e.target.value }))} className="input-field" disabled={!!editingProduct} /></div>
                <div><label className="label">{t('stock.productName')}</label>
                  <input value={productForm.productName} onChange={e => setProductForm(p => ({ ...p, productName: e.target.value }))} className="input-field" /></div>
                <div><label className="label">{t('stock.productUnit')}</label>
                  <input value={productForm.unit} onChange={e => setProductForm(p => ({ ...p, unit: e.target.value }))} className="input-field" /></div>
                <div><label className="label">{t('stock.productCategory')}</label>
                  <input value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="input-field" /></div>
                <div className="col-span-2"><label className="label">{t('stock.productDesc')}</label>
                  <input value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} className="input-field" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProduct} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setShowProductForm(false)} className="btn-secondary text-sm px-4 py-2">{t('common.cancel')}</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="table-header text-left px-3 py-2">{t('stock.productCode')}</th>
                <th className="table-header text-left px-3 py-2">{t('stock.productName')}</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.productUnit')}</th>
                <th className="table-header text-left px-3 py-2 hide-mobile">{t('stock.productCategory')}</th>
                <th className="table-header text-center px-3 py-2">{t('common.status')}</th>
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
                        {p.IsActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => { setEditingProduct(p); setProductForm({ productCode: p.ProductCode, productName: p.ProductName, unit: p.Unit, category: p.Category || '', description: p.Description || '', isActive: p.IsActive }); setShowProductForm(true); }}
                        className="text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('stock.noProducts')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
