import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  ArrowRight, Package, CheckCircle2, Plus,
  ChevronDown, ChevronUp, X, Edit2, Trash2,
  RefreshCw, Building2, Layers, Clock, Truck, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import dayjs from 'dayjs';

const JOB_STATUS = {
  PENDING:     { label: 'รอดำเนินการ',  color: '#f59e0b', bg: '#fffbeb' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: '#3b82f6', bg: '#eff6ff' },
  COMPLETE:    { label: 'เสร็จสิ้น',    color: '#10b981', bg: '#f0fdf4' },
  CANCELLED:   { label: 'ยกเลิก',       color: '#6b7280', bg: '#f9fafb' },
};

const TRIP_STATUS = {
  PENDING:      { label: 'รอเริ่ม',             color: '#9ca3af' },
  SOURCE_ENTRY: { label: 'เข้าต้นทางแล้ว',      color: '#f59e0b' },
  SOURCE_EXIT:  { label: 'ออกต้นทาง/กำลังขนส่ง', color: '#3b82f6' },
  DEST_ENTRY:   { label: 'เข้าปลายทางแล้ว',     color: '#8b5cf6' },
  COMPLETE:     { label: 'เสร็จแล้ว',           color: '#10b981' },
};

const PRIORITY_LABEL = { NORMAL: 'ปกติ', HIGH: 'เร่งด่วน', URGENT: 'ด่วนมาก' };
const PRIORITY_COLOR = { NORMAL: '#6b7280', HIGH: '#f59e0b', URGENT: '#ef4444' };

export default function Transfer() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [stations, setStations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignJobId, setAssignJobId] = useState(null);
  const [assignForm, setAssignForm] = useState({ operatorId: '', vehicleId: '' });
  const [editStation, setEditStation] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [savingJob, setSavingJob] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ vehiclePlate: '', vehicleName: '' });

  // Product search for job form
  const [prodQuery, setProdQuery] = useState('');
  const [prodResults, setProdResults] = useState([]);
  const [showProdDrop, setShowProdDrop] = useState(false);
  const prodTimer = useRef(null);

  const [jobForm, setJobForm] = useState({
    sourceStationId: '', destStationId: '', productDesc: '',
    plannedBundles: '', plannedWeightKg: '', priority: 'NORMAL', notes: ''
  });
  const [stationForm, setStationForm] = useState({
    stationCode: '', stationName: '', stationType: 'BOTH', sortOrder: 0
  });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/transfer/jobs${params}`);
      if (res.data.success) setJobs(res.data.data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadStations = useCallback(async () => {
    try {
      const res = await api.get('/master/loading-stations');
      if (res.data.success) setStations(res.data.data);
    } catch {}
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await api.get('/transfer/vehicles');
      if (res.data.success) setVehicles(res.data.data);
    } catch {}
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      if (res.data.success) setUsers(res.data.data);
    } catch {}
  }, []);

  useEffect(() => { loadJobs(); loadStations(); loadVehicles(); loadUsers(); }, [loadJobs, loadStations, loadVehicles, loadUsers]);

  const toggleJobDetail = async (jobId) => {
    if (expandedJob === jobId) {
      setExpandedJob(null); setJobDetail(null); return;
    }
    try {
      const res = await api.get(`/transfer/jobs/${jobId}`);
      if (res.data.success) { setJobDetail(res.data); setExpandedJob(jobId); }
    } catch {}
  };

  const createJob = async () => {
    if (!jobForm.sourceStationId || !jobForm.destStationId || !jobForm.productDesc.trim()) {
      toast.error('กรุณากรอกสถานีต้นทาง ปลายทาง และรายละเอียดสินค้า');
      return;
    }
    setSavingJob(true);
    try {
      const res = await api.post('/transfer/jobs', {
        sourceStationId: parseInt(jobForm.sourceStationId),
        destStationId: parseInt(jobForm.destStationId),
        productDesc: jobForm.productDesc,
        plannedBundles: jobForm.plannedBundles ? parseInt(jobForm.plannedBundles) : null,
        plannedWeightKg: jobForm.plannedWeightKg ? parseFloat(jobForm.plannedWeightKg) : null,
        priority: jobForm.priority,
        notes: jobForm.notes || null,
      });
      if (res.data.success) {
        toast.success(`สร้างงาน ${res.data.jobCode} สำเร็จ`);
        setShowCreateJob(false);
        setJobForm({ sourceStationId: '', destStationId: '', productDesc: '', plannedBundles: '', plannedWeightKg: '', priority: 'NORMAL', notes: '' });
        setProdQuery(''); setProdResults([]);
        loadJobs();
      }
    } catch {
      toast.error('ไม่สามารถสร้างงานได้');
    } finally {
      setSavingJob(false);
    }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      await api.put(`/transfer/jobs/${jobId}/status`, { status });
      toast.success(status === 'COMPLETE' ? 'ปิดงานเรียบร้อย' : 'ยกเลิกงานเรียบร้อย');
      if (expandedJob === jobId) { setExpandedJob(null); setJobDetail(null); }
      loadJobs();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const saveStation = async () => {
    if (!stationForm.stationCode.trim() || !stationForm.stationName.trim()) {
      toast.error('กรุณากรอกรหัสและชื่อสถานี');
      return;
    }
    setSavingStation(true);
    try {
      if (editStation) {
        await api.put(`/transfer/stations/${editStation.StationID}`, stationForm);
        toast.success('แก้ไขสถานีสำเร็จ');
      } else {
        await api.post('/transfer/stations', stationForm);
        toast.success('เพิ่มสถานีสำเร็จ');
      }
      setShowStationModal(false);
      setEditStation(null);
      setStationForm({ stationCode: '', stationName: '', stationType: 'BOTH', sortOrder: 0 });
      loadStations();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSavingStation(false);
    }
  };

  const openEditStation = (s) => {
    setEditStation(s);
    setStationForm({ stationCode: s.StationCode, stationName: s.StationName, stationType: s.StationType, sortOrder: s.SortOrder });
    setShowStationModal(true);
  };

  const deleteStation = async (id) => {
    if (!confirm('ต้องการลบสถานีนี้?')) return;
    try {
      await api.delete(`/transfer/stations/${id}`);
      toast.success('ลบสถานีสำเร็จ');
      loadStations();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const saveVehicle = async () => {
    if (!vehicleForm.vehiclePlate.trim()) {
      toast.error('กรุณากรอกทะเบียนรถ');
      return;
    }
    setSavingVehicle(true);
    try {
      if (editVehicle) {
        await api.put(`/transfer/vehicles/${editVehicle.VehicleID}`, vehicleForm);
        toast.success('แก้ไขข้อมูลรถสำเร็จ');
      } else {
        await api.post('/transfer/vehicles', vehicleForm);
        toast.success('เพิ่มรถสำเร็จ');
      }
      setShowVehicleModal(false);
      setEditVehicle(null);
      setVehicleForm({ vehiclePlate: '', vehicleName: '' });
      loadVehicles();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSavingVehicle(false);
    }
  };

  const openEditVehicle = (v) => {
    setEditVehicle(v);
    setVehicleForm({ vehiclePlate: v.VehiclePlate, vehicleName: v.VehicleName || '' });
    setShowVehicleModal(true);
  };

  const deleteVehicle = async (id) => {
    if (!confirm('ต้องการลบรถคันนี้?')) return;
    try {
      await api.delete(`/transfer/vehicles/${id}`);
      toast.success('ลบรถสำเร็จ');
      loadVehicles();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openAssignModal = (jobId) => {
    setAssignJobId(jobId);
    setAssignForm({ operatorId: '', vehicleId: '' });
    setShowAssignModal(true);
  };

  const submitAssign = async () => {
    if (!assignForm.operatorId || !assignForm.vehicleId) {
      toast.error('กรุณาเลือกพนักงานและรถ');
      return;
    }
    setSavingAssign(true);
    try {
      const res = await api.post('/transfer/trips', {
        jobId: assignJobId,
        operatorId: parseInt(assignForm.operatorId),
        vehicleId: parseInt(assignForm.vehicleId),
      });
      if (res.data.success) {
        toast.success(`มอบหมายงานรอบที่ ${res.data.tripNo} สำเร็จ`);
        setShowAssignModal(false);
        const res2 = await api.get(`/transfer/jobs/${assignJobId}`);
        if (res2.data.success) setJobDetail(res2.data);
        loadJobs();
      }
    } catch {
      toast.error('ไม่สามารถมอบหมายงานได้');
    } finally {
      setSavingAssign(false);
    }
  };

  const sortedStations = [...stations].sort((a, b) =>
    a.StationCode.localeCompare(b.StationCode, undefined, { numeric: true })
  );

  const handleProdInput = (val) => {
    setProdQuery(val);
    setJobForm(f => ({ ...f, productDesc: val }));
    clearTimeout(prodTimer.current);
    if (!val.trim()) { setProdResults([]); setShowProdDrop(false); return; }
    prodTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/master/products?search=${encodeURIComponent(val)}&limit=10`);
        const list = res.data.data || [];
        setProdResults(list);
        setShowProdDrop(list.length > 0);
      } catch { setProdResults([]); }
    }, 200);
  };

  const pickProduct = (p) => {
    const desc = `${p.ProductCode} - ${p.ProductName}${p.SKUType ? ` [${p.SKUType}]` : ''}`;
    setProdQuery(desc);
    setJobForm(f => ({ ...f, productDesc: desc }));
    setShowProdDrop(false);
  };

  const inputStyle = { border: '1.5px solid #e5e7eb', color: '#111827', background: '#ffffff' };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black" style={{ color: '#111827' }}>ระบบย้ายสินค้าภายใน</h2>
          <p className="text-sm font-medium mt-0.5" style={{ color: '#9ca3af' }}>ควบคุมการขนย้ายสินค้าจากฝ่ายผลิตไปยังคลังสินค้า</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowCreateJob(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(220,38,38,0.30)' }}>
            <Plus size={15} /> สร้างงาน
          </button>
          <button onClick={loadJobs} className="p-2.5 rounded-2xl transition-colors"
            style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6', color: '#6b7280' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
        {[
          { key: 'jobs', label: 'งาน', icon: Layers },
          { key: 'stations', label: 'สถานี', icon: Building2 },
          { key: 'vehicles', label: 'รถ', icon: Truck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="flex items-center justify-center gap-2 flex-1 h-9 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === key
              ? { background: '#ffffff', color: '#dc2626', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
              : { color: '#6b7280' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── JOBS TAB ── */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { v: '', l: 'ทั้งหมด' },
              { v: 'PENDING', l: 'รอดำเนินการ' },
              { v: 'IN_PROGRESS', l: 'กำลังทำ' },
              { v: 'COMPLETE', l: 'เสร็จสิ้น' },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className="px-3 h-8 rounded-xl text-xs font-bold transition-all"
                style={statusFilter === v
                  ? { background: '#dc2626', color: '#fff' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {l}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 rounded-3xl" style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6' }}>
              <Package size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="font-semibold text-sm" style={{ color: '#9ca3af' }}>ยังไม่มีงาน</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const st = JOB_STATUS[job.Status] || JOB_STATUS.PENDING;
                const isExpanded = expandedJob === job.JobID;
                const bundlePct = job.PlannedBundles
                  ? Math.min(100, Math.round((job.ActualBundles || 0) / job.PlannedBundles * 100))
                  : null;

                return (
                  <div key={job.JobID} className="rounded-3xl overflow-hidden"
                    style={{ background: '#ffffff', border: '1.5px solid #f3f4f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

                    {/* Job header row */}
                    <div className="flex items-start gap-4 p-5">
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-black text-sm" style={{ color: '#111827' }}>{job.JobCode}</span>
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                          {job.Priority !== 'NORMAL' && (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#fff7ed', color: PRIORITY_COLOR[job.Priority] }}>
                              {PRIORITY_LABEL[job.Priority]}
                            </span>
                          )}
                        </div>
                        {/* Route */}
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#fef2f2', color: '#dc2626' }}>
                            {job.SourceStationName}
                          </span>
                          <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                            {job.DestStationName}
                          </span>
                        </div>
                        {/* Product */}
                        <p className="text-sm font-medium mb-3" style={{ color: '#6b7280' }}>{job.ProductDesc}</p>
                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-4">
                          {job.PlannedBundles != null && (
                            <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>
                              มัด: <span style={{ color: '#111827' }}>{job.ActualBundles || 0}</span>/{job.PlannedBundles}
                            </span>
                          )}
                          {job.PlannedWeightKg != null && (
                            <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>
                              น้ำหนัก: <span style={{ color: '#111827' }}>{(job.ActualWeightKg || 0).toFixed(1)}</span>/{job.PlannedWeightKg} กก.
                            </span>
                          )}
                          <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>
                            รอบ: <span style={{ color: '#111827' }}>{job.CompletedTripCount}/{job.TripCount}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#d1d5db' }}>
                            <Clock size={11} />
                            {dayjs(job.CreatedAt).format('DD/MM HH:mm')}
                          </span>
                        </div>
                        {bundlePct !== null && (
                          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${bundlePct}%`, background: bundlePct >= 100 ? '#10b981' : '#dc2626' }} />
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <button onClick={() => toggleJobDetail(job.JobID)}
                          className="flex items-center gap-1 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                          style={{ background: '#f9fafb', border: '1.5px solid #f3f4f6', color: '#6b7280' }}>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          รอบย้าย
                        </button>
                        {job.Status === 'IN_PROGRESS' && (
                          <button onClick={() => updateJobStatus(job.JobID, 'COMPLETE')}
                            className="flex items-center gap-1 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                            style={{ background: '#f0fdf4', color: '#10b981', border: '1.5px solid #bbf7d0' }}>
                            <CheckCircle2 size={13} /> ปิดงาน
                          </button>
                        )}
                        {job.Status === 'PENDING' && (
                          <button onClick={() => updateJobStatus(job.JobID, 'CANCELLED')}
                            className="flex items-center gap-1 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                            style={{ background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca' }}>
                            <X size={13} /> ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded trips list */}
                    {isExpanded && jobDetail && (
                      <div className="px-5 pb-5" style={{ borderTop: '1px solid #f9fafb' }}>
                        <div className="flex items-center justify-between pt-4 mb-3">
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#d1d5db' }}>
                            รอบย้ายสินค้า ({jobDetail.trips.length} รอบ)
                          </p>
                          {job.Status !== 'COMPLETE' && job.Status !== 'CANCELLED' && (
                            <button onClick={() => openAssignModal(job.JobID)}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold text-white"
                              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 3px 10px rgba(124,58,237,0.3)' }}>
                              <UserCheck size={13} /> มอบหมาย
                            </button>
                          )}
                        </div>
                        {jobDetail.trips.length === 0 ? (
                          <p className="text-sm text-center py-4" style={{ color: '#9ca3af' }}>
                            ยังไม่มีรอบย้าย — กดมอบหมายเพื่อส่งรถ
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {jobDetail.trips.map(trip => {
                              const ts = TRIP_STATUS[trip.Status] || TRIP_STATUS.PENDING;
                              return (
                                <div key={trip.TripID} className="flex items-start gap-3 p-3 rounded-2xl"
                                  style={{ background: '#f9fafb' }}>
                                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                                    style={{ background: ts.color }}>
                                    {trip.TripNo}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold" style={{ color: ts.color }}>{ts.label}</span>
                                      {trip.VehiclePlate && (
                                        <span className="px-1.5 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                          {trip.VehiclePlate}
                                        </span>
                                      )}
                                      {trip.OperatorName && (
                                        <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>{trip.OperatorName}</span>
                                      )}
                                    </div>
                                    {(trip.BundleCount || trip.TotalWeightKg) && (
                                      <div className="flex items-center gap-3 mt-1">
                                        {trip.BundleCount && <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>{trip.BundleCount} มัด</span>}
                                        {trip.TotalWeightKg && <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>{trip.TotalWeightKg} กก.</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right text-xs space-y-0.5 flex-shrink-0" style={{ color: '#9ca3af' }}>
                                    {trip.SourceEntryTime && <div>เข้าต้น {dayjs(trip.SourceEntryTime).format('HH:mm')}</div>}
                                    {trip.SourceExitTime  && <div>ออกต้น {dayjs(trip.SourceExitTime).format('HH:mm')}</div>}
                                    {trip.DestEntryTime   && <div>เข้าปลาย {dayjs(trip.DestEntryTime).format('HH:mm')}</div>}
                                    {trip.DestExitTime    && <div>ออกปลาย {dayjs(trip.DestExitTime).format('HH:mm')}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STATIONS TAB ── */}
      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditStation(null); setStationForm({ stationCode: '', stationName: '', stationType: 'BOTH', sortOrder: 0 }); setShowStationModal(true); }}
              className="flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
              <Plus size={15} /> เพิ่มสถานี
            </button>
          </div>
          <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #f3f4f6' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  {['รหัส', 'ชื่อสถานี', 'ประเภท', 'ลำดับ', ''].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-xs font-bold uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#9ca3af' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStations.map((s, i) => (
                  <tr key={s.StationID} style={{ background: i % 2 ? '#fafafa' : '#ffffff', borderBottom: '1px solid #f9fafb' }}>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: '#374151' }}>{s.StationCode}</td>
                    <td className="px-5 py-3 text-sm font-semibold" style={{ color: '#111827' }}>{s.StationName}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                        {s.StationType === 'SOURCE' ? 'ต้นทาง' : s.StationType === 'DEST' ? 'ปลายทาง' : 'ทั้งคู่'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: '#9ca3af' }}>{s.SortOrder}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditStation(s)}
                          className="p-1.5 rounded-xl transition-colors" style={{ color: '#6b7280' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteStation(s.StationID)}
                          className="p-1.5 rounded-xl transition-colors" style={{ color: '#ef4444' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {stations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm" style={{ color: '#9ca3af' }}>
                      ยังไม่มีสถานี — กดเพิ่มสถานีด้านบน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VEHICLES TAB ── */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditVehicle(null); setVehicleForm({ vehiclePlate: '', vehicleName: '' }); setShowVehicleModal(true); }}
              className="flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
              <Plus size={15} /> เพิ่มรถ
            </button>
          </div>
          <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #f3f4f6' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  {['ทะเบียนรถ', 'ชื่อ/หมายเลข', ''].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-xs font-bold uppercase tracking-wider ${i === 2 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#9ca3af' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => (
                  <tr key={v.VehicleID} style={{ background: i % 2 ? '#fafafa' : '#ffffff', borderBottom: '1px solid #f9fafb' }}>
                    <td className="px-5 py-3 text-sm font-black" style={{ color: '#111827' }}>{v.VehiclePlate}</td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: '#6b7280' }}>{v.VehicleName || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditVehicle(v)}
                          className="p-1.5 rounded-xl transition-colors" style={{ color: '#6b7280' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteVehicle(v.VehicleID)}
                          className="p-1.5 rounded-xl transition-colors" style={{ color: '#ef4444' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-sm" style={{ color: '#9ca3af' }}>
                      ยังไม่มีรถขนย้าย — กดเพิ่มรถด้านบน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE JOB MODAL ── */}
      {showCreateJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowCreateJob(false); }}>
          <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h3 className="text-lg font-black" style={{ color: '#111827' }}>สร้างงานใหม่</h3>
              <button onClick={() => setShowCreateJob(false)} className="p-1.5 rounded-xl" style={{ color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>สถานีต้นทาง *</label>
                  <select value={jobForm.sourceStationId}
                    onChange={e => setJobForm(f => ({ ...f, sourceStationId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}>
                    <option value="">-- เลือก --</option>
                    {sortedStations.map(s => <option key={s.StationID} value={s.StationID}>{s.StationName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>สถานีปลายทาง *</label>
                  <select value={jobForm.destStationId}
                    onChange={e => setJobForm(f => ({ ...f, destStationId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}>
                    <option value="">-- เลือก --</option>
                    {sortedStations.map(s => <option key={s.StationID} value={s.StationID}>{s.StationName}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>รายละเอียดสินค้า *</label>
                <div className="relative">
                  <input type="text" value={prodQuery}
                    onChange={e => handleProdInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowProdDrop(false), 150)}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none"
                    style={inputStyle}
                    placeholder="ค้นหารหัส / ชื่อสินค้า..." />
                  {showProdDrop && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto"
                      style={{ border: '1.5px solid #e5e7eb' }}>
                      {prodResults.map(p => (
                        <button key={p.ProductID} type="button" onMouseDown={() => pickProduct(p)}
                          className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm transition-colors"
                          style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <span className="font-bold text-gray-800">{p.ProductCode}</span>
                          <span className="text-gray-500 ml-2">{p.ProductName}</span>
                          {p.SKUType && <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">{p.SKUType}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>จำนวนมัด</label>
                  <input type="number" value={jobForm.plannedBundles}
                    onChange={e => setJobForm(f => ({ ...f, plannedBundles: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>น้ำหนักรวม กก.</label>
                  <input type="number" value={jobForm.plannedWeightKg}
                    onChange={e => setJobForm(f => ({ ...f, plannedWeightKg: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}
                    placeholder="0.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ความสำคัญ</label>
                <div className="flex gap-2">
                  {[{ v: 'NORMAL', l: 'ปกติ' }, { v: 'HIGH', l: 'เร่งด่วน' }, { v: 'URGENT', l: 'ด่วนมาก' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setJobForm(f => ({ ...f, priority: v }))}
                      className="flex-1 h-9 rounded-xl text-xs font-bold transition-all"
                      style={jobForm.priority === v
                        ? { background: '#dc2626', color: '#fff' }
                        : { background: '#f3f4f6', color: '#6b7280' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>หมายเหตุ</label>
                <input type="text" value={jobForm.notes}
                  onChange={e => setJobForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setShowCreateJob(false)}
                className="flex-1 h-11 rounded-2xl text-sm font-bold"
                style={{ background: '#f9fafb', color: '#6b7280', border: '1.5px solid #f3f4f6' }}>
                ยกเลิก
              </button>
              <button onClick={createJob} disabled={savingJob}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {savingJob ? <><RefreshCw size={14} className="animate-spin" /> กำลังสร้าง...</> : 'สร้างงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VEHICLE MODAL ── */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowVehicleModal(false); }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h3 className="text-lg font-black" style={{ color: '#111827' }}>
                {editVehicle ? 'แก้ไขรถ' : 'เพิ่มรถใหม่'}
              </h3>
              <button onClick={() => setShowVehicleModal(false)} className="p-1.5 rounded-xl" style={{ color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ทะเบียนรถ *</label>
                <input type="text" value={vehicleForm.vehiclePlate}
                  onChange={e => setVehicleForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none"
                  style={inputStyle} placeholder="เช่น กข-1234" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ชื่อ/หมายเลขรถ</label>
                <input type="text" value={vehicleForm.vehicleName}
                  onChange={e => setVehicleForm(f => ({ ...f, vehicleName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none"
                  style={inputStyle} placeholder="เช่น รถโฟล์คลิฟท์ #1" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setShowVehicleModal(false)}
                className="flex-1 h-11 rounded-2xl text-sm font-bold"
                style={{ background: '#f9fafb', color: '#6b7280', border: '1.5px solid #f3f4f6' }}>
                ยกเลิก
              </button>
              <button onClick={saveVehicle} disabled={savingVehicle}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {savingVehicle ? <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</> : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN MODAL ── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowAssignModal(false); }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h3 className="text-lg font-black" style={{ color: '#111827' }}>มอบหมายงาน</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1.5 rounded-xl" style={{ color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>พนักงานขับรถ *</label>
                <select value={assignForm.operatorId}
                  onChange={e => setAssignForm(f => ({ ...f, operatorId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}>
                  <option value="">-- เลือกพนักงาน --</option>
                  {users.map(u => (
                    <option key={u.UserID} value={u.UserID}>{u.FullName} ({u.Username})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>รถขนย้าย *</label>
                <select value={assignForm.vehicleId}
                  onChange={e => setAssignForm(f => ({ ...f, vehicleId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}>
                  <option value="">-- เลือกรถ --</option>
                  {vehicles.map(v => (
                    <option key={v.VehicleID} value={v.VehicleID}>{v.VehiclePlate}{v.VehicleName ? ` — ${v.VehicleName}` : ''}</option>
                  ))}
                </select>
              </div>
              {vehicles.length === 0 && (
                <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                  ยังไม่มีรถในระบบ — กรุณาเพิ่มรถที่ tab รถก่อน
                </p>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setShowAssignModal(false)}
                className="flex-1 h-11 rounded-2xl text-sm font-bold"
                style={{ background: '#f9fafb', color: '#6b7280', border: '1.5px solid #f3f4f6' }}>
                ยกเลิก
              </button>
              <button onClick={submitAssign} disabled={savingAssign}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                {savingAssign ? <><RefreshCw size={14} className="animate-spin" /> กำลังมอบหมาย...</> : <><UserCheck size={15} /> มอบหมาย</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATION MODAL ── */}
      {showStationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowStationModal(false); }}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h3 className="text-lg font-black" style={{ color: '#111827' }}>
                {editStation ? 'แก้ไขสถานี' : 'เพิ่มสถานีใหม่'}
              </h3>
              <button onClick={() => setShowStationModal(false)} className="p-1.5 rounded-xl" style={{ color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>รหัสสถานี *</label>
                  <input type="text" value={stationForm.stationCode}
                    onChange={e => setStationForm(f => ({ ...f, stationCode: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}
                    placeholder="เช่น ST01" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ลำดับ</label>
                  <input type="number" value={stationForm.sortOrder}
                    onChange={e => setStationForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ชื่อสถานี *</label>
                <input type="text" value={stationForm.stationName}
                  onChange={e => setStationForm(f => ({ ...f, stationName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={inputStyle}
                  placeholder="ชื่อสถานี" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#6b7280' }}>ประเภทสถานี</label>
                <div className="flex gap-2">
                  {[{ v: 'SOURCE', l: 'ต้นทาง' }, { v: 'DEST', l: 'ปลายทาง' }, { v: 'BOTH', l: 'ทั้งคู่' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setStationForm(f => ({ ...f, stationType: v }))}
                      className="flex-1 h-9 rounded-xl text-xs font-bold transition-all"
                      style={stationForm.stationType === v
                        ? { background: '#dc2626', color: '#fff' }
                        : { background: '#f3f4f6', color: '#6b7280' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setShowStationModal(false)}
                className="flex-1 h-11 rounded-2xl text-sm font-bold"
                style={{ background: '#f9fafb', color: '#6b7280', border: '1.5px solid #f3f4f6' }}>
                ยกเลิก
              </button>
              <button onClick={saveStation} disabled={savingStation}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {savingStation ? <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</> : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
