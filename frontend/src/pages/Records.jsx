import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, RefreshCw, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';
import dayjs from 'dayjs';
import LoadingSpinner from '../components/LoadingSpinner';

const PRIORITIES = ['ปกติ', 'ด่วน', 'ด่วนมาก'];

const TRIP_STATUSES = [
  { value: 'WeighIn',  label: 'ชั่งเข้า' },
  { value: 'Data',     label: 'รอเอกสาร Pick' },
  { value: 'WaitPick', label: 'รอหยิบสินค้า' },
  { value: 'Loading',  label: 'กำลังขึ้นสินค้า' },
  { value: 'WeighOut', label: 'รอชั่งออก' },
  { value: 'Checker',  label: 'รอเช็คเกอร์' },
  { value: 'Complete', label: 'เสร็จสิ้น' },
  { value: 'Cancelled',label: 'ยกเลิก' },
];

const STATUS_OPTIONS = [
  { value: 'Complete', label: 'เสร็จสิ้น' },
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'Checker', label: 'รอเช็คเกอร์' },
  { value: 'WeighOut', label: 'รอชั่งออก' },
];

function fmtKg(v) {
  if (v == null) return '-';
  return `${parseFloat(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`;
}

export default function Records() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [filterDate, setFilterDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Complete');
  const [page, setPage] = useState(1);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Customer search in edit modal
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custTimer = useRef(null);

  // VehicleTypes for dropdown
  const [vehicleTypes, setVehicleTypes] = useState([]);

  // Delete confirm
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Expand / flip timeline
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState({});
  const [timeline, setTimeline] = useState({});

  useEffect(() => {
    fetchVehicleTypes();
  }, []);

  const fetchVehicleTypes = async () => {
    try {
      const res = await api.get('/master/vehicle-types');
      setVehicleTypes(res.data.data || []);
    } catch {}
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
      setLastUpdate(new Date());
      setPagination(res.data.pagination || { total: 0, page: p, limit: 20, totalPages: 1 });
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterSearch, filterStatus, page]);

  useEffect(() => {
    fetchRecords(page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchRecords(1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Customer autocomplete
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
      toast.success('อัปเดตข้อมูลสำเร็จ');
      setEditModal(false);
      // clear timeline cache ของ trip นี้ เพื่อให้คำนวณใหม่เมื่อกดดู
      setTimeline(t => { const n = { ...t }; delete n[editRow.TripID]; return n; });
      fetchRecords(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const refreshTimeline = async (tripId) => {
    setTimeline(t => { const n = { ...t }; delete n[tripId]; return n; });
    try {
      const res = await api.get(`/records/${tripId}/timeline`);
      if (res.data.success) setTimeline(t => ({ ...t, [tripId]: res.data.data }));
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await api.delete(`/records/${deleteRow.TripID}`);
      toast.success(`ลบ Trip #${deleteRow.TripID} สำเร็จ`);
      setDeleteRow(null);
      fetchRecords(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = async (tripId) => {
    if (expandedTripId === tripId) { setExpandedTripId(null); return; }
    setExpandedTripId(tripId);
    if (!timeline[tripId]) {
      try {
        const res = await api.get(`/records/${tripId}/timeline`);
        if (res.data.success) setTimeline(t => ({ ...t, [tripId]: res.data.data }));
      } catch {}
    }
  };

  const fmtMin = (m) => {
    if (m == null || m < 0) return null;
    if (m < 60) return `${m} นาที`;
    return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
  };

  const netWeight = editForm.grossWeight !== '' && editForm.tareWeight !== ''
    ? (parseFloat(editForm.grossWeight || 0) - parseFloat(editForm.tareWeight || 0)).toFixed(2)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-500 flex-shrink-0" />
            บันทึกการขึ้นสินค้า
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={() => fetchRecords(page)} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 border border-slate-200 bg-white transition-colors flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div>
            <label className="label">วันที่</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="input-field h-9 text-sm w-full" />
          </div>
          <div>
            <label className="label">ค้นหา</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ทะเบียน / ลูกค้า..."
                className="input-field h-9 text-sm pl-8 w-full" />
            </div>
          </div>
          <div>
            <label className="label">สถานะ</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field h-9 text-sm w-full">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={handleSearch} className="btn-primary h-9 px-4 text-sm w-full">ค้นหา</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            ทั้งหมด <span className="text-emerald-600">{pagination.total}</span> รายการ
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" text="กำลังโหลด..." />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
            <p>ไม่มีข้อมูล</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-header px-4 py-2 text-left w-8"></th>
                  <th className="table-header px-4 py-2 text-left">#</th>
                  <th className="table-header px-4 py-2 text-left">วันที่</th>
                  <th className="table-header px-4 py-2 text-left">ทะเบียน</th>
                  <th className="table-header px-4 py-2 text-left">ลูกค้า</th>
                  <th className="table-header px-4 py-2 text-right">น้ำหนักเบา</th>
                  <th className="table-header px-4 py-2 text-right">น้ำหนักหนัก</th>
                  <th className="table-header px-4 py-2 text-right">น้ำหนักสุทธิ</th>
                  <th className="table-header px-4 py-2 text-center">ผลตรวจ</th>
                  <th className="table-header px-4 py-2 text-left">เสร็จสิ้น</th>
                  <th className="table-header px-4 py-2 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {records.map(row => (
                  <>
                    <tr key={row.TripID} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => toggleExpand(row.TripID)}
                          className="p-0.5 rounded text-slate-400 hover:text-blue-500 transition-colors">
                          {expandedTripId === row.TripID ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400 font-mono">#{row.TripID}</td>
                      <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                        {row.TripDate ? new Date(row.TripDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-bold text-slate-900 text-sm">{row.LicensePlate}</div>
                        <div className="text-xs text-slate-400">{row.VehicleType}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm text-slate-700">{row.CustomerName || '-'}</div>
                        {row.PickDocumentNo && <div className="text-xs text-purple-500 font-mono">{row.PickDocumentNo}</div>}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-600">{fmtKg(row.TareWeight)}</td>
                      <td className="px-4 py-2 text-right text-sm text-slate-600">{fmtKg(row.GrossWeight)}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-emerald-700">{fmtKg(row.NetWeight)}</td>
                      <td className="px-4 py-2 text-center">
                        {row.IsApproved === true || row.IsApproved === 1
                          ? <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                          : row.IsApproved === false || row.IsApproved === 0
                            ? <XCircle size={16} className="text-red-400 mx-auto" />
                            : <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(row.CompletedAt)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            title="แก้ไข">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteRow(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="ลบ">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTripId === row.TripID && (() => {
                      const tl = timeline[row.TripID];
                      return (
                        <tr key={`exp-${row.TripID}`}>
                          <td colSpan={11} className="p-0">
                            <div className="mx-2 mb-2 rounded-xl border-2 border-blue-100 overflow-hidden"
                              style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)', animation: 'fadeIn 0.25s ease-out' }}>
                              <div className="px-5 py-3">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                    ⏱ สรุปเวลาแต่ละขั้นตอน
                                  </p>
                                  <button onClick={() => refreshTimeline(row.TripID)}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-white">
                                    <RefreshCw size={11} />คำนวณใหม่
                                  </button>
                                </div>
                                {!tl ? (
                                  <p className="text-xs text-slate-400">กำลังโหลด...</p>
                                ) : (
                                  <div className="flex flex-wrap gap-3">

                                    {/* 1. สถานี Data */}
                                    <div className="bg-white rounded-xl border border-purple-100 px-4 py-2.5 min-w-44">
                                      <p className="text-xs font-bold text-purple-600 mb-1.5">📋 สถานี Data</p>
                                      {tl.pickWaitMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">รอเอกสาร Pick</span>
                                          <span className="font-semibold text-slate-700">{fmtMin(tl.pickWaitMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                                      )}
                                      {tl.hasSOWait && tl.soWaitMinutes != null && (
                                        <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                          <span className="text-rose-500">รอเอกสาร SO</span>
                                          <span className="font-semibold text-rose-600">{fmtMin(tl.soWaitMinutes)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* 2. สถานีขึ้นสินค้า */}
                                    {(tl.stations || []).length > 0
                                      ? (tl.stations || []).map((s, i) => (
                                          <div key={i} className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 min-w-44">
                                            <p className="text-xs font-bold text-amber-600 mb-1.5">📦 สถานี {s.StationName}</p>
                                            <div className="flex items-center justify-between gap-4 text-xs">
                                              <span className="text-slate-500">ขึ้นสินค้า</span>
                                              <span className="font-semibold text-amber-700">
                                                {s.DurationMinutes != null ? fmtMin(s.DurationMinutes) : <span className="text-amber-500">กำลังขึ้น...</span>}
                                              </span>
                                            </div>
                                          </div>
                                        ))
                                      : (
                                          <div className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 min-w-44">
                                            <p className="text-xs font-bold text-amber-600 mb-1.5">📦 สถานีขึ้นสินค้า</p>
                                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                                          </div>
                                        )
                                    }

                                    {/* 3. สถานีชั่งออก */}
                                    <div className="bg-white rounded-xl border border-cyan-100 px-4 py-2.5 min-w-44">
                                      <p className="text-xs font-bold text-cyan-600 mb-1.5">⚖️ สถานีชั่งออก</p>
                                      {tl.weighOutWaitMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">รอชั่งออก</span>
                                          <span className="font-semibold text-cyan-700">{fmtMin(tl.weighOutWaitMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                                      )}
                                    </div>

                                    {/* 4. สถานีเช็คเกอร์ */}
                                    <div className="bg-white rounded-xl border border-orange-100 px-4 py-2.5 min-w-44">
                                      <p className="text-xs font-bold text-orange-600 mb-1.5">✅ สถานีเช็คเกอร์</p>
                                      {tl.checkerMinutes != null ? (
                                        <div className="flex items-center justify-between gap-4 text-xs">
                                          <span className="text-slate-500">ตรวจสินค้า</span>
                                          <span className="font-semibold text-orange-700">{fmtMin(tl.checkerMinutes)}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                                      )}
                                    </div>

                                  </div>
                                )}
                                {row.CheckerRemarks && (
                                  <p className="text-xs text-slate-500 mt-2.5 border-t border-blue-100 pt-2">
                                    หมายเหตุเช็คเกอร์: <span className="text-slate-700">{row.CheckerRemarks}</span>
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">หน้า {pagination.page} / {pagination.totalPages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); }}
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
              <button disabled={page >= pagination.totalPages} onClick={() => { setPage(p => p + 1); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && editRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">แก้ไขข้อมูล Trip #{editRow.TripID}</h3>
              <button onClick={() => setEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5">

              {/* ── ข้อมูลรถ ── */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ข้อมูลรถ</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">วันที่</label>
                      <input type="date" value={editForm.tripDate}
                        onChange={e => setEditForm(f => ({ ...f, tripDate: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">ทะเบียน</label>
                      <input value={editForm.licensePlate}
                        onChange={e => setEditForm(f => ({ ...f, licensePlate: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="label">ประเภทรถ</label>
                    <select value={editForm.vehicleTypeId || ''}
                      onChange={e => setEditForm(f => ({ ...f, vehicleTypeId: e.target.value ? parseInt(e.target.value) : null }))}
                      className="input-field w-full">
                      <option value="">-- เลือกประเภทรถ --</option>
                      {vehicleTypes.map(vt => <option key={vt.TypeID} value={vt.TypeID}>{vt.TypeName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ลูกค้า</label>
                    <div className="relative">
                      <input value={custQuery} onChange={e => onCustQueryChange(e.target.value)}
                        onFocus={() => custQuery && setCustResults(custResults)}
                        placeholder="ค้นหาลูกค้า..."
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
                      <label className="label">ลำดับความสำคัญ</label>
                      <select value={editForm.priority || 'ปกติ'}
                        onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                        className="input-field w-full">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">สถานะ</label>
                      <select value={editForm.status || ''}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                        className="input-field w-full">
                        {TRIP_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── การชั่งน้ำหนัก ── */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">การชั่งน้ำหนัก</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">เวลาชั่งเข้า</label>
                      <input type="time" value={editForm.weighInTime}
                        onChange={e => setEditForm(f => ({ ...f, weighInTime: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">เวลาชั่งออก</label>
                      <input type="time" value={editForm.weighOutTime}
                        onChange={e => setEditForm(f => ({ ...f, weighOutTime: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">น้ำหนักเบา (กก.)</label>
                      <input type="number" step="0.01" value={editForm.tareWeight}
                        onChange={e => setEditForm(f => ({ ...f, tareWeight: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label">น้ำหนักหนัก (กก.)</label>
                      <input type="number" step="0.01" value={editForm.grossWeight}
                        onChange={e => setEditForm(f => ({ ...f, grossWeight: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                  </div>
                  {netWeight !== null && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
                      <span className="text-emerald-600 font-medium">น้ำหนักสุทธิ: </span>
                      <span className="text-emerald-800 font-bold">{netWeight} กก.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── เอกสาร ── */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">เอกสาร</p>
                <div>
                  <label className="label">เลขเอกสาร Pick</label>
                  <input value={editForm.pickDocumentNo}
                    onChange={e => setEditForm(f => ({ ...f, pickDocumentNo: e.target.value }))}
                    className="input-field w-full" placeholder="เช่น PK-2025-0001" />
                </div>
              </div>

              {/* ── เช็คเกอร์ ── */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">เช็คเกอร์</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">ผลตรวจ</label>
                      <select value={editForm.isApproved}
                        onChange={e => setEditForm(f => ({ ...f, isApproved: e.target.value }))}
                        className="input-field w-full">
                        <option value="">-- ยังไม่ได้ตรวจ --</option>
                        <option value="1">ผ่าน</option>
                        <option value="0">ไม่ผ่าน</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">เวลาอนุมัติ</label>
                      <input type="time" value={editForm.completedAtTime}
                        onChange={e => setEditForm(f => ({ ...f, completedAtTime: e.target.value }))}
                        className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="label">หมายเหตุเช็คเกอร์</label>
                    <textarea value={editForm.checkerRemarks}
                      onChange={e => setEditForm(f => ({ ...f, checkerRemarks: e.target.value }))}
                      className="input-field resize-none w-full" rows={2} />
                  </div>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'บันทึก'}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary px-5">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">ยืนยันการลบ</h3>
                  <p className="text-sm text-slate-500">Trip #{deleteRow.TripID} — {deleteRow.LicensePlate}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                การลบจะลบข้อมูลทั้งหมดที่เกี่ยวข้อง (ชั่งเข้า, ชั่งออก, สถานีขึ้นสินค้า, เช็คเกอร์) อย่างถาวร
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1 py-2.5">
                {deleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'ลบถาวร'}
              </button>
              <button onClick={() => setDeleteRow(null)} className="btn-secondary px-5">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
