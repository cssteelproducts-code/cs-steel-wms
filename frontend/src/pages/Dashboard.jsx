import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TruckIcon, CheckCircle, Clock, Scale, Activity,
  Calendar, Package, Search, ChevronDown, ChevronUp, X, RefreshCw, BarChart2, Timer
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


const DELIVERY_TYPES = [
  { key: 'CSS',      label: 'CSS.',  color: 'text-red-600',   bar: 'bg-red-400' },
  { key: 'Customer', label: 'Cust.', color: 'text-blue-600',  bar: 'bg-blue-400' },
  { key: 'Supplier', label: 'Sup.',  color: 'text-emerald-600', bar: 'bg-emerald-400' },
];

const FlipStatCard = ({ title, value, icon: Icon, color, deliveryStats, periodKey }) => {
  const [flipped, setFlipped] = useState(false);
  const total = (deliveryStats || []).reduce((s, r) => s + (r[periodKey] || 0), 0);
  const face = {
    background: '#ffffff', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
    borderRadius: '1rem', padding: '1rem',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    position: 'absolute', inset: 0, overflow: 'hidden',
    boxSizing: 'border-box'
  };
  return (
    <div style={{ perspective: '1000px', minHeight: 150, cursor: 'pointer', overflow: 'hidden', borderRadius: '1rem' }} onClick={() => setFlipped(f => !f)}>
      <div style={{
        position: 'relative', minHeight: 150,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.4s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)'
      }}>
        {/* Front */}
        <div style={face}>
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between flex-1">
              <div>
                <p className="text-slate-500 text-xs">{title}</p>
                <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? 0}</p>
                <p className="text-slate-400 text-xs mt-0.5">คัน</p>
              </div>
              <div className={`p-2.5 rounded-xl ${colorBg[color] || 'bg-slate-100'}`}>
                <Icon size={20} className={color} />
              </div>
            </div>
            <p className="text-slate-400 text-xs text-right mt-1">กดดูประเภทขนส่ง →</p>
          </div>
        </div>
        {/* Back */}
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-600 leading-tight">{title}</p>
            <p className="text-xs font-normal text-slate-400">ประเภทขนส่ง</p>
          </div>
          <div className="space-y-2">
            {DELIVERY_TYPES.map(t => {
              const row = (deliveryStats || []).find(r => r.DeliveryType === t.key);
              const count = row?.[periodKey] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={t.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-semibold ${t.color}`}>{t.label}</span>
                    <span className={`text-xs font-bold ${t.color}`}>{count}
                      <span className="text-slate-400 font-normal ml-1">/{pct}%</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full transition-all ${t.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-400 text-xs text-right mt-2">← กดกลับ</p>
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
  const [lastUpdate, setLastUpdate] = useState(null);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dash_collapsed') || '{}'); } catch { return {}; }
  });
  const [overtimeFlipped, setOvertimeFlipped] = useState({});
  const toggleSection = (key) => setCollapsed(prev => {
    const next = { ...prev, [key]: !prev[key] };
    localStorage.setItem('dash_collapsed', JSON.stringify(next));
    return next;
  });

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
      if (res.data.success) { setData(res.data.data); setLastUpdate(new Date()); }
    } catch {
      toast.error('ไม่สามารถโหลด Dashboard ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
  const fmtKg = (v) => v ? `${parseFloat(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })} กก.` : '-';

  return (
    <>
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <BarChart2 size={20} className="text-blue-500 flex-shrink-0" />
            Dashboard
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stat cards: today / month / year — flip to show delivery type breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <FlipStatCard title="วันนี้" value={counts.TodayTotal ?? 0} icon={Calendar} color="text-blue-500" deliveryStats={data?.deliveryTypeStats} periodKey="TodayCount" />
        <FlipStatCard title="เดือนนี้" value={counts.MonthTotal ?? 0} icon={TruckIcon} color="text-emerald-500" deliveryStats={data?.deliveryTypeStats} periodKey="MonthCount" />
        <FlipStatCard title="ปีนี้" value={counts.YearTotal ?? 0} icon={Package} color="text-violet-500" deliveryStats={data?.deliveryTypeStats} periodKey="YearCount" />
      </div>

      {/* 4 stat cards — row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รถทั้งหมดวันนี้"
          value={todayStats.TotalTrips || 0}
          sub="เที่ยวรถ"
          icon={TruckIcon}
          color="text-blue-500"
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

      {/* ปริมาณรถสะสมที่สถานี — row 3 */}
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

      {/* เวลาเฉลี่ยขึ้นสินค้าต่อสถานี */}
      {data?.stationAvgTime?.length > 0 && (() => {
        const maxAvg = Math.max(...data.stationAvgTime.map(s => s.AvgMinutes || 0), 1);
        const fmtMin = (m) => {
          if (!m && m !== 0) return '-';
          if (m < 60) return `${Math.round(m)} นาที`;
          return `${Math.floor(m / 60)} ชม. ${Math.round(m % 60)} นาที`;
        };
        return (
          <div className="card">
            <SectionHeader title="เวลาเฉลี่ยขึ้นสินค้าต่อสถานี" sectionKey="stationAvg" collapsed={collapsed.stationAvg} onToggle={toggleSection}
              icon={Clock}
              extra={<span className="text-xs text-slate-400">30 วันล่าสุด</span>} />
            {!collapsed.stationAvg && (
              <div className="space-y-3">
                {data.stationAvgTime.map(s => {
                  const pct = Math.round((s.AvgMinutes / maxAvg) * 100);
                  const barColor = pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-400';
                  return (
                    <div key={s.StationName}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-slate-700 truncate">{s.StationName}</span>
                          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{s.TodayTrips > 0 ? `วันนี้ ${s.TodayTrips} เที่ยว` : `30 วัน ${s.TotalTrips} เที่ยว`}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 ml-2 whitespace-nowrap">{fmtMin(s.AvgMinutes)}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-xs text-slate-400">ต่ำสุด {fmtMin(s.MinMinutes)}</span>
                        <span className="text-xs text-slate-400">สูงสุด {fmtMin(s.MaxMinutes)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* น้ำหนักสินค้าที่ขึ้น */}
      <div className="card">
        <SectionHeader title="น้ำหนักสินค้าที่ขึ้น" sectionKey="weight" collapsed={collapsed.weight} onToggle={toggleSection} />
        {!collapsed.weight && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">เมื่อวาน</p>
              {wh.YesterdayWeight ? (
                <p className="text-base font-bold text-blue-600">{fmtKg(wh.YesterdayWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">เมื่อวันก่อน</p>
              {wh.DayBeforeWeight ? (
                <p className="text-base font-bold text-slate-600">{fmtKg(wh.DayBeforeWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ในเวลา / นอกเวลา + ประเภทรถ */}
      <div className="card">
        <SectionHeader title="ในเวลา / นอกเวลา" sectionKey="ontime" collapsed={collapsed.ontime} onToggle={toggleSection} />
        {!collapsed.ontime && (() => {
          const todayMap  = Object.fromEntries((data?.vehicleTypesToday  || []).map(v => [v.TypeName, v.Count]));
          const monthMap  = Object.fromEntries((data?.vtBreakdownMonth   || []).map(v => [v.TypeName, v.Count]));
          const yearMap   = Object.fromEntries((data?.vtBreakdownYear    || []).map(v => [v.TypeName, v.Count]));
          const allTypes  = [...new Set([...Object.keys(todayMap), ...Object.keys(monthMap), ...Object.keys(yearMap)])].sort();
          return (
            <div className="space-y-3">
              {/* ในเวลา/นอกเวลา row — flip to see overtime vehicle breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'วันนี้',   inTime: ot.TodayOnTime,  overtime: ot.TodayOvertime,  types: data?.overtimeByTypeToday  || [] },
                  { label: 'เดือนนี้', inTime: ot.MonthOnTime,  overtime: ot.MonthOvertime,  types: data?.overtimeByTypeMonth || [] },
                  { label: 'ปีนี้',    inTime: ot.YearOnTime,   overtime: ot.YearOvertime,   types: data?.overtimeByTypeYear  || [] },
                ].map(({ label, inTime, overtime, types }) => {
                  const isFlipped = !!overtimeFlipped[label];
                  const face = {
                    borderRadius: 12, padding: 12,
                    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                    position: 'absolute', inset: 0, overflow: 'hidden', boxSizing: 'border-box'
                  };
                  return (
                    <div key={label}
                      style={{ perspective: '1000px', minHeight: 100, cursor: 'pointer', borderRadius: 12 }}
                      onClick={() => setOvertimeFlipped(f => ({ ...f, [label]: !f[label] }))}>
                      <div style={{
                        position: 'relative', minHeight: 100,
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.4s ease',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)'
                      }}>
                        {/* Front */}
                        <div style={{ ...face, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <p className="text-xs font-semibold text-slate-400 mb-2 text-center">{label}</p>
                          <div className="flex justify-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-emerald-600">{inTime ?? 0}</p>
                              <p className="text-xs text-slate-400">ในเวลา</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-amber-500">{overtime ?? 0}</p>
                              <p className="text-xs text-slate-400">นอกเวลา</p>
                            </div>
                          </div>
                          {(overtime ?? 0) > 0 && (
                            <p className="text-xs text-slate-300 text-right mt-1.5">กดดูรถ →</p>
                          )}
                        </div>
                        {/* Back — overtime vehicle type breakdown */}
                        <div style={{ ...face, transform: 'rotateY(180deg)', background: '#fffbeb', border: '1px solid #fde68a' }}>
                          <p className="text-xs font-semibold text-amber-700 mb-2">{label} — นอกเวลา</p>
                          {types.length > 0 ? (
                            <div className="space-y-1.5">
                              {types.map(item => (
                                <div key={item.TypeName} className="flex justify-between items-center">
                                  <span className="text-xs text-slate-600 truncate mr-1">{item.TypeName}</span>
                                  <span className="text-xs font-bold text-amber-600 flex-shrink-0">{item.Count} คัน</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center mt-2">ไม่มีรถนอกเวลา ✓</p>
                          )}
                          <p className="text-xs text-slate-400 text-right mt-1.5">← กลับ</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* ประเภทรถ table */}
              {allTypes.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">ประเภทรถ</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-blue-600">วันนี้</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-emerald-600">เดือนนี้</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-violet-600">ปีนี้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTypes.map((name, i) => (
                        <tr key={name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-3 py-1.5 font-medium text-slate-700">{name}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-blue-600">{todayMap[name] ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-emerald-600">{monthMap[name] ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-violet-600">{yearMap[name] ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Weekly bar chart */}
      <div className="card">
        <SectionHeader title="ปริมาณรถย้อนหลัง 15 วัน" sectionKey="chart" collapsed={collapsed.chart} onToggle={toggleSection}
          icon={BarChart2} iconColor="text-blue-500" />
        {!collapsed.chart && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.weeklyTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="TripDate" tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => v ? dayjs(v).format('DD/MM') : ''} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                labelFormatter={v => v ? dayjs(v).format('DD MMM YYYY') : ''}
                formatter={(value) => [value, 'รถทั้งหมด']}
              />
              <Bar dataKey="TotalTrips" fill="#3b82f6" radius={[4, 4, 0, 0]} name="รถทั้งหมด" />
            </BarChart>
          </ResponsiveContainer>
        )}
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
                  <td className="table-cell"><StatusBadge trip={trip} /></td>
                  <td className="table-cell hide-mobile">{formatDateTime(trip.WeighInTime)}</td>
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
              <p className="text-center text-slate-400 py-8">ไม่มีรถที่มอบหมายสถานีนี้</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left py-2 px-2">ทะเบียน</th>
                    <th className="table-header text-left py-2 px-2">ลูกค้า</th>
                    <th className="table-header text-left py-2 px-2">ชั่งเข้า</th>
                  </tr>
                </thead>
                <tbody>
                  {stationPopup.vehicles.map(v => (
                    <tr key={v.TripID} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 font-bold text-slate-800">{v.LicensePlate}</td>
                      <td className="py-2 px-2 text-slate-600 text-xs">{v.CustomerName || '-'}</td>
                      <td className="py-2 px-2 text-slate-500 text-xs">
                        {v.WeighInTime ? dayjs(v.WeighInTime).format('HH:mm') : '-'}
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
