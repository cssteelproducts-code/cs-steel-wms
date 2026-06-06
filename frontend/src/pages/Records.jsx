import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, RefreshCw, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import dayjs from 'dayjs';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLang } from '../context/LanguageContext';

const PRIORITIES = ['ปกติ', 'ด่วน', 'ด่วนมาก'];

const TRIP_STATUSES = [
  { value: 'WeighIn',   labelKey: 'status.weighIn' },
  { value: 'Data',      labelKey: 'status.data' },
  { value: 'WaitPick',  labelKey: 'status.waitPick' },
  { value: 'Loading',   labelKey: 'status.loading' },
  { value: 'WeighOut',  labelKey: 'status.weighOut' },
  { value: 'Checker',   labelKey: 'status.checker' },
  { value: 'Complete',  labelKey: 'status.complete' },
  { value: 'Cancelled', labelKey: 'status.cancelled' },
];

const STATUS_FILTER = [
  { value: 'Complete',  labelKey: 'status.complete' },
  { value: 'all',       labelKey: 'common.total' },
  { value: 'Checker',   labelKey: 'status.checker' },
  { value: 'WeighOut',  labelKey: 'status.weighOut' },
];

export default function Records() {
  const { t } = useLang();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [filterDate, setFilterDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Complete');
  const [page, setPage] = useState(1);

  const [editModal, setEditModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshingTimeline, setRefreshingTimeline] = useState({});

  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custTimer = useRef(null);

  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedTripIds, setExpandedTripIds] = useState(new Set());
  const [timeline, setTimeline] = useState({});

  const fmtKg = (v) => {
    if (v == null) return '-';
    return `${parseFloat(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${t('unit.kg')}`;
  };

  const fmtMin = (m) => {
    if (m == null || m < 0) return null;
    if (m < 60) return `${m} ${t('unit.minutes')}`;
    return `${Math.floor(m / 60)} ${t('unit.hours')} ${m % 60} ${t('unit.minutes')}`;
  };

  useEffect(() => { fetchVehicleTypes(); }, []);

  const fetchVehicleTypes = async () => {
    try { const res = await api.get('/master/vehicle-types'); setVehicleTypes(res.data.data || []); } catch {}
  };

  const fetchRecords = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (filterDate) params.set('date', filterDate);
      if (filterSearch) params.set('search', filterSearch);
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/records?${params}`);
      setRecords(res.data.data || []);
      setSelectedIds(new Set());
      setLastUpdate(new Date());
      setPagination(res.data.pagination || { total: 0, page: p, limit: 20, totalPages: 1 });
    } catch {
      toast.error(t('common.noData'));
    } finally { setLoading(false); }
  }, [filterDate, filterSearch, filterStatus, page]);

  useEffect(() => { fetchRecords(page); }, [page]);

  const handleSearch = () => { setPage(1); fetchRecords(1); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  const onCustQueryChange = (val) => {
    setCustQuery(val);
    clearTimeout(custTimer.current);
    if (!val.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    custTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/customers?q=${encodeURIComponent(val)}`);
        const list = (res.data.data || []).slice(0, 8);
        setCustResults(list);
        setShowCustDrop(list.length > 0);
      } catch {}
    }, 200);
  };

  const pickCustomer = (c) => {
    setEditForm(f => ({ ...f, customerId: c.CustomerID, customerName: c.CustomerName }));
    setCustQuery(c.CustomerName);
    setShowCustDrop(false);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      licensePlate: row.LicensePlate || '',
      vehicleTypeId: row.VehicleTypeID || '',
      customerId: row.CustomerID || null,
      customerName: row.CustomerName || '',
      priority: row.Priority || 'ปกติ',
      status: row.Status || '',
      tripDate: row.TripDate ? dayjs(row.TripDate).format('YYYY-MM-DD') : '',
      weighInTime: row.WeighInTime ? dayjs(row.WeighInTime).format('HH:mm') : '',
      tareWeight: row.TareWeight != null ? row.TareWeight : '',
      weighOutTime: row.WeighOutTime ? dayjs(row.WeighOutTime).format('HH:mm') : '',
      grossWeight: row.GrossWeight != null ? row.GrossWeight : '',
      pickDocumentNo: row.PickDocumentNo || '',
      isApproved: row.IsApproved === true || row.IsApproved === 1 ? '1'
                : row.IsApproved === false || row.IsApproved === 0 ? '0' : '',
      completedAtTime: row.CompletedAt ? dayjs(row.CompletedAt).format('HH:mm') : '',
      checkerRemarks: row.CheckerRemarks || '',
    });
    setCustQuery(row.CustomerName || '');
    setShowCustDrop(false);
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await api.put(`/records/${editRow.TripID}`, editForm);
      toast.success(t('common.save'));
      setEditModal(false);
      setTimeline(tl => { const n = { ...tl }; delete n[editRow.TripID]; return n; });
      fetchRecords(page);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setSaving(false); }
  };

  const refreshTimeline = async (tripId) => {
    setRefreshingTimeline(r => ({ ...r, [tripId]: true }));
    setTimeline(tl => { const n = { ...tl }; delete n[tripId]; return n; });
    try {
      const res = await api.get(`/records/${tripId}/timeline`);
      if (res.data.success) setTimeline(tl => ({ ...tl, [tripId]: res.data.data }));
    } catch {} finally { setRefreshingTimeline(r => ({ ...r, [tripId]: false })); }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const toggleSelectAll = () => {
    const allSelected = records.length > 0 && records.every(r => selectedIds.has(r.TripID));
    setSelectedIds(allSelected ? new Set() : new Set(records.map(r => r.TripID)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`${t('common.confirm')} ${t('common.delete')} ${selectedIds.size}?`)) return;
    setBulkDeleting(true);
    let success = 0, fail = 0;
    for (const id of selectedIds) {
      try { await api.delete(`/records/${id}`); success++; } catch { fail++; }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (success > 0) toast.success(`${t('common.delete')} ${success}`);
    else toast.error(t('common.noData'));
    fetchRecords(page);
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await api.delete(`/records/${deleteRow.TripID}`);
      toast.success(`Trip #${deleteRow.TripID}`);
      setDeleteRow(null);
      fetchRecords(page);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.noData'));
    } finally { setDeleting(false); }
  };

  const toggleExpand = async (tripId) => {
    setExpandedTripIds(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) { next.delete(tripId); return next; }
      next.add(tripId);
      return next;
    });
    if (!timeline[tripId]) {
      try {
        const res = await api.get(`/records/${tripId}/timeline`);
        if (res.data.success) setTimeline(tl => ({ ...tl, [tripId]: res.data.data }));
      } catch {}
    }
  };

  const netWeight = editForm.grossWeight !== '' && editForm.tareWeight !== ''
    ? (parseFloat(editForm.grossWeight || 0) - parseFloat(editForm.tareWeight || 0)).toFixed(2)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-500 flex-shrink-0" />
            {t('records.title')}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={() => fetchRecords(page)} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 border border-slate-200 bg-white transition-colors flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div>
            <label className="label">{t('records.filterDate')}</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="input-field h-9 text-sm w-full" />
          </div>
          <div>
            <label className="label">{t('records.filterSearch')}</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('records.searchPlaceholder')}
                className="input-field h-9 text-sm pl-8 w-full" />
            </div>
          </div>
          <div>
            <label className="label">{t('records.filterStatus')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field h-9 text-sm w-full">
              {STATUS_FILTER.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
            </select>
          </div>
          <button onClick={handleSearch} className="btn-primary h-9 px-4 text-sm w-full">{t('records.searchBtn')}</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {t('records.total').replace('{n}', pagination.total)}
          </span>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('records.selected').replace('{n}', selectedIds.size)}</span>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: '#dc2626' }}>
                {bulkDeleting
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={13} />}
                {t('records.deleteSelected')}
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" text={t('common.loading')} />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
            <p>{t('records.noRecords')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-header px-3 py-2 text-center w-8 hide-mobile">
                    <input type="checkbox"
                      checked={records.length > 0 && records.every(r => selectedIds.has(r.TripID))}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 cursor-pointer accent-red-600" />
                  </th>
                  <th className="table-header px-4 py-2 text-left w-8"></th>
                  <th className="table-header px-3 py-2 text-left">#</th>
                  <th className="table-header px-3 py-2 text-left">{t('records.colDate')}</th>
                  <th className="table-header px-3 py-2 text-left">{t('records.colPlate')}</th>
                  <th className="table-header px-3 py-2 text-left">{t('records.colCustomer')}</th>
                  <th className="table-header px-3 py-2 text-right hide-mobile">{t('records.colTare')}</th>
                  <th className="table-header px-3 py-2 text-right hide-mobile">{t('records.colGross')}</th>
                  <th className="table-header px-3 py-2 text-right">{t('records.colNet')}</th>
                  <th className="table-header px-3 py-2 text-center hide-mobile">{t('records.colResult')}</th>
                  <th className="table-header px-3 py-2 text-left hide-mobile">{t('records.colCompleted')}</th>
                  <th className="table-header px-3 py-2 text-center">{t('records.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map(row => (
                  <>
                    <tr key={row.TripID} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedIds.has(row.TripID) ? 'bg-red-50/50' : ''}`}>
                      <td className="px-3 py-2 text-center hide-mobile">
                        <input type="checkbox" checked={selectedIds.has(row.TripID)} onChange={() => toggleSelect(row.TripID)} className="w-3.5 h-3.5 cursor-pointer accent-red-600" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => toggleExpand(row.TripID)} className="p-0.5 rounded text-slate-400 hover:text-blue-500 transition-colors">
                          {expandedTripIds.has(row.TripID) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono">#{row.TripID}</td>
                      <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">
                        {row.TripDate ? new Date(row.TripDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900 text-sm whitespace-nowrap">{row.LicensePlate}</div>
                        <div className="text-xs text-slate-400">{row.VehicleType}</div>
                      </td>
                      <td className="px-3 py-2 max-w-[110px]">
                        <div className="text-sm text-slate-700 truncate" title={row.CustomerName}>{row.CustomerName || '-'}</div>
                        {row.PickDocumentNo && <div className="text-xs text-purple-500 font-mono truncate">{row.PickDocumentNo}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-slate-600 hide-mobile">{fmtKg(row.TareWeight)}</td>
                      <td className="px-3 py-2 text-right text-sm text-slate-600 hide-mobile">{fmtKg(row.GrossWeight)}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-700 whitespace-nowrap">{fmtKg(row.NetWeight)}</td>
                      <td className="px-3 py-2 text-center hide-mobile">
                        {row.IsApproved === true || row.IsApproved === 1
                          ? <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                          : row.IsApproved === false || row.IsApproved === 0
                            ? <XCircle size={16} className="text-red-400 mx-auto" />
                            : <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap hide-mobile">{formatDateTime(row.CompletedAt)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title={t('common.edit')}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteRow(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title={t('common.delete')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTripIds.has(row.TripID) && (() => {
                      const tl = timeline[row.TripID];
                      return (
                        <tr key={`exp-${row.TripID}`}>
                          <td colSpan={12} className="p-0">
                            <div className="mx-2 mb-2 rounded-xl border-2 border-blue-100 overflow-hidden"
                              style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)' }}>
                              <div className="px-5 py-3">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                    ⏱ {t('records.timelineTitle')}
                                  </p>
                                  <button onClick={() => refreshTimeline(row.TripID)}
                                    disabled={refreshingTimeline[row.TripID]}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-white disabled:opacity-50">
                                    <RefreshCw size={11} className={refreshingTimeline[row.TripID] ? 'animate-spin' : ''} />
                                    {refreshingTimeline[row.TripID] ? t('records.calculating') : t('records.recalculate')}
                                  </button>
                                </div>
                                {!tl ? (
                                  <p className="text-xs text-slate-400">{t('common.loading')}</p>
                                ) : (
                                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                                    <div className="bg-white rounded-xl border border-purple-100 px-4 py-2.5 sm:min-w-44">
                                      <p className="text-xs font-bold text-purple-600 mb-1.5">📋 {t('records.dataStation')}</p>
                                      {tl.pickWaitMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">{t('records.waitPickDoc')}</span>
                                          <span className="font-semibold text-slate-700">{fmtMin(tl.pickWaitMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">{t('records.noData')}</p>
                                      )}
                                      {tl.hasSOWait && tl.soWaitMinutes != null && (
                                        <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                          <span className="text-rose-500">{t('records.waitSODoc')}</span>
                                          <span className="font-semibold text-rose-600">{fmtMin(tl.soWaitMinutes)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {(tl.stations || []).length > 0
                                      ? (tl.stations || []).map((s, i) => (
                                          <div key={i} className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 sm:min-w-44">
                                            <p className="text-xs font-bold text-amber-600 mb-1.5">📦 {s.StationName}</p>
                                            <div className="flex items-center justify-between gap-4 text-xs">
                                              <span className="text-slate-500">{t('records.loading2')}</span>
                                              <span className="font-semibold text-amber-700">
                                                {s.DurationMinutes != null ? fmtMin(s.DurationMinutes) : <span className="text-amber-500">{t('records.loadingActive')}</span>}
                                              </span>
                                            </div>
                                          </div>
                                        ))
                                      : (
                                          <div className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 sm:min-w-44">
                                            <p className="text-xs font-bold text-amber-600 mb-1.5">📦 {t('records.loadingStation')}</p>
                                            <p className="text-xs text-slate-400">{t('records.noData')}</p>
                                          </div>
                                        )
                                    }

                                    <div className="bg-white rounded-xl border border-cyan-100 px-4 py-2.5 sm:min-w-44">
                                      <p className="text-xs font-bold text-cyan-600 mb-1.5">⚖️ {t('records.weighOutStation')}</p>
                                      {tl.weighOutWaitMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">{t('records.waitWeighOut')}</span>
                                          <span className="font-semibold text-cyan-700">{fmtMin(tl.weighOutWaitMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">{t('records.noData')}</p>
                                      )}
                                    </div>

                                    <div className="bg-white rounded-xl border border-orange-100 px-4 py-2.5 sm:min-w-44">
                                      <p className="text-xs font-bold text-orange-600 mb-1.5">✅ {t('records.checkerStation')}</p>
                                      {tl.checkerMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">{t('records.checkerTime')}</span>
                                          <span className="font-semibold text-orange-700">{fmtMin(tl.checkerMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">{t('records.noData')}</p>
                                      )}
                                    </div>

                                    {(() => {
                                      const total = (tl.pickWaitMinutes ?? 0)
                                        + (tl.hasSOWait ? (tl.soWaitMinutes ?? 0) : 0)
                                        + (tl.stations || []).reduce((s, st) => s + (st.DurationMinutes ?? 0), 0)
                                        + (tl.weighOutWaitMinutes ?? 0)
                                        + (tl.checkerMinutes ?? 0);
                                      if (total === 0) return null;
                                      return (
                                        <div className="bg-white rounded-xl border-2 border-blue-200 px-4 py-2.5 sm:min-w-44">
                                          <p className="text-xs font-bold text-blue-600 mb-1.5">⏱ {t('records.totalStations')}</p>
                                          <div className="flex items-center justify-between gap-4 text-xs">
                                            <span className="text-slate-500">{t('records.totalWorkTime')}</span>
                                            <span className="font-bold text-blue-700 text-sm">{fmtMin(total)}</span>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {tl.totalTripMinutes != null && (
                                      <div className="bg-white rounded-xl border border-indigo-100 px-4 py-2.5 sm:min-w-44">
                                        <p className="text-xs font-bold text-indigo-600 mb-1.5">🚛 {t('records.totalInWarehouse')}</p>
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">{t('records.weighInToChecker')}</span>
                                          <span className="font-bold text-indigo-700 text-sm">{fmtMin(tl.totalTripMinutes)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {row.CheckerRemarks && (
                                  <p className="text-xs text-slate-500 mt-2.5 border-t border-blue-100 pt-2">
                                    {t('records.checkerRemarks')} <span className="text-slate-700">{row.CheckerRemarks}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('records.page').replace('{p}', pagination.page).replace('{total}', pagination.totalPages)}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && editRow && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{t('records.editTitle').replace('{n}', editRow.TripID)}</h3>
              <button onClick={() => setEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('records.vehicleInfo')}</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('common.date')}</label>
                      <input type="date" value={editForm.tripDate} onChange={e => setEditForm(f => ({ ...f, tripDate: e.target.value }))} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">{t('common.licensePlate')}</label>
                      <input value={editForm.licensePlate} onChange={e => setEditForm(f => ({ ...f, licensePlate: e.target.value }))} className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('common.vehicleType')}</label>
                    <select value={editForm.vehicleTypeId || ''} onChange={e => setEditForm(f => ({ ...f, vehicleTypeId: e.target.value ? parseInt(e.target.value) : null }))} className="input-field w-full">
                      <option value="">-- {t('common.select')} --</option>
                      {vehicleTypes.map(vt => <option key={vt.TypeID} value={vt.TypeID}>{vt.TypeName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('common.customer')}</label>
                    <div className="relative">
                      <input value={custQuery} onChange={e => onCustQueryChange(e.target.value)}
                        onFocus={() => custQuery && setCustResults(custResults)}
                        placeholder={t('weighIn.customerPlaceholder')}
                        className="input-field w-full" />
                      {showCustDrop && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                          {custResults.map(c => (
                            <button key={c.CustomerID} type="button" onMouseDown={() => pickCustomer(c)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                              <div className="text-sm font-semibold text-slate-900">{c.ARCode}</div>
                              <div className="text-xs text-slate-500">{c.CustomerName}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('common.priority')}</label>
                      <select value={editForm.priority || 'ปกติ'} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="input-field w-full">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('common.status')}</label>
                      <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="input-field w-full">
                        {TRIP_STATUSES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('common.weight')}</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('weighIn.entryTime')}</label>
                      <input type="time" value={editForm.weighInTime} onChange={e => setEditForm(f => ({ ...f, weighInTime: e.target.value }))} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">{t('weighOut.weighOutTime')}</label>
                      <input type="time" value={editForm.weighOutTime} onChange={e => setEditForm(f => ({ ...f, weighOutTime: e.target.value }))} className="input-field w-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('weighIn.tareWeightLabel')}</label>
                      <input type="number" step="0.01" value={editForm.tareWeight} onChange={e => setEditForm(f => ({ ...f, tareWeight: e.target.value }))} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">{t('weighOut.grossWeightLabel')}</label>
                      <input type="number" step="0.01" value={editForm.grossWeight} onChange={e => setEditForm(f => ({ ...f, grossWeight: e.target.value }))} className="input-field w-full" />
                    </div>
                  </div>
                  {netWeight !== null && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
                      <span className="text-emerald-600 font-medium">{t('common.netWeight')}: </span>
                      <span className="text-emerald-800 font-bold">{netWeight} {t('unit.kg')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('common.document')}</p>
                <div>
                  <label className="label">{t('common.document')}</label>
                  <input value={editForm.pickDocumentNo} onChange={e => setEditForm(f => ({ ...f, pickDocumentNo: e.target.value }))} className="input-field w-full" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('records.checkerStation')}</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('records.colResult')}</label>
                      <select value={editForm.isApproved} onChange={e => setEditForm(f => ({ ...f, isApproved: e.target.value }))} className="input-field w-full">
                        <option value="">--</option>
                        <option value="1">{t('checker.pass')}</option>
                        <option value="0">{t('checker.fail')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('weighOut.weighOutTime')}</label>
                      <input type="time" value={editForm.completedAtTime} onChange={e => setEditForm(f => ({ ...f, completedAtTime: e.target.value }))} className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('records.checkerRemarks')}</label>
                    <textarea value={editForm.checkerRemarks} onChange={e => setEditForm(f => ({ ...f, checkerRemarks: e.target.value }))} className="input-field resize-none w-full" rows={2} />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('common.save')}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary px-5">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteRow && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{t('common.confirm')}</h3>
                  <p className="text-sm text-slate-500">Trip #{deleteRow.TripID} — {deleteRow.LicensePlate}</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1 py-2.5">
                {deleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Trash2 size={14} />{t('common.delete')}</>}
              </button>
              <button onClick={() => setDeleteRow(null)} className="btn-secondary px-5">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
