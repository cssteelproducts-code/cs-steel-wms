import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TruckIcon, CheckCircle, Clock, Scale, Activity, ArrowRight,
  Calendar, Package, AlertTriangle, Search, ChevronDown, ChevronUp, X
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime, formatDuration, formatWeight, getStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
dayjs.locale('th');

const colorBg = { 'text-blue-500': 'bg-blue-50', 'text-emerald-500': 'bg-emerald-50', 'text-amber-500': 'bg-amber-50', 'text-cyan-500': 'bg-cyan-50', 'text-red-500': 'bg-red-50', 'text-violet-500': 'bg-violet-50' };

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className={`stat-card ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-500 text-xs">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '-'}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${colorBg[color] || 'bg-slate-100'}`}>
        <Icon size={20} className={color} />
      </div>
    </div>
  </div>
);

const cardFace = {
  background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.04)',
  borderRadius: '1.5rem', padding: '1.25rem',
  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
  position: 'absolute', inset: 0
};

const FlipStatCard = ({ title, value, icon: Icon, color, breakdown }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ perspective: '1000px', minHeight: 90, cursor: 'pointer' }} onClick={() => setFlipped(f => !f)}>
      <div style={{
        position: 'relative', minHeight: 90,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.4s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)'
      }}>
        <div style={cardFace}>
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-slate-500 text-xs">{title}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? 0}</p>
              <p className="text-slate-400 text-xs mt-1">คัน · กดดูรายละเอียด</p>
            </div>
            <div className={`p-2.5 rounded-xl ${colorBg[color] || 'bg-slate-100'}`}>
              <Icon size={20} className={color} />
            </div>
          </div>
        </div>
        <div style={{ ...cardFace, transform: 'rotateY(180deg)' }}>
          <p className="text-xs font-semibold text-slate-500 mb-2">{title} — รายประเภท</p>
          {breakdown?.length > 0 ? (
            <div className="space-y-1">
              {breakdown.slice(0, 4).map(b => (
                <div key={b.TypeName} className="flex justify-between items-center">
                  <span className="text-xs text-slate-600 truncate mr-2">{b.TypeName}</span>
                  <span className={`text-xs font-bold ${color}`}>{b.Count} คัน</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">ยังไม่มีข้อมูล</p>}
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, sectionKey, collapsed, onToggle, icon: Icon, iconColor, extra }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="card-header mb-0 flex items-center gap-2">
      {Icon && <Icon size={16} className={iconColor || 'text-slate-400'} />}
      {title}
    </h3>
    <div className="flex items-center gap-2">
      {extra}
      <button onClick={() => onToggle(sectionKey)}
        className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        title={collapsed ? 'ขยาย' : 'ย่อ'}>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
    </div>
  </div>
);

const TypeTag = ({ name, count, color = 'bg-slate-100 text-slate-600' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
    {name} ×{count}
  </span>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dash_collapsed') || '{}'); } catch { return {}; }
  });
  const toggleSection = (key) => setCollapsed(prev => {
    const next = { ...prev, [key]: !prev[key] };
    localStorage.setItem('dash_collapsed', JSON.stringify(next));
    return next;
  });

  // Historical search state
  const today = dayjs().format('YYYY-MM-DD');
  const [histFrom, setHistFrom] = useState(today);
  const [histTo, setHistTo] = useState(today);
  const [histData, setHistData] = useState(null);
  const [histLoading, setHistLoading] = useState(false);

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(dayjs().format('YYYY-MM'));
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Station popup state
  const [stationPopup, setStationPopup] = useState(null); // { stationName, vehicles, loading }

  const openStationPopup = async (stationName) => {
    setStationPopup({ stationName, vehicles: [], loading: true });
    try {
      const res = await api.get(`/dashboard/station-vehicles?stationName=${encodeURIComponent(stationName)}`);
      if (res.data.success) {
        setStationPopup({ stationName, vehicles: res.data.data, loading: false });
      }
    } catch {
      setStationPopup(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data.success) setData(res.data.data);
    } catch {
      toast.error('ไม่สามารถโหลด Dashboard ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const searchHistory = async () => {
    if (!histFrom || !histTo) return;
    setHistLoading(true);
    try {
      const res = await api.get(`/dashboard/history?from=${histFrom}&to=${histTo}`);
      if (res.data.success) setHistData(res.data.data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลย้อนหลังได้');
    } finally {
      setHistLoading(false);
    }
  };

  const searchReport = async () => {
    if (!reportMonth) return;
    setReportLoading(true);
    try {
      const res = await api.get(`/dashboard/monthly-report?month=${reportMonth}`);
      if (res.data.success) setReportData(res.data.data);
    } catch {
      toast.error('ไม่สามารถโหลดรายงานได้');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลด Dashboard..." />
    </div>
  );

  const todayStats = data?.today || {};
  const weight = data?.weight || {};
  const counts = data?.tripCounts || {};
  const wh = data?.weightHistory || {};
  const ot = data?.onTimeStats || {};
  const incomplete = data?.incompleteLoading || [];
  const completedTodayList = data?.completedToday || [];

  const fmtKg = (v) => v ? `${parseFloat(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })} กก.` : '-';

  return (
    <>
    <div className="space-y-5 animate-fade-in">


      {/* Stat cards: today / month / year (flip to show type breakdown) */}
      <div className="grid grid-cols-3 gap-4">
        <FlipStatCard title="วันนี้" value={counts.TodayTotal ?? 0} icon={Calendar} color="text-blue-500" breakdown={data?.vehicleTypesToday} />
        <FlipStatCard title="เดือนนี้" value={counts.MonthTotal ?? 0} icon={TruckIcon} color="text-emerald-500" breakdown={data?.vtBreakdownMonth} />
        <FlipStatCard title="ปีนี้" value={counts.YearTotal ?? 0} icon={Package} color="text-violet-500" breakdown={data?.vtBreakdownYear} />
      </div>

      {/* น้ำหนักสินค้าที่ขึ้น */}
      <div className="card">
        <SectionHeader title="น้ำหนักสินค้าที่ขึ้น" sectionKey="weight" collapsed={collapsed.weight} onToggle={toggleSection} />
        {!collapsed.weight && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">วันนี้</p>
              {wh.TodayWeight ? (
                <p className="text-base font-bold text-blue-600">{fmtKg(wh.TodayWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">เมื่อวาน</p>
              {wh.YesterdayWeight ? (
                <p className="text-base font-bold text-slate-600">{fmtKg(wh.YesterdayWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        )}
      </div>


      {/* ประเภทขนส่ง */}
      <div className="card">
        <SectionHeader title="ประเภทขนส่ง" sectionKey="delivery" collapsed={collapsed.delivery} onToggle={toggleSection} />
        {!collapsed.delivery && (() => {
          const TYPES = [
            { key: 'CSS',      label: 'CSS.',  color: 'text-red-600',     bar: 'bg-red-400' },
            { key: 'Customer', label: 'Cust.', color: 'text-blue-600',    bar: 'bg-blue-400' },
            { key: 'Supplier', label: 'Sup.',  color: 'text-emerald-600', bar: 'bg-emerald-400' },
          ];
          const stats = data?.deliveryTypeStats || [];
          const periods = [
            { label: 'วันนี้',    key: 'TodayCount' },
            { label: 'เดือนนี้', key: 'MonthCount' },
            { label: 'ปีนี้',    key: 'YearCount' },
          ];
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {periods.map(p => {
                const total = stats.reduce((s, r) => s + (r[p.key] || 0), 0);
                return (
                  <div key={p.key} className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{p.label}</p>
                    <div className="space-y-2.5">
                      {TYPES.map(t => {
                        const row = stats.find(r => r.DeliveryType === t.key);
                        const count = row?.[p.key] || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={t.key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-semibold ${t.color}`}>{t.label}</span>
                              <span className={`text-sm font-bold ${t.color}`}>{count}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200">
                              <div className={`h-1.5 rounded-full transition-all ${t.bar}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ในเวลา / นอกเวลา */}
      <div className="card">
        <SectionHeader title="ในเวลา / นอกเวลา" sectionKey="ontime" collapsed={collapsed.ontime} onToggle={toggleSection} />
        {!collapsed.ontime && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* วันนี้ */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">วันนี้</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">ในเวลา</span>
                <span className="text-base font-bold text-emerald-600 ml-1">{ot.TodayOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-base font-bold text-amber-600 ml-1">{ot.TodayOvertime ?? 0}</span>
              </div>
            </div>
          </div>

          {/* เดือนนี้ */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เดือนนี้</p>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">ในเวลา</span>
                <span className="text-base font-bold text-emerald-600 ml-1">{ot.MonthOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-base font-bold text-amber-600 ml-1">{ot.MonthOvertime ?? 0}</span>
              </div>
            </div>
            {data?.vtBreakdownMonth?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.vtBreakdownMonth.map(vt => (
                  <TypeTag key={vt.TypeName} name={vt.TypeName} count={vt.Count} color="bg-emerald-50 text-emerald-700" />
                ))}
              </div>
            )}
          </div>

          {/* ปีนี้ */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ปีนี้</p>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">ในเวลา</span>
                <span className="text-base font-bold text-emerald-600 ml-1">{ot.YearOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-base font-bold text-amber-600 ml-1">{ot.YearOvertime ?? 0}</span>
              </div>
            </div>
            {data?.vtBreakdownYear?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.vtBreakdownYear.map(vt => (
                  <TypeTag key={vt.TypeName} name={vt.TypeName} count={vt.Count} color="bg-violet-50 text-violet-700" />
                ))}
              </div>
            )}
          </div>
        </div>}
      </div>

      {/* ปริมาณรถสะสมที่สถานี */}
      <div className="card">
        <SectionHeader title="ปริมาณรถสะสมที่สถานี" sectionKey="station" collapsed={collapsed.station} onToggle={toggleSection}
          extra={<span className="text-xs text-slate-500">{data?.stationLoad?.filter(s => s.ActiveTrucks > 0).length || 0} สถานี</span>} />
        {!collapsed.station && (
          data?.stationLoad?.filter(s => s.ActiveTrucks > 0).length ? (
            <div className="space-y-2">
              {[...data.stationLoad].filter(s => s.ActiveTrucks > 0).sort((a, b) => a.StationName.localeCompare(b.StationName, undefined, { numeric: true })).map(st => {
                const pct = Math.min(st.ActiveTrucks * 20, 100);
                return (
                  <div key={st.StationName}
                    className={st.ActiveTrucks > 0 ? 'cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors' : ''}
                    onClick={() => st.ActiveTrucks > 0 && openStationPopup(st.StationName)}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-slate-700">{st.StationName}</span>
                      <span className={`text-sm font-semibold ${st.ActiveTrucks > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {st.ActiveTrucks > 0 ? `${st.ActiveTrucks} คัน` : '✓ ว่าง'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full transition-all ${st.ActiveTrucks > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${st.ActiveTrucks > 0 ? Math.max(pct, 8) : 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">ยังไม่มีรถที่ถูก assign สถานีจากเมนู Pick</p>
          )
        )}
      </div>

      {/* รถที่กำลังดำเนินการ */}
      <div className="card">
        <SectionHeader title="รถที่กำลังดำเนินการ" sectionKey="inprog" collapsed={collapsed.inprog} onToggle={toggleSection}
          icon={AlertTriangle} iconColor="text-amber-500"
          extra={incomplete.length > 0 ? (
            <button onClick={() => navigate('/monitor')} className="text-blue-500 text-xs flex items-center gap-1 hover:underline">
              ดูรายละเอียด <ArrowRight size={12} />
            </button>
          ) : null} />
        {!collapsed.inprog && incomplete.length ? (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
              <span className="text-slate-600">
                รับสินค้าค้างอยู่ทั้งหมด <span className="font-bold text-amber-600">{incomplete.length} คัน</span>
              </span>
              {incomplete.filter(r => r.IsOvertime).length > 0 && (
                <span className="text-red-600 font-medium">
                  นอกเวลา {incomplete.filter(r => r.IsOvertime).length} คัน
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(incomplete.reduce((acc, r) => {
                const key = `${r.TypeName}|${r.HoursIn}`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})).map(([key, cnt]) => {
                const [type, hrs] = key.split('|');
                return (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                    {type} · {hrs} ชม. · {cnt} คัน
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          !collapsed.inprog && <p className="text-sm text-slate-400">ไม่มีรถกำลังดำเนินการ</p>
        )}
      </div>

      {/* รถที่ดำเนินการเสร็จแล้ว */}
      <div className="card">
        <SectionHeader title="รถที่ดำเนินการเสร็จแล้ว" sectionKey="done" collapsed={collapsed.done} onToggle={toggleSection}
          icon={CheckCircle} iconColor="text-emerald-500" />
        {!collapsed.done && completedTodayList.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header text-left px-3 py-2">ทะเบียน</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">ประเภท</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">น้ำหนักสุทธิ</th>
                  <th className="table-header text-left px-3 py-2 hide-mobile">ใช้เวลา</th>
                  <th className="table-header text-left px-3 py-2">เสร็จเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {completedTodayList.map(trip => (
                  <tr key={trip.TripID} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium">{trip.LicensePlate}</td>
                    <td className="table-cell hide-mobile text-slate-500">{trip.TypeName}</td>
                    <td className="table-cell hide-mobile">{trip.NetWeight ? fmtKg(trip.NetWeight) : '-'}</td>
                    <td className="table-cell hide-mobile text-slate-500">{trip.Minutes ? `${trip.Minutes} นาที` : '-'}</td>
                    <td className="table-cell text-slate-500">{formatDateTime(trip.CompletedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !collapsed.done && <p className="text-sm text-slate-400">ยังไม่มีการดำเนินการเสร็จสิ้นวันนี้</p>
        )}
      </div>

      {/* รถที่ดำเนินการเสร็จแล้วย้อนหลัง */}
      <div className="card">
        <SectionHeader title="ย้อนหลัง" sectionKey="hist" collapsed={collapsed.hist} onToggle={toggleSection} />
        {!collapsed.hist && <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="label">จากวันที่</label>
            <input type="date" className="input-field" value={histFrom}
              onChange={e => setHistFrom(e.target.value)} style={{ width: 160 }} />
          </div>
          <div>
            <label className="label">ถึงวันที่</label>
            <input type="date" className="input-field" value={histTo}
              onChange={e => setHistTo(e.target.value)} style={{ width: 160 }} />
          </div>
          <button onClick={searchHistory} disabled={histLoading} className="btn-primary">
            {histLoading ? <LoadingSpinner size="sm" /> : <Search size={14} />}
            ค้นหาข้อมูลย้อนหลัง
          </button>
        </div>}
        {!collapsed.hist && histData !== null && (
          histData.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">ทะเบียน</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">ประเภท</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">ลูกค้า</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">น้ำหนักสุทธิ</th>
                    <th className="table-header text-left px-3 py-2">วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {histData.map(trip => (
                    <tr key={trip.TripID} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="table-cell font-medium">{trip.LicensePlate}</td>
                      <td className="table-cell hide-mobile text-slate-500">{trip.TypeName}</td>
                      <td className="table-cell hide-mobile text-slate-500">{trip.CustomerName}</td>
                      <td className="table-cell hide-mobile">{trip.NetWeight ? fmtKg(trip.NetWeight) : '-'}</td>
                      <td className="table-cell text-slate-500">{dayjs(trip.TripDate).format('DD/MM/YY')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">พบ {histData.length} รายการ</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
          )
        )}
      </div>

      {/* รายงานผลการจัดส่งรายทะเบียน */}
      <div className="card">
        <SectionHeader title="รายงานผลการจัดส่งรายทะเบียน" sectionKey="report" collapsed={collapsed.report} onToggle={toggleSection} />
        {!collapsed.report && <>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">เดือน</label>
              <input type="month" className="input-field" value={reportMonth}
                onChange={e => setReportMonth(e.target.value)} style={{ width: 160 }} />
            </div>
            <button onClick={searchReport} disabled={reportLoading} className="btn-primary">
              {reportLoading ? <LoadingSpinner size="sm" /> : <Search size={14} />}
              ดูรายงาน
            </button>
          </div>
          {reportData !== null && (
          reportData.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left px-3 py-2">ทะเบียน</th>
                    <th className="table-header text-left px-3 py-2 hide-mobile">ประเภทรถ</th>
                    <th className="table-header text-right px-3 py-2">จำนวนเที่ยว</th>
                    <th className="table-header text-right px-3 py-2 hide-mobile">เสร็จสิ้น</th>
                    <th className="table-header text-right px-3 py-2 hide-mobile">น้ำหนักรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="table-cell font-medium">{row.LicensePlate}</td>
                      <td className="table-cell hide-mobile text-slate-500">{row.TypeName}</td>
                      <td className="table-cell text-right font-semibold">{row.TripCount}</td>
                      <td className="table-cell hide-mobile text-right text-emerald-600">{row.Completed}</td>
                      <td className="table-cell hide-mobile text-right">{row.TotalWeight ? fmtKg(row.TotalWeight) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">{reportData.length} ทะเบียน</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">ไม่พบข้อมูลในเดือนที่เลือก</p>
          )
          )}
        </>}
      </div>

      {/* --- เดิม: สถานะรถในคลัง + chart + กิจกรรมล่าสุด --- */}

      {/* Flow status + weekly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionHeader title="สถานะรถในคลัง" sectionKey="flow" collapsed={collapsed.flow} onToggle={toggleSection}
            extra={<button onClick={() => navigate('/monitor')} className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1">ดูทั้งหมด <ArrowRight size={11} /></button>} />
          {!collapsed.flow && <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { status: 'Data', label: 'รอเอกสาร Pick' },
              { status: 'Loading', label: 'ขึ้นสินค้า' },
              { status: 'WeighOut', label: 'รอชั่งออก' }
            ].map(item => {
              const count = data?.statusFlow?.find(s => s.Status === item.status)?.Count || 0;
              const cfg = getStatusConfig(item.status);
              return (
                <div key={item.status} className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                  <div className={`text-2xl font-bold ${cfg.color?.split(' ').find(c => c.startsWith('text')) || 'text-slate-900'}`}>
                    {count}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">สถานีขึ้นสินค้า</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...(data?.stationLoad || [])].sort((a, b) => a.StationName.localeCompare(b.StationName, undefined, { numeric: true })).map(station => (
                <div key={station.StationName}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-700 text-sm truncate">{station.StationName}</span>
                  <span className={`text-sm font-medium ${station.ActiveTrucks > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {station.ActiveTrucks > 0 ? `${station.ActiveTrucks} คัน` : '✓ ว่าง'}
                  </span>
                </div>
              ))}
              {!data?.stationLoad?.length && (
                <p className="text-slate-400 text-sm text-center py-4">ยังไม่มีสถานีที่กำหนด</p>
              )}
            </div>
          </div>
          </>}
        </div>

        <div className="card">
          <SectionHeader title="จำนวนรถ 7 วันย้อนหลัง" sectionKey="chart" collapsed={collapsed.chart} onToggle={toggleSection} />
          {!collapsed.chart && <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.weeklyTrend || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="TripDate" tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                labelStyle={{ color: '#475569' }}
                formatter={(value, name) => [value, name === 'TotalTrips' ? 'รวม' : 'เสร็จ']}
              />
              <Bar dataKey="TotalTrips" fill="#3b82f6" radius={[4, 4, 0, 0]} name="TotalTrips" />
              <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>}
        </div>
      </div>

      {/* Original 4-card stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รถทั้งหมดวันนี้"
          value={todayStats.TotalTrips || 0}
          sub="เที่ยวรถ"
          icon={TruckIcon}
          color="text-blue-500"
          onClick={() => navigate('/monitor')}
        />
        <StatCard
          title="เสร็จสิ้นแล้ว"
          value={todayStats.Completed || 0}
          sub={`เฉลี่ย ${formatDuration(data?.avgProcessingMinutes)}`}
          icon={CheckCircle}
          color="text-emerald-500"
        />
        <StatCard
          title="กำลังดำเนินการ"
          value={todayStats.InProgress || 0}
          sub="รถในคลัง"
          icon={Clock}
          color="text-amber-500"
          onClick={() => navigate('/monitor')}
        />
        <StatCard
          title="น้ำหนักรวม"
          value={weight.TotalNetWeight ? `${parseFloat(weight.TotalNetWeight).toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '0'}
          sub="กิโลกรัม (สุทธิ)"
          icon={Scale}
          color="text-cyan-500"
        />
      </div>

      {/* Recent activity */}
      <div className="card">
        <SectionHeader title="กิจกรรมล่าสุดวันนี้" sectionKey="activity" collapsed={collapsed.activity} onToggle={toggleSection}
          icon={Activity} iconColor="text-slate-400" />
        {!collapsed.activity && <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header text-left px-4 py-2">ทะเบียน</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">ลูกค้า</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">คลัง</th>
                <th className="table-header text-left px-4 py-2">สถานะ</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">เวลาเข้า</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentActivity?.map(trip => (
                <tr key={trip.TripID}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/monitor?tripId=${trip.TripID}`)}>
                  <td className="table-cell font-medium text-slate-900">
                    {trip.LicensePlate}
                    <div className="text-xs text-slate-400">{trip.VehicleType}</div>
                  </td>
                  <td className="table-cell hide-mobile">{trip.CustomerName || '-'}</td>
                  <td className="table-cell hide-mobile">{trip.WarehouseName || '-'}</td>
                  <td className="table-cell"><StatusBadge status={trip.Status} /></td>
                  <td className="table-cell hide-mobile">{formatDateTime(trip.CreatedAt)}</td>
                </tr>
              ))}
              {!data?.recentActivity?.length && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    ยังไม่มีข้อมูลวันนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
      </div>
    </div>

    {/* Station vehicles popup */}
    {stationPopup && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-800">{stationPopup.stationName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stationPopup.loading ? 'กำลังโหลด...' : `${stationPopup.vehicles.length} คัน`}
              </p>
            </div>
            <button onClick={() => setStationPopup(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-4">
            {stationPopup.loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="กำลังโหลด..." />
              </div>
            ) : stationPopup.vehicles.length === 0 ? (
              <p className="text-center text-slate-400 py-8">ไม่มีรถในสถานีขณะนี้</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left py-2 px-2">ทะเบียน</th>
                    <th className="table-header text-left py-2 px-2">ชื่อลูกค้า</th>
                    <th className="table-header text-left py-2 px-2">ประเภทรถ</th>
                    <th className="table-header text-left py-2 px-2">เวลาเข้า</th>
                    <th className="table-header text-right py-2 px-2">อยู่มา</th>
                  </tr>
                </thead>
                <tbody>
                  {stationPopup.vehicles.map(v => (
                    <tr key={v.TripID} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium text-slate-800">{v.LicensePlate}</td>
                      <td className="py-2 px-2 text-slate-600">{v.CustomerName || '-'}</td>
                      <td className="py-2 px-2 text-slate-500 text-xs">{v.VehicleTypeName || '-'}</td>
                      <td className="py-2 px-2 text-slate-500 text-xs">
                        {v.EntryTime ? dayjs(v.EntryTime).format('HH:mm') : '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          v.MinutesIn > 60 ? 'bg-red-50 text-red-600' :
                          v.MinutesIn > 30 ? 'bg-amber-50 text-amber-600' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {v.MinutesIn != null ? `${v.MinutesIn} นาที` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
