import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Upload, Download, Lock, Unlock, RefreshCw, RotateCcw,
  ChevronLeft, CheckCircle2, AlertTriangle, Clock, FileText,
  Search, X, Save, Trash2
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import dayjs from 'dayjs';
import '../utils/helpers';

const STATUS_LABEL = {
  DRAFT:     { label: 'ร่าง',         cls: 'bg-slate-100 text-slate-600' },
  OPEN:      { label: 'เปิดรอบ',      cls: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'เสร็จสิ้น',    cls: 'bg-emerald-100 text-emerald-700' },
};
const StatusBadge = ({ status }) => {
  const s = STATUS_LABEL[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.cls}`}>{s.label}</span>;
};
const DiffBadge = ({ sys, counted }) => {
  if (counted == null || counted === 0 && sys > 0) return <span className="text-slate-300 text-xs">รอนับ</span>;
  const diff = Number(counted) - Number(sys);
  if (Math.abs(diff) < 0.001) return <span className="text-emerald-600 text-xs font-bold">✓ ตรงกัน</span>;
  return <span className={`text-xs font-bold ${diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</span>;
};

export default function StockCount() {
  const { hasPermission } = useAuth();
  const canOffice = hasPermission('STOCKCOUNT_OFFICE');
  const canField  = hasPermission('STOCKCOUNT_FIELD');
  const defaultTab = canOffice ? 'office' : 'field';
  const [tab, setTab] = useState(defaultTab);

  // ── Office state ──
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [detailTab, setDetailTab] = useState('items');
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null); // { session, items }
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ countDate: dayjs().format('YYYY-MM-DD'), notes: '' });
  const [search, setSearch] = useState('');
  const [filterWH, setFilterWH] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [filterGname, setFilterGname] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterThick, setFilterThick] = useState('');
  const [entriesModal, setEntriesModal] = useState(null); // item object
  const [entries, setEntries] = useState([]);

  // ── Field state ──
  const [fieldSessions, setFieldSessions] = useState([]);
  const [fieldSessionId, setFieldSessionId] = useState('');
  const [fieldData, setFieldData] = useState(null);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [countInputs, setCountInputs] = useState({});
  const [countNotes, setCountNotes] = useState({});
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all'); // 'all' | 'recount' | 'pending' | 'done'
  const [submitting, setSubmitting] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showSelected, setShowSelected] = useState(false);

  // ── Fetch ─────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock-count');
      setSessions(res.data.data || []);
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setLoading(false); }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/stock-count/${id}`);
      setSessionData(res.data.data);
    } catch { toast.error('โหลดรายละเอียดล้มเหลว'); }
    finally { setDetailLoading(false); }
  }, []);

  const fetchFieldSessions = useCallback(async () => {
    try {
      const res = await api.get('/stock-count');
      setFieldSessions((res.data.data || []).filter(s => s.Status === 'OPEN'));
    } catch {}
  }, []);

  const fetchFieldData = useCallback(async (id) => {
    if (!id) return;
    setFieldLoading(true);
    try {
      const res = await api.get(`/stock-count/${id}`);
      setFieldData(res.data.data);
      setCountInputs({});
      setCountNotes({});
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setFieldLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'office') fetchSessions(); }, [tab, fetchSessions]);
  useEffect(() => { if (tab === 'field') fetchFieldSessions(); }, [tab, fetchFieldSessions]);
  useEffect(() => { if (fieldSessionId) fetchFieldData(fieldSessionId); }, [fieldSessionId, fetchFieldData]);

  // ── Office actions ────────────────────────────────────

  const openDetail = (session) => {
    setSelectedSession(session);
    setView('detail');
    setDetailTab('items');
    setSearch('');
    setSelectedIds(new Set());
    setShowSelected(false);
    fetchDetail(session.SessionID);
  };

  const handleCreate = async () => {
    if (!createForm.countDate) return toast.error('กรุณาระบุวันที่');
    setSaving(true);
    try {
      const sessionName = dayjs(createForm.countDate).format('D MMMM BBBB');
      const res = await api.post('/stock-count', { sessionName, notes: createForm.notes });
      if (res.data.success) {
        toast.success(res.data.message);
        setCreateModal(false);
        setCreateForm({ countDate: dayjs().format('YYYY-MM-DD'), notes: '' });
        await fetchSessions();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status) => {
    if (status === 'OPEN' && selectedIds.size > 0 && selectedIds.size < items.length) {
      if (!confirm(`เปิดรอบเฉพาะ ${selectedIds.size} รายการที่เลือก (จากทั้งหมด ${items.length} รายการ)\nรายการที่ไม่ได้เลือกจะถูกลบออกจากรอบนี้ ยืนยันไหม?`)) return;
      setSaving(true);
      try {
        await api.post(`/stock-count/${selectedSession.SessionID}/trim-items`, { keepIds: [...selectedIds] });
      } catch (err) {
        toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        setSaving(false);
        return;
      }
    } else {
      setSaving(true);
    }
    try {
      const res = await api.put(`/stock-count/${selectedSession.SessionID}/status`, { status });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelectedIds(new Set());
        setShowSelected(false);
        await Promise.all([fetchSessions(), fetchDetail(selectedSession.SessionID)]);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    e.target.value = '';
    setImporting(true);
    try {
      const res = await api.post(`/stock-count/${selectedSession.SessionID}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelectedIds(new Set());
        setShowSelected(false);
        // Backend processes in background — poll fetchDetail every 3s until items load (max 60s)
        const sid = selectedSession.SessionID;
        let attempts = 0;
        const poll = async () => {
          try {
            const detail = await api.get(`/stock-count/${sid}`);
            const count = detail?.data?.data?.items?.length ?? 0;
            await fetchDetail(sid);
            if (count === 0 && ++attempts < 80) setTimeout(poll, 3000);
          } catch { /* ignore poll errors */ }
        };
        setTimeout(poll, 3000);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'นำเข้าล้มเหลว'); }
    finally { setImporting(false); }
  };

  const handleLock = async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, IsLocked: 1, NeedsRecount: 0 } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession.SessionID}/items/${itemId}/lock`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession.SessionID); }
  };

  const handleUnlock = async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, IsLocked: 0, LockedAt: null, LockedBy: null } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession.SessionID}/items/${itemId}/unlock`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession.SessionID); }
  };

  const handleRecount = async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, NeedsRecount: 1, IsLocked: 0, TotalCounted: 0, EntryCount: 0 } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession.SessionID}/items/${itemId}/recount`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession.SessionID); }
  };

  const handleLockCorrect = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/stock-count/${selectedSession.SessionID}/lock-correct`);
      if (res.data.success) { toast.success(res.data.message); fetchDetail(selectedSession.SessionID); }
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleRecountDiff = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/stock-count/${selectedSession.SessionID}/recount-diff`);
      if (res.data.success) { toast.success(res.data.message); fetchDetail(selectedSession.SessionID); }
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (session) => {
    if (!confirm(`ลบรอบ "${session.SessionName}" ?`)) return;
    try {
      const res = await api.delete(`/stock-count/${session.SessionID}`);
      if (res.data.success) { toast.success(res.data.message); fetchSessions(); }
    } catch (err) { toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
  };

  const handleReport = () => {
    window.open(`${api.defaults.baseURL}/stock-count/${selectedSession.SessionID}/report`, '_blank');
  };

  const openEntries = async (item) => {
    setEntriesModal(item);
    try {
      const res = await api.get(`/stock-count/${selectedSession.SessionID}/items/${item.ItemID}/entries`);
      setEntries(res.data.data || []);
    } catch { setEntries([]); }
  };

  // ── Field actions ─────────────────────────────────────

  const handleSubmitCount = async (itemId) => {
    const qty = countInputs[itemId];
    if (qty === '' || qty == null) return toast.error('กรุณาระบุจำนวน');
    const parsedQty = parseFloat(qty);
    setSubmitting(p => ({ ...p, [itemId]: true }));
    setCountInputs(p => ({ ...p, [itemId]: '' }));
    setFieldData(prev => ({
      ...prev,
      items: prev.items.map(i => i.ItemID !== itemId ? i : {
        ...i, TotalCounted: Number(i.TotalCounted) + parsedQty, EntryCount: (i.EntryCount || 0) + 1, NeedsRecount: 0
      })
    }));
    try {
      const res = await api.post(`/stock-count/${fieldSessionId}/count`, {
        itemId, countedQty: parsedQty, notes: countNotes[itemId] || ''
      });
      if (res.data.success) toast.success(res.data.message);
      else fetchFieldData(fieldSessionId);
    } catch (err) { toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ'); fetchFieldData(fieldSessionId); }
    finally { setSubmitting(p => ({ ...p, [itemId]: false })); }
  };

  // ── Derived data ──────────────────────────────────────

  const items = useMemo(() => sessionData?.items || [], [sessionData]);
  const warehouses = useMemo(() => [...new Set(items.map(i => i.Warehouse).filter(Boolean))].sort(), [items]);
  const locations  = useMemo(() => [...new Set(items.filter(i => !filterWH || i.Warehouse === filterWH).map(i => i.Location).filter(Boolean))].sort(), [items, filterWH]);
  const gnames     = useMemo(() => [...new Set(items.map(i => i.CategoryName).filter(Boolean))].sort(), [items]);

  const baseFiltered = useMemo(() => items.filter(i =>
    (!filterWH    || i.Warehouse    === filterWH)    &&
    (!filterLoc   || i.Location     === filterLoc)   &&
    (!filterGname || i.CategoryName === filterGname) &&
    (!filterSize  || i.SizeCode     === filterSize)  &&
    (!filterThick || i.Thickness    === filterThick)
  ), [items, filterWH, filterLoc, filterGname, filterSize, filterThick]);

  const sizes  = useMemo(() => [...new Set(baseFiltered.map(i => i.SizeCode).filter(Boolean))].sort(), [baseFiltered]);
  const thicks = useMemo(() => [...new Set(baseFiltered.map(i => i.Thickness).filter(v => v != null && String(v) !== '0' && String(v) !== ''))].map(String).sort(), [baseFiltered]);

  const filteredItems = useMemo(() => {
    if (!search) return baseFiltered;
    const q = search.toLowerCase();
    return baseFiltered.filter(i => i.ItemCode?.toLowerCase().includes(q) || i.ItemName?.toLowerCase().includes(q));
  }, [baseFiltered, search]);

  const toggleSelect = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };
  const toggleSelectAll = () => {
    const ids = filteredItems.map(i => i.ItemID);
    const allSel = ids.length > 0 && ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSel) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.ItemID));
  const someFilteredSelected = !allFilteredSelected && filteredItems.some(i => selectedIds.has(i.ItemID));
  const displayItems = useMemo(() => showSelected ? items.filter(i => selectedIds.has(i.ItemID)) : filteredItems, [showSelected, items, filteredItems, selectedIds]);
  const isDraft = sessionData?.session?.Status === 'DRAFT';

  const stats = useMemo(() => ({
    total: items.length,
    counted: items.filter(i => i.EntryCount > 0).length,
    locked: items.filter(i => i.IsLocked).length,
    recount: items.filter(i => i.NeedsRecount).length,
    diff: items.filter(i => i.EntryCount > 0 && Math.abs(Number(i.TotalCounted) - Number(i.SystemQty)) >= 0.001).length,
  }), [items]);

  const fieldItems = useMemo(() => fieldData?.items || [], [fieldData]);
  const filteredFieldItems = useMemo(() => fieldItems.filter(i => {
    const q = fieldSearch.toLowerCase();
    const matchSearch = !q || i.ItemCode?.toLowerCase().includes(q) || i.ItemName?.toLowerCase().includes(q) || i.Location?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (fieldFilter === 'recount') return i.NeedsRecount;
    if (fieldFilter === 'pending') return !i.IsLocked && i.EntryCount === 0;
    if (fieldFilter === 'done') return i.EntryCount > 0 || i.IsLocked;
    return !i.IsLocked;
  }), [fieldItems, fieldSearch, fieldFilter]);

  // ── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {canOffice && (
          <button onClick={() => setTab('office')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'office' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            จัดการรอบ
          </button>
        )}
        {canField && (
          <button onClick={() => setTab('field')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'field' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            ตรวจนับ
          </button>
        )}
        <button onClick={() => { tab === 'office' ? fetchSessions() : fetchFieldSessions(); }}
          className="ml-auto p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ══════════ OFFICE TAB ══════════ */}
      {tab === 'office' && (
        <>
          {view === 'list' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0">รายการรอบตรวจนับ</h3>
                <button onClick={() => setCreateModal(true)} className="btn-primary text-sm">
                  <Plus size={14} />สร้างรอบใหม่
                </button>
              </div>
              {loading ? <LoadingSpinner text="กำลังโหลด..." /> : (
                <div className="space-y-2">
                  {sessions.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">ยังไม่มีรอบตรวจนับ</div>
                  )}
                  {sessions.map(s => (
                    <div key={s.SessionID}
                      onClick={() => openDetail(s)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50/30 cursor-pointer transition-all group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{s.SessionName}</span>
                          <StatusBadge status={s.Status} />
                          {s.WarehouseCode && <span className="text-xs text-slate-400">{s.WarehouseCode}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>รายการ: {s.ItemCount}</span>
                          <span>Lock: {s.LockedCount}/{s.ItemCount}</span>
                          {s.RecountCount > 0 && <span className="text-amber-600">ตรวจนับซ้ำ: {s.RecountCount}</span>}
                          <span>{dayjs(s.CreatedAt).format('D MMM BB')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {s.Status === 'DRAFT' && (
                          <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'detail' && selectedSession && (
            <div className="space-y-4">
              {/* Header */}
              <div className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setView('list'); fetchSessions(); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{sessionData?.session?.SessionName || selectedSession.SessionName}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <StatusBadge status={sessionData?.session?.Status || selectedSession.Status} />
                        {sessionData?.session?.WarehouseCode && <span className="text-xs text-slate-400">{sessionData.session.WarehouseCode}</span>}
                        <span className="text-xs text-slate-400">{dayjs(selectedSession.CreatedAt).format('D MMM BB HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {sessionData?.session?.Status === 'DRAFT' && (
                      <>
                        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                        <button onClick={() => importRef.current?.click()} disabled={importing}
                          className="btn-secondary text-sm flex items-center gap-1.5">
                          {importing ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" /> : <Upload size={14} />}
                          Import
                        </button>
                        <button onClick={() => handleStatusChange('OPEN')} disabled={saving || !items.length}
                          className="btn-primary text-sm">
                          {selectedIds.size > 0 && selectedIds.size < items.length
                            ? `ส่งให้หน้างาน (เลือก ${selectedIds.size} รายการ)`
                            : 'ส่งให้หน้างาน'}
                        </button>
                      </>
                    )}
                    {sessionData?.session?.Status === 'OPEN' && (
                      <>
                        <button onClick={handleLockCorrect} disabled={saving} className="btn-secondary text-sm flex items-center gap-1.5">
                          <Lock size={13} />Lock ที่ถูกต้อง
                        </button>
                        <button onClick={handleRecountDiff} disabled={saving} className="btn-secondary text-sm flex items-center gap-1.5">
                          <RotateCcw size={13} />ส่งกลับที่มีผลต่าง
                        </button>
                        <button onClick={() => handleStatusChange('COMPLETED')} disabled={saving}
                          className="btn-primary text-sm flex items-center gap-1.5">
                          <CheckCircle2 size={14} />ปิดรอบ
                        </button>
                      </>
                    )}
                    {sessionData?.session?.Status !== 'DRAFT' && (
                      <button onClick={handleReport} className="btn-secondary text-sm flex items-center gap-1.5">
                        <Download size={14} />รายงาน
                      </button>
                    )}
                    <button onClick={() => fetchDetail(selectedSession.SessionID)} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-500 transition-colors">
                      <RefreshCw size={14} className={detailLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Stats — always visible so user sees count change after import */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                  {[
                    { label: 'ทั้งหมด', value: stats.total, cls: 'text-slate-700' },
                    { label: 'นับแล้ว', value: stats.counted, cls: 'text-blue-600' },
                    { label: 'ผลต่าง', value: stats.diff, cls: 'text-red-500' },
                    { label: 'ตรวจซ้ำ', value: stats.recount, cls: 'text-amber-600' },
                    { label: 'Lock', value: stats.locked, cls: 'text-emerald-600' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="text-center py-2 px-3 rounded-xl bg-slate-50">
                      <div className={`text-lg font-black ${cls}`}>{value}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail Tabs */}
              <div className="flex gap-1.5">
                {[{ key: 'items', label: 'รายการ' }, { key: 'process', label: 'ประมวลผล' }].map(t => (
                  <button key={t.key} onClick={() => setDetailTab(t.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${detailTab === t.key ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t.label}
                    {t.key === 'process' && stats.diff > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-black">{stats.diff}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Filters — hidden when reviewing selected items */}
              {!showSelected && (
                <div className="flex gap-2 flex-wrap">
                  <select value={filterWH} onChange={e => { setFilterWH(e.target.value); setFilterLoc(''); }}
                    className="input-field py-1.5 text-sm w-auto min-w-32">
                    <option value="">— คลัง —</option>
                    {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
                    className="input-field py-1.5 text-sm w-auto min-w-36">
                    <option value="">— Location —</option>
                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select value={filterGname} onChange={e => setFilterGname(e.target.value)}
                    className="input-field py-1.5 text-sm w-auto min-w-36">
                    <option value="">— หมวดหมู่ —</option>
                    {gnames.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={filterSize} onChange={e => setFilterSize(e.target.value)}
                    className="input-field py-1.5 text-sm w-auto min-w-36">
                    <option value="">— SizeCode —</option>
                    {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={filterThick} onChange={e => setFilterThick(e.target.value)}
                    className="input-field py-1.5 text-sm w-auto min-w-32">
                    <option value="">— Thickness —</option>
                    {thicks.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="relative flex-1 min-w-40">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="ค้นหา รหัส / ชื่อสินค้า..."
                      className="input-field pl-8 text-sm" />
                  </div>
                  {(filterWH || filterLoc || filterGname || filterSize || filterThick || search) && (
                    <button onClick={() => { setFilterWH(''); setFilterLoc(''); setFilterGname(''); setFilterSize(''); setFilterThick(''); setSearch(''); }}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl bg-white transition-colors whitespace-nowrap">
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>
              )}

              {/* Selection bar (DRAFT only) */}
              {isDraft && (
                <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                  {showSelected ? (
                    <>
                      <button onClick={() => setShowSelected(false)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                        <ChevronLeft size={13} />กลับ
                      </button>
                      <span className="text-sm font-bold text-red-600">ยืนยันรายการที่เลือก — {selectedIds.size} รายการ</span>
                      <button onClick={() => { setSelectedIds(new Set()); setShowSelected(false); }}
                        className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors">
                        ล้างการเลือกทั้งหมด
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500">
                        เลือกแล้ว{' '}
                        <span className={`font-bold ${selectedIds.size > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {selectedIds.size}
                        </span>
                        {' '}/ {items.length} รายการ
                      </span>
                      {selectedIds.size > 0 ? (
                        <div className="ml-auto flex items-center gap-2">
                          <button onClick={() => setSelectedIds(new Set())}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                            ล้าง
                          </button>
                          <button onClick={() => setShowSelected(true)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5">
                            <CheckCircle2 size={12} />ดูที่เลือก ({selectedIds.size})
                          </button>
                        </div>
                      ) : (
                        <span className="ml-auto text-xs text-slate-400">Checkbox เพื่อเลือกรายการ</span>
                      )}
                    </>
                  )}
                </div>
              )}

              {(importing || detailLoading) ? (
                <LoadingSpinner text={importing ? 'กำลังนำเข้าข้อมูล...' : 'กำลังโหลด...'} />
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {isDraft && !showSelected && (
                          <th className="table-header px-3 py-2 w-8">
                            <input type="checkbox"
                              ref={el => { if (el) el.indeterminate = someFilteredSelected; }}
                              checked={allFilteredSelected}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-slate-300 accent-red-600 cursor-pointer" />
                          </th>
                        )}
                        <th className="table-header text-left px-3 py-2">Location</th>
                        <th className="table-header text-left px-3 py-2">รหัสสินค้า</th>
                        <th className="table-header text-left px-3 py-2 hide-mobile">ชื่อสินค้า</th>
                        <th className="table-header text-right px-3 py-2">ยอดระบบ</th>
                        {detailTab === 'process' && <>
                          <th className="table-header text-right px-3 py-2">ยอดนับ</th>
                          <th className="table-header text-right px-3 py-2">ผลต่าง</th>
                        </>}
                        <th className="table-header text-center px-3 py-2">สถานะ</th>
                        <th className="table-header px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-sm">
                          {showSelected ? 'ยังไม่ได้เลือกรายการ' : 'ไม่พบรายการ'}
                        </td></tr>
                      )}
                      {displayItems.map(item => {
                        const diff = Number(item.TotalCounted) - Number(item.SystemQty);
                        const hasDiff = item.EntryCount > 0 && Math.abs(diff) >= 0.001;
                        const rowCls = item.IsLocked ? 'bg-emerald-50/40' : item.NeedsRecount ? 'bg-amber-50/50' : hasDiff ? 'bg-red-50/30' : '';
                        return (
                          <tr key={item.ItemID} className={`border-b border-slate-50 hover:bg-slate-50/50 ${rowCls}`}>
                            {isDraft && !showSelected && (
                              <td className="px-3 py-2 w-8">
                                <input type="checkbox"
                                  checked={selectedIds.has(item.ItemID)}
                                  onChange={() => toggleSelect(item.ItemID)}
                                  className="w-4 h-4 rounded border-slate-300 accent-red-600 cursor-pointer" />
                              </td>
                            )}
                            <td className="px-3 py-2">
                              <div className="font-mono text-xs text-blue-600">{item.Location}</div>
                              {item.Warehouse && <div className="text-[10px] text-slate-400 mt-0.5">{item.Warehouse}</div>}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-mono text-xs">{item.ItemCode}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1.5 flex-wrap">
                                {item.SizeCode && <span>{item.SizeCode}</span>}
                                {item.Thickness && item.Thickness !== '0' && <span>t{item.Thickness}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 hide-mobile">
                              <div className="text-xs text-slate-600 max-w-[200px] truncate">{item.ItemName}</div>
                              {item.CategoryName && <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{item.CategoryName}</div>}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{Number(item.SystemQty).toLocaleString()}</td>
                            {detailTab === 'process' && <>
                              <td className="px-3 py-2 text-right font-semibold text-blue-700">
                                {item.EntryCount > 0 ? Number(item.TotalCounted).toLocaleString() : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right"><DiffBadge sys={item.SystemQty} counted={item.TotalCounted} /></td>
                            </>}
                            <td className="px-3 py-2 text-center">
                              {item.IsLocked
                                ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><Lock size={11}/>Lock</span>
                                : item.NeedsRecount
                                ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><RotateCcw size={11}/>ตรวจซ้ำ</span>
                                : item.EntryCount > 0
                                ? <span className="text-blue-600 text-xs font-semibold">นับแล้ว</span>
                                : <span className="text-slate-300 text-xs">รอนับ</span>
                              }
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {item.EntryCount > 0 && (
                                  <button onClick={() => openEntries(item)} title="ดูประวัติ"
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                    <FileText size={12} />
                                  </button>
                                )}
                                {sessionData?.session?.Status === 'OPEN' && !item.IsLocked && item.EntryCount > 0 && (
                                  <button onClick={() => handleLock(item.ItemID)} title="Lock"
                                    className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
                                    <Lock size={12} />
                                  </button>
                                )}
                                {sessionData?.session?.Status === 'OPEN' && !item.IsLocked && item.EntryCount > 0 && (
                                  <button onClick={() => handleRecount(item.ItemID)} title="ส่งกลับนับใหม่"
                                    className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                                {item.IsLocked && (
                                  <button onClick={() => handleUnlock(item.ItemID)} title="Unlock"
                                    className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                                    <Unlock size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════ FIELD TAB ══════════ */}
      {tab === 'field' && (
        <div className="space-y-4">
          {/* Session selector */}
          <div className="card">
            <label className="label">เลือกรอบตรวจนับ</label>
            <select value={fieldSessionId} onChange={e => setFieldSessionId(e.target.value)} className="input-field">
              <option value="">-- เลือกรอบ --</option>
              {fieldSessions.map(s => (
                <option key={s.SessionID} value={s.SessionID}>
                  {s.SessionName} ({s.ItemCount} รายการ, นับแล้ว {s.LockedCount})
                </option>
              ))}
            </select>
            {fieldSessions.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">ไม่มีรอบที่เปิดอยู่ขณะนี้</p>
            )}
          </div>

          {fieldSessionId && (
            <>
              {/* Filter + Search */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'all', l: 'ทั้งหมด' },
                  { v: 'recount', l: 'ตรวจนับซ้ำ' },
                  { v: 'pending', l: 'ยังไม่นับ' },
                  { v: 'done', l: 'นับแล้ว' },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setFieldFilter(v)}
                    className={`px-3 h-8 rounded-xl text-xs font-bold transition-all ${fieldFilter === v ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                    {l}
                    {v === 'recount' && fieldData?.items?.filter(i => i.NeedsRecount).length > 0 && (
                      <span className="ml-1 px-1.5 rounded-full bg-amber-200 text-amber-800 text-[9px]">
                        {fieldData.items.filter(i => i.NeedsRecount).length}
                      </span>
                    )}
                  </button>
                ))}
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                    placeholder="ค้นหา..." className="input-field pl-8 text-sm h-8" />
                </div>
                <button onClick={() => fetchFieldData(fieldSessionId)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-500 transition-colors">
                  <RefreshCw size={14} className={fieldLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {fieldLoading ? <LoadingSpinner text="กำลังโหลด..." /> : (
                <div className="space-y-2">
                  {filteredFieldItems.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">ไม่พบรายการ</div>
                  )}
                  {filteredFieldItems.map(item => (
                    <div key={item.ItemID}
                      className={`card py-3 px-4 space-y-2 ${item.NeedsRecount ? 'border-amber-200 bg-amber-50/30' : ''} ${item.IsLocked ? 'border-emerald-200 bg-emerald-50/20 opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{item.ItemCode}</span>
                            <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">{item.Location}</span>
                            {item.NeedsRecount && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><RotateCcw size={10}/>ตรวจนับซ้ำ</span>}
                            {item.IsLocked && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Lock size={10}/>Lock</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{item.ItemName}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-slate-400">ยอดระบบ</div>
                          <div className="font-black text-slate-900">{Number(item.SystemQty).toLocaleString()}</div>
                          {item.EntryCount > 0 && (
                            <div className="text-xs text-blue-600 font-semibold">นับได้: {Number(item.TotalCounted).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                      {!item.IsLocked && (
                        <div className="flex gap-2">
                          <input
                            type="number" step="0.01" min="0"
                            value={countInputs[item.ItemID] ?? ''}
                            onChange={e => setCountInputs(p => ({ ...p, [item.ItemID]: e.target.value }))}
                            placeholder="ใส่จำนวนที่นับได้"
                            className="input-field text-sm flex-1"
                            onKeyDown={e => { if (e.key === 'Enter') handleSubmitCount(item.ItemID); }}
                          />
                          <button
                            onClick={() => handleSubmitCount(item.ItemID)}
                            disabled={submitting[item.ItemID] || countInputs[item.ItemID] === '' || countInputs[item.ItemID] == null}
                            className="btn-primary text-sm px-4 flex-shrink-0">
                            {submitting[item.ItemID]
                              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <><Save size={14} />บันทึก</>
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* Create Session Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">สร้างรอบตรวจนับใหม่</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">วันที่สำหรับตรวจนับ *</label>
                <input type="date" value={createForm.countDate}
                  onChange={e => setCreateForm(p => ({ ...p, countDate: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field" placeholder="..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={14} />สร้าง</>}
              </button>
              <button onClick={() => setCreateModal(false)} className="btn-secondary px-6">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Entries History Modal */}
      {entriesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">ประวัติการนับ</h3>
                <p className="text-xs text-slate-500">{entriesModal.ItemCode} — {entriesModal.Location}</p>
              </div>
              <button onClick={() => setEntriesModal(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {entries.length === 0
                ? <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีการนับ</p>
                : entries.map(e => (
                  <div key={e.EntryID} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50">
                    <div>
                      <span className="text-xs font-bold text-slate-600">รอบที่ {e.Round}</span>
                      <span className="text-xs text-slate-400 ml-2">{e.CountedBy}</span>
                      {e.Notes && <span className="text-xs text-slate-400 ml-2">({e.Notes})</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-700">{Number(e.CountedQty).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{dayjs(e.CountedAt).format('D MMM HH:mm')}</div>
                    </div>
                  </div>
                ))
              }
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 mt-2">
                <span className="text-sm font-bold text-blue-700">รวมทั้งหมด</span>
                <span className="text-lg font-black text-blue-700">
                  {entries.reduce((s, e) => s + Number(e.CountedQty), 0).toLocaleString()}
                </span>
              </div>
            </div>
            <button onClick={() => setEntriesModal(null)} className="btn-secondary w-full mt-4">ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}
