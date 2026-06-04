import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Upload, Download, Lock, Unlock, RefreshCw, RotateCcw,
  ChevronLeft, CheckCircle2, FileText, ChevronDown,
  Search, X, Save, Trash2, Eye, EyeOff
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import dayjs from 'dayjs';
import '../utils/helpers';

// Searchable dropdown with max-height scroll — fixes overflow on long lists
function SearchSelect({ value, onChange, options, placeholder, className = '' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const filtered = useMemo(
    () => q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options,
    [options, q]
  );
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => { setOpen(p => !p); setQ(''); }}
        className="input-field py-1.5 text-sm w-full text-left flex items-center justify-between gap-1 cursor-pointer">
        <span className={`truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown size={11} className="flex-shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[200] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col"
          style={{ minWidth: 150, maxHeight: 260 }}>
          <div className="p-1.5 border-b border-slate-100 flex-shrink-0">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา..." onClick={e => e.stopPropagation()}
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-red-400" />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQ(''); }}
              className="w-full text-left px-2 py-1 rounded text-xs text-slate-400 hover:bg-slate-50">{placeholder}</button>
            {filtered.map(o => (
              <button type="button" key={o} onClick={() => { onChange(o); setOpen(false); setQ(''); }}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${value === o ? 'bg-red-50 text-red-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                {o}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-3">ไม่พบ</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 100;
const FIELD_PAGE_SIZE = 50;

const STATUS_CLS = {
  DRAFT:     'bg-slate-100 text-slate-600',
  OPEN:      'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};
const StatusBadge = ({ status }) => {
  const { t } = useLang();
  const STATUS_KEY = { DRAFT: 'stockCount.statusDraft', OPEN: 'stockCount.statusOpen', COMPLETED: 'stockCount.statusCompleted' };
  const label = STATUS_KEY[status] ? t(STATUS_KEY[status]) : status;
  const cls = STATUS_CLS[status] || 'bg-slate-100 text-slate-500';
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
};
const DiffBadge = ({ sys, counted }) => {
  if (counted == null || counted === 0 && sys > 0) return <span className="text-slate-300 text-xs">รอนับ</span>;
  const diff = Number(counted) - Number(sys);
  if (Math.abs(diff) < 0.001) return <span className="text-emerald-600 text-xs font-bold">✓ ตรงกัน</span>;
  return <span className={`text-xs font-bold ${diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</span>;
};

// ── Memoized row — only re-renders when its own props change ──────────────────
const ItemRow = memo(function ItemRow({ item, isDraft, showSelected, detailTab, sessionStatus, isSelected, onSelect, onLock, onUnlock, onRecount, onEntries }) {
  const diff = Number(item.TotalCounted) - Number(item.SystemQty);
  const hasDiff = item.EntryCount > 0 && Math.abs(diff) >= 0.001;
  const rowCls = item.IsLocked ? 'bg-emerald-50/40' : item.NeedsRecount ? 'bg-amber-50/50' : hasDiff ? 'bg-red-50/30' : '';
  return (
    <tr className={`border-b border-slate-50 hover:bg-slate-50/50 ${rowCls}`}>
      {isDraft && !showSelected && (
        <td className="px-3 py-2 w-8">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.ItemID)}
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
            <button onClick={() => onEntries(item)} title="ดูประวัติ"
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <FileText size={12} />
            </button>
          )}
          {sessionStatus === 'OPEN' && !item.IsLocked && item.EntryCount > 0 && (
            <button onClick={() => onLock(item.ItemID)} title="Lock"
              className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
              <Lock size={12} />
            </button>
          )}
          {sessionStatus === 'OPEN' && !item.IsLocked && item.EntryCount > 0 && (
            <button onClick={() => onRecount(item.ItemID)} title="ส่งกลับนับใหม่"
              className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
              <RotateCcw size={12} />
            </button>
          )}
          {item.IsLocked && (
            <button onClick={() => onUnlock(item.ItemID)} title="Unlock"
              className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
              <Unlock size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ── Memoized field card — own local input state, no parent re-render on type ──
const FieldCard = memo(function FieldCard({ item, submitting, onSubmit, isActive, onSubmitDone }) {
  const [qty, setQty] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  const submit = () => {
    if (qty === '' || qty == null) return;
    onSubmit(item.ItemID, parseFloat(qty));
    setQty('');
    onSubmitDone?.();
  };
  return (
    <div className={`card py-3 px-4 space-y-2
      ${isActive ? 'ring-2 ring-red-400 shadow-md border-red-300 bg-red-50/20' : ''}
      ${item.NeedsRecount ? 'border-amber-200 bg-amber-50/30' : ''}
      ${item.IsLocked ? 'border-emerald-200 bg-emerald-50/20 opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-900 text-sm">{item.ItemCode}</span>
            <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">{item.Location}</span>
            {item.Warehouse && <span className="text-xs text-slate-400 font-mono">{item.Warehouse}</span>}
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
            ref={inputRef}
            type="number" step="0.01" min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="ใส่จำนวนที่นับได้"
            className="input-field text-sm flex-1"
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <button onClick={submit} disabled={submitting || qty === '' || qty == null}
            className="btn-primary text-sm px-4 flex-shrink-0">
            {submitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={14} />บันทึก</>
            }
          </button>
        </div>
      )}
    </div>
  );
});

export default function StockCount() {
  const { hasPermission } = useAuth();
  const { t } = useLang();
  const canOffice = hasPermission('STOCKCOUNT_OFFICE');
  const canField  = hasPermission('STOCKCOUNT_FIELD');
  const defaultTab = canOffice ? 'office' : 'field';
  const [tab, setTab] = useState(defaultTab);

  // ── Office state ──
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list');
  const [detailTab, setDetailTab] = useState('items');
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
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
  const [entriesModal, setEntriesModal] = useState(null);
  const [entries, setEntries] = useState([]);

  // ── Field state ──
  const [fieldSessions, setFieldSessions] = useState([]);
  const [fieldSessionId, setFieldSessionId] = useState('');
  const [fieldData, setFieldData] = useState(null);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [filterFieldWH, setFilterFieldWH] = useState('');
  const [filterFieldLoc, setFilterFieldLoc] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showSelected, setShowSelected] = useState(false);
  const [page, setPage] = useState(0);
  const [fieldPage, setFieldPage] = useState(0);
  const [deleteModal, setDeleteModal] = useState({ open: false, session: null, password: '', loading: false, showPw: false });

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
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setFieldLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'office') fetchSessions(); }, [tab, fetchSessions]);
  useEffect(() => { if (tab === 'field') fetchFieldSessions(); }, [tab, fetchFieldSessions]);
  useEffect(() => { if (fieldSessionId) fetchFieldData(fieldSessionId); }, [fieldSessionId, fetchFieldData]);
  useEffect(() => { setPage(0); }, [filterWH, filterLoc, filterGname, filterSize, filterThick, search, showSelected]);
  useEffect(() => { setFieldPage(0); setFilterFieldWH(''); setFilterFieldLoc(''); }, [fieldSessionId]);
  useEffect(() => { setFieldPage(0); }, [fieldSearch, fieldFilter, filterFieldWH, filterFieldLoc]);

  // ── Office actions ────────────────────────────────────

  const openDetail = (session) => {
    setSelectedSession(session);
    setView('detail');
    setDetailTab('items');
    setSearch('');
    setSelectedIds(new Set());
    setShowSelected(false);
    setPage(0);
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
        const sid = selectedSession.SessionID;
        let attempts = 0;
        const poll = async () => {
          try {
            const detail = await api.get(`/stock-count/${sid}`);
            const count = detail?.data?.data?.items?.length ?? 0;
            await fetchDetail(sid);
            if (count === 0 && ++attempts < 80) setTimeout(poll, 3000);
          } catch {}
        };
        setTimeout(poll, 3000);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'นำเข้าล้มเหลว'); }
    finally { setImporting(false); }
  };

  const handleLock = useCallback(async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, IsLocked: 1, NeedsRecount: 0 } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession?.SessionID}/items/${itemId}/lock`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession?.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession?.SessionID); }
  }, [selectedSession?.SessionID, fetchDetail]);

  const handleUnlock = useCallback(async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, IsLocked: 0, LockedAt: null, LockedBy: null } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession?.SessionID}/items/${itemId}/unlock`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession?.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession?.SessionID); }
  }, [selectedSession?.SessionID, fetchDetail]);

  const handleRecount = useCallback(async (itemId) => {
    setSessionData(prev => ({ ...prev, items: prev.items.map(i => i.ItemID === itemId ? { ...i, NeedsRecount: 1, IsLocked: 0, TotalCounted: 0, EntryCount: 0 } : i) }));
    try {
      const res = await api.put(`/stock-count/${selectedSession?.SessionID}/items/${itemId}/recount`);
      if (res.data.success) toast.success(res.data.message);
      else fetchDetail(selectedSession?.SessionID);
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); fetchDetail(selectedSession?.SessionID); }
  }, [selectedSession?.SessionID, fetchDetail]);

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

  const handleDelete = (session) => {
    setDeleteModal({ open: true, session, password: '', loading: false });
  };

  const confirmDelete = async () => {
    const { session, password } = deleteModal;
    if (!password) { toast.error('กรุณาระบุรหัสผ่าน'); return; }
    setDeleteModal(m => ({ ...m, loading: true }));
    try {
      const res = await api.delete(`/stock-count/${session.SessionID}`, { data: { password } });
      if (res.data.success) {
        toast.success(res.data.message);
        setDeleteModal({ open: false, session: null, password: '', loading: false, showPw: false });
        fetchSessions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
      setDeleteModal(m => ({ ...m, loading: false }));
    }
  };

  const handleReport = async () => {
    try {
      const res = await api.get(`/stock-count/${selectedSession.SessionID}/report`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_count_${selectedSession.SessionName || selectedSession.SessionID}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('ดาวน์โหลดรายงานไม่สำเร็จ');
    }
  };

  const onOpenEntries = useCallback(async (item) => {
    setEntriesModal(item);
    try {
      const res = await api.get(`/stock-count/${selectedSession?.SessionID}/items/${item.ItemID}/entries`);
      setEntries(res.data.data || []);
    } catch { setEntries([]); }
  }, [selectedSession?.SessionID]);

  // ── Field actions ─────────────────────────────────────

  const handleSubmitCount = useCallback(async (itemId, parsedQty) => {
    if (!parsedQty || isNaN(parsedQty)) return toast.error('กรุณาระบุจำนวน');
    setSubmitting(p => ({ ...p, [itemId]: true }));
    setFieldData(prev => ({
      ...prev,
      items: prev.items.map(i => i.ItemID !== itemId ? i : {
        ...i, TotalCounted: Number(i.TotalCounted) + parsedQty, EntryCount: (i.EntryCount || 0) + 1, NeedsRecount: 0
      })
    }));
    try {
      const res = await api.post(`/stock-count/${fieldSessionId}/count`, { itemId, countedQty: parsedQty, notes: '' });
      if (res.data.success) toast.success(res.data.message);
      else fetchFieldData(fieldSessionId);
    } catch (err) { toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ'); fetchFieldData(fieldSessionId); }
    finally { setSubmitting(p => ({ ...p, [itemId]: false })); }
  }, [fieldSessionId, fetchFieldData]);

  const handleScan = (code) => {
    if (!code) return;
    if (fieldLocations.includes(code)) {
      setFilterFieldLoc(code);
      setActiveItemId(null);
      toast.success(`📍 Location: ${code}`);
      return;
    }
    if (fieldWarehouses.includes(code)) {
      setFilterFieldWH(code); setFilterFieldLoc('');
      setActiveItemId(null);
      toast.success(`คลัง: ${code}`);
      return;
    }
    const found = fieldItems.find(i => i.ItemCode?.toLowerCase() === code.toLowerCase());
    if (found) {
      if (found.Warehouse) setFilterFieldWH(found.Warehouse);
      if (found.Location) setFilterFieldLoc(found.Location);
      setActiveItemId(found.ItemID);
      return;
    }
    toast.error(`ไม่พบรหัส: ${code}`);
  };
  const clearActive = useCallback(() => setActiveItemId(null), []);

  // ── Derived data ──────────────────────────────────────

  const items = useMemo(() => sessionData?.items || [], [sessionData]);
  const warehouses = useMemo(() => [...new Set(items.map(i => i.Warehouse).filter(Boolean))].sort(), [items]);

  const itemsByWH    = useMemo(() => !filterWH    ? items      : items.filter(i => i.Warehouse    === filterWH),              [items, filterWH]);
  const locations    = useMemo(() => [...new Set(itemsByWH.map(i => i.Location).filter(Boolean))].sort(),                    [itemsByWH]);

  const itemsByLoc   = useMemo(() => !filterLoc   ? itemsByWH  : itemsByWH.filter(i => i.Location   === filterLoc),           [itemsByWH, filterLoc]);
  const gnames       = useMemo(() => [...new Set(itemsByLoc.map(i => i.CategoryName).filter(Boolean))].sort(),               [itemsByLoc]);

  const itemsByGname = useMemo(() => !filterGname ? itemsByLoc : itemsByLoc.filter(i => i.CategoryName === filterGname),      [itemsByLoc, filterGname]);
  const sizes        = useMemo(() => [...new Set(itemsByGname.map(i => i.SizeCode).filter(Boolean))].sort(),                 [itemsByGname]);

  const itemsBySize  = useMemo(() => !filterSize  ? itemsByGname : itemsByGname.filter(i => i.SizeCode === filterSize),       [itemsByGname, filterSize]);
  const thicks       = useMemo(() => [...new Set(itemsBySize.map(i => i.Thickness).filter(v => v != null && String(v) !== '0' && String(v) !== ''))].map(String).sort(), [itemsBySize]);

  const baseFiltered = useMemo(() => !filterThick ? itemsBySize : itemsBySize.filter(i => i.Thickness === filterThick),       [itemsBySize, filterThick]);

  const filteredItems = useMemo(() => {
    if (!search) return baseFiltered;
    const q = search.toLowerCase();
    return baseFiltered.filter(i => i.ItemCode?.toLowerCase().includes(q) || i.ItemName?.toLowerCase().includes(q));
  }, [baseFiltered, search]);

  const onSelectItem = useCallback((itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }, []);

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

  const allFilteredSelected = useMemo(() =>
    filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.ItemID)),
    [filteredItems, selectedIds]);
  const someFilteredSelected = useMemo(() =>
    !allFilteredSelected && filteredItems.some(i => selectedIds.has(i.ItemID)),
    [allFilteredSelected, filteredItems, selectedIds]);

  const displayItems = useMemo(() => showSelected ? items.filter(i => selectedIds.has(i.ItemID)) : filteredItems, [showSelected, items, filteredItems, selectedIds]);
  const isDraft = sessionData?.session?.Status === 'DRAFT';
  const sessionStatus = sessionData?.session?.Status;

  const stats = useMemo(() => ({
    total: items.length,
    counted: items.filter(i => i.EntryCount > 0).length,
    locked: items.filter(i => i.IsLocked).length,
    recount: items.filter(i => i.NeedsRecount).length,
    diff: items.filter(i => i.EntryCount > 0 && Math.abs(Number(i.TotalCounted) - Number(i.SystemQty)) >= 0.001).length,
  }), [items]);

  const pageItems = useMemo(() => displayItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [displayItems, page]);
  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));

  const fieldItems = useMemo(() => fieldData?.items || [], [fieldData]);
  const fieldWarehouses = useMemo(() => [...new Set(fieldItems.map(i => i.Warehouse).filter(Boolean))].sort(), [fieldItems]);
  const fieldLocations  = useMemo(() => [...new Set(fieldItems.filter(i => !filterFieldWH || i.Warehouse === filterFieldWH).map(i => i.Location).filter(Boolean))].sort(), [fieldItems, filterFieldWH]);
  const filteredFieldItems = useMemo(() => fieldItems.filter(i => {
    if (filterFieldWH  && i.Warehouse !== filterFieldWH)  return false;
    if (filterFieldLoc && i.Location  !== filterFieldLoc) return false;
    const q = fieldSearch.toLowerCase();
    const matchSearch = !q || i.ItemCode?.toLowerCase().includes(q) || i.ItemName?.toLowerCase().includes(q) || i.Location?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (fieldFilter === 'recount') return i.NeedsRecount;
    if (fieldFilter === 'pending') return !i.IsLocked && i.EntryCount === 0;
    if (fieldFilter === 'done') return i.EntryCount > 0 || i.IsLocked;
    return !i.IsLocked;
  }), [fieldItems, fieldSearch, fieldFilter, filterFieldWH, filterFieldLoc]);
  const fieldPageItems = useMemo(() => filteredFieldItems.slice(fieldPage * FIELD_PAGE_SIZE, (fieldPage + 1) * FIELD_PAGE_SIZE), [filteredFieldItems, fieldPage]);
  const fieldTotalPages = Math.max(1, Math.ceil(filteredFieldItems.length / FIELD_PAGE_SIZE));

  // ── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Delete confirm modal ── */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-50"><Trash2 size={18} className="text-red-500" /></div>
              <div>
                <h3 className="font-bold text-slate-900">ยืนยันการลบรอบนับ</h3>
                <p className="text-xs text-slate-500 mt-0.5">"{deleteModal.session?.SessionName}"</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">ข้อมูลทั้งหมดในรอบนี้จะถูกลบถาวร กรุณาใส่รหัสผ่านของคุณเพื่อยืนยัน</p>
            <div className="relative">
              <input
                type={deleteModal.showPw ? 'text' : 'password'}
                placeholder="รหัสผ่านของคุณ"
                value={deleteModal.password}
                onChange={e => setDeleteModal(m => ({ ...m, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && confirmDelete()}
                autoFocus
                className="input-field w-full pr-10"
              />
              <button type="button"
                onClick={() => setDeleteModal(m => ({ ...m, showPw: !m.showPw }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {deleteModal.showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModal({ open: false, session: null, password: '', loading: false })}
                className="btn-secondary text-sm" disabled={deleteModal.loading}>
                ยกเลิก
              </button>
              <button onClick={confirmDelete} disabled={deleteModal.loading || !deleteModal.password}
                className="btn-danger text-sm flex items-center gap-1.5">
                {deleteModal.loading
                  ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={13} />}
                ลบรอบนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {canOffice && (
          <button onClick={() => setTab('office')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'office' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t('stockCount.officeTab')}
          </button>
        )}
        {canField && (
          <button onClick={() => setTab('field')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'field' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t('stockCount.fieldTab')}
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
                <h3 className="card-header mb-0">{t('stockCount.listTitle')}</h3>
                <button onClick={() => setCreateModal(true)} className="btn-primary text-sm">
                  <Plus size={14} />{t('stockCount.createSession')}
                </button>
              </div>
              {loading ? <LoadingSpinner text={t('common.loading')} /> : (
                <div className="space-y-2">
                  {sessions.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">{t('stockCount.noSessions')}</div>
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
                        <button onClick={() => handleDelete(s)} title="ลบรอบนับ" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
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
                        <StatusBadge status={sessionStatus || selectedSession.Status} />
                        {sessionData?.session?.WarehouseCode && <span className="text-xs text-slate-400">{sessionData.session.WarehouseCode}</span>}
                        <span className="text-xs text-slate-400">{dayjs(selectedSession.CreatedAt).format('D MMM BB HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {sessionStatus === 'DRAFT' && (
                      <>
                        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                        <button onClick={() => importRef.current?.click()} disabled={importing}
                          className="btn-secondary text-sm flex items-center gap-1.5">
                          {importing ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" /> : <Upload size={14} />}
                          {importing ? t('stockCount.importing') : t('stockCount.importExcel')}
                        </button>
                        <button onClick={() => handleStatusChange('OPEN')} disabled={saving || !items.length}
                          className="btn-primary text-sm">
                          {selectedIds.size > 0 && selectedIds.size < items.length
                            ? `ส่งให้หน้างาน (เลือก ${selectedIds.size} รายการ)`
                            : 'ส่งให้หน้างาน'}
                        </button>
                      </>
                    )}
                    {sessionStatus === 'OPEN' && (
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
                    {sessionStatus !== 'DRAFT' && (
                      <button onClick={handleReport} className="btn-secondary text-sm flex items-center gap-1.5">
                        <Download size={14} />รายงาน
                      </button>
                    )}
                    <button onClick={() => fetchDetail(selectedSession.SessionID)} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-500 transition-colors">
                      <RefreshCw size={14} className={detailLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

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

              {!showSelected && (
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex gap-2 flex-wrap items-center">
                  <SearchSelect value={filterWH} onChange={v => { setFilterWH(v); setFilterLoc(''); setFilterGname(''); setFilterSize(''); setFilterThick(''); }}
                    options={warehouses} placeholder="— คลัง —" className="w-32 flex-shrink-0" />
                  <SearchSelect value={filterLoc} onChange={v => { setFilterLoc(v); setFilterGname(''); setFilterSize(''); setFilterThick(''); }}
                    options={locations} placeholder="— Location —" className="w-36 flex-shrink-0" />
                  <SearchSelect value={filterGname} onChange={v => { setFilterGname(v); setFilterSize(''); setFilterThick(''); }}
                    options={gnames} placeholder="— หมวดหมู่ —" className="w-36 flex-shrink-0" />
                  <SearchSelect value={filterSize} onChange={v => { setFilterSize(v); setFilterThick(''); }}
                    options={sizes} placeholder="— SizeCode —" className="w-36 flex-shrink-0" />
                  <SearchSelect value={filterThick} onChange={setFilterThick}
                    options={thicks} placeholder="— Thickness —" className="w-32 flex-shrink-0" />
                  <div className="relative flex-1 min-w-40">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="ค้นหา รหัส / ชื่อสินค้า..."
                      className="input-field pl-8 text-sm" />
                  </div>
                  {(filterWH || filterLoc || filterGname || filterSize || filterThick || search) && (
                    <button onClick={() => { setFilterWH(''); setFilterLoc(''); setFilterGname(''); setFilterSize(''); setFilterThick(''); setSearch(''); }}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl bg-white transition-colors whitespace-nowrap flex-shrink-0">
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>
              )}

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
                <LoadingSpinner text={importing ? t('stockCount.importing') : t('common.loading')} />
              ) : (
                <div className="card overflow-x-auto">
                  {displayItems.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs text-slate-400">
                        แสดง {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, displayItems.length)} จาก {displayItems.length} รายการ
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
                        <span className="text-xs text-slate-500 px-1">{page + 1} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
                      </div>
                    </div>
                  )}
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
                          {showSelected ? t('stockCount.noItems') : t('common.noData')}
                        </td></tr>
                      )}
                      {pageItems.map(item => (
                        <ItemRow
                          key={item.ItemID}
                          item={item}
                          isDraft={isDraft}
                          showSelected={showSelected}
                          detailTab={detailTab}
                          sessionStatus={sessionStatus}
                          isSelected={selectedIds.has(item.ItemID)}
                          onSelect={onSelectItem}
                          onLock={handleLock}
                          onUnlock={handleUnlock}
                          onRecount={handleRecount}
                          onEntries={onOpenEntries}
                        />
                      ))}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹ ก่อนหน้า</button>
                      <span className="text-xs text-slate-400 px-3">หน้า {page + 1} จาก {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">ถัดไป ›</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════ FIELD TAB ══════════ */}
      {tab === 'field' && (
        <div className="space-y-4">
          <div className="card">
            <label className="label">{t('stockCount.selectSession')}</label>
            <select value={fieldSessionId} onChange={e => setFieldSessionId(e.target.value)} className="input-field">
              <option value="">-- เลือกรอบ --</option>
              {fieldSessions.map(s => (
                <option key={s.SessionID} value={s.SessionID}>
                  {s.SessionName} ({s.ItemCount} รายการ, นับแล้ว {s.LockedCount})
                </option>
              ))}
            </select>
            {fieldSessions.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">{t('stockCount.noSessions')}</p>
            )}
          </div>

          {fieldSessionId && (
            <>
              {/* ── Barcode scan panel ── */}
              <div className="card py-3 px-4 border-slate-200 bg-slate-50">
                <label className="text-xs text-slate-500 font-semibold block mb-1.5 flex items-center gap-1">
                  <Search size={12} />สแกนบาร์โค้ด (Location / รหัสสินค้า)
                </label>
                <input
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && scanInput.trim()) {
                      handleScan(scanInput.trim());
                      setScanInput('');
                    }
                  }}
                  placeholder={t('stockCount.scanInput')}
                  className="input-field text-sm font-mono"
                />
                {(filterFieldWH || filterFieldLoc) && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {filterFieldWH && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">{filterFieldWH}</span>}
                    {filterFieldLoc && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold">📍 {filterFieldLoc}</span>}
                    <button onClick={() => { setFilterFieldWH(''); setFilterFieldLoc(''); setActiveItemId(null); }}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors">ล้าง</button>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex gap-2 flex-wrap items-center">
                {[
                  { v: 'all', l: t('stockCount.filterAll') },
                  { v: 'recount', l: t('stockCount.filterRecount') },
                  { v: 'pending', l: t('stockCount.filterPending') },
                  { v: 'done', l: t('stockCount.filterCounted') },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setFieldFilter(v)}
                    className={`px-3 h-8 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${fieldFilter === v ? 'bg-red-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                    {l}
                    {v === 'recount' && fieldData?.items?.filter(i => i.NeedsRecount).length > 0 && (
                      <span className="ml-1 px-1.5 rounded-full bg-amber-200 text-amber-800 text-[9px]">
                        {fieldData.items.filter(i => i.NeedsRecount).length}
                      </span>
                    )}
                  </button>
                ))}
                {fieldWarehouses.length > 0 && (
                  <SearchSelect value={filterFieldWH} onChange={v => { setFilterFieldWH(v); setFilterFieldLoc(''); }}
                    options={fieldWarehouses} placeholder="— คลัง —" className="w-32 flex-shrink-0" />
                )}
                {fieldLocations.length > 0 && (
                  <SearchSelect value={filterFieldLoc} onChange={setFilterFieldLoc}
                    options={fieldLocations} placeholder="— Location —" className="w-32 flex-shrink-0" />
                )}
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                    placeholder={t('stockCount.searchItem')} className="input-field pl-8 text-sm h-8" />
                </div>
                <button onClick={() => fetchFieldData(fieldSessionId)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0">
                  <RefreshCw size={14} className={fieldLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {fieldLoading ? <LoadingSpinner text={t('common.loading')} /> : (
                <div className="space-y-2">
                  {filteredFieldItems.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">{t('stockCount.noFieldItems')}</div>
                  )}
                  {filteredFieldItems.length > FIELD_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-slate-400">
                        แสดง {fieldPage * FIELD_PAGE_SIZE + 1}–{Math.min((fieldPage + 1) * FIELD_PAGE_SIZE, filteredFieldItems.length)} จาก {filteredFieldItems.length} รายการ
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setFieldPage(p => Math.max(0, p - 1))} disabled={fieldPage === 0}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
                        <span className="text-xs text-slate-500 px-1">{fieldPage + 1} / {fieldTotalPages}</span>
                        <button onClick={() => setFieldPage(p => Math.min(fieldTotalPages - 1, p + 1))} disabled={fieldPage >= fieldTotalPages - 1}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
                      </div>
                    </div>
                  )}
                  {fieldPageItems.map(item => (
                    <FieldCard
                      key={item.ItemID}
                      item={item}
                      submitting={!!submitting[item.ItemID]}
                      onSubmit={handleSubmitCount}
                      isActive={item.ItemID === activeItemId}
                      onSubmitDone={clearActive}
                    />
                  ))}
                  {fieldTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 pt-2">
                      <button onClick={() => setFieldPage(p => Math.max(0, p - 1))} disabled={fieldPage === 0}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹ ก่อนหน้า</button>
                      <span className="text-xs text-slate-400 px-3">หน้า {fieldPage + 1} จาก {fieldTotalPages}</span>
                      <button onClick={() => setFieldPage(p => Math.min(fieldTotalPages - 1, p + 1))} disabled={fieldPage >= fieldTotalPages - 1}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">ถัดไป ›</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {createModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{t('stockCount.createSession')}</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('stockCount.countDate')}</label>
                <input type="date" value={createForm.countDate}
                  onChange={e => setCreateForm(p => ({ ...p, countDate: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">{t('stockCount.notes')}</label>
                <input value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  className="input-field" placeholder="..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={14} />{t('stockCount.createSession')}</>}
              </button>
              <button onClick={() => setCreateModal(false)} className="btn-secondary px-6">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {entriesModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
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
            <button onClick={() => setEntriesModal(null)} className="btn-secondary w-full mt-4">{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
