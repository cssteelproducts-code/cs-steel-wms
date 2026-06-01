import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TruckIcon, CheckCircle, Clock, Scale, Activity,
  Calendar, Package, ChevronDown, ChevronUp, X, RefreshCw, BarChart2
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime, formatDuration, formatWeight } from '../utils/helpers';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useLang } from '../context/LanguageContext';
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
  const { t } = useLang();
  const [flipped, setFlipped] = useState(false);
  const total = (deliveryStats || []).reduce((s, r) => s + (r[periodKey] || 0), 0);
  const face = {
    background: '#ffffff', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
    borderRadius: '1rem', padding: '1rem',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    position: 'absolute', inset: 0, overflow: 'hidden', boxSizing: 'border-box'
  };
  return (
    <div style={{ perspective: '1000px', minHeight: 150, cursor: 'pointer', overflow: 'hidden', borderRadius: '1rem' }} onClick={() => setFlipped(f => !f)}>
      <div style={{
        position: 'relative', minHeight: 150,
        transformStyle: 'preserve-3d', transition: 'transform 0.4s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)'
      }}>
        <div style={face}>
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between flex-1">
              <div>
                <p className="text-slate-500 text-xs">{title}</p>
                <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? 0}</p>
                <p className="text-slate-400 text-xs mt-0.5">{t('unit.vehicles')}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${colorBg[color] || 'bg-slate-100'}`}>
                <Icon size={20} className={color} />
              </div>
            </div>
            <p className="text-slate-400 text-xs text-right mt-1">{t('dash.detailBtn')} →</p>
          </div>
        </div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-600 leading-tight">{title}</p>
            <p className="text-xs font-normal text-slate-400">{t('dash.deliveryType')}</p>
          </div>
          <div className="space-y-2">
            {DELIVERY_TYPES.map(dt => {
              const row = (deliveryStats || []).find(r => r.DeliveryType === dt.key);
              const count = row?.[periodKey] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={dt.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-semibold ${dt.color}`}>{dt.label}</span>
                    <span className={`text-xs font-bold ${dt.color}`}>{count}
                      <span className="text-slate-400 font-normal ml-1">/{pct}%</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full transition-all ${dt.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-400 text-xs text-right mt-2">←</p>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, sectionKey, collapsed, onToggle, icon: Icon, iconColor, extra }) => {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="card-header mb-0 flex items-center gap-2">
        {Icon && <Icon size={16} className={iconColor || 'text-slate-400'} />}
        {title}
      </h3>
      <div className="flex items-center gap-2">
        {extra}
        <button onClick={() => onToggle(sectionKey)}
          className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          title={collapsed ? t('dash.expand') : t('dash.collapse')}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { t } = useLang();
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

  const [stationPopup, setStationPopup] = useState(null);

  const openStationPopup = async (stationName) => {
    setStationPopup({ stationName, vehicles: [], loading: true });
    try {
      const res = await api.get(`/dashboard/station-vehicles?stationName=${encodeURIComponent(stationName)}`);
      if (res.data.success) setStationPopup({ stationName, vehicles: res.data.data, loading: false });
    } catch {
      setStationPopup(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data.success) { setData(res.data.data); setLastUpdate(new Date()); }
    } catch {
      toast.error(t('common.noData'));
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
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );

  const todayStats = data?.today || {};
  const weight = data?.weight || {};
  const counts = data?.tripCounts || {};
  const wh = data?.weightHistory || {};
  const ot = data?.onTimeStats || {};
  const fmtKg = (v) => v ? `${parseFloat(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ${t('unit.kg')}` : '-';
  const fmtMin = (m) => {
    if (!m && m !== 0) return '-';
    if (m < 60) return `${Math.round(m)} ${t('unit.minutes')}`;
    return `${Math.floor(m / 60)} ${t('unit.hours')} ${Math.round(m % 60)} ${t('unit.minutes')}`;
  };

  return (
    <>
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <BarChart2 size={20} className="text-blue-500 flex-shrink-0" />
            Dashboard
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FlipStatCard title={t('common.today')} value={counts.TodayTotal ?? 0} icon={Calendar} color="text-blue-500" deliveryStats={data?.deliveryTypeStats} periodKey="TodayCount" />
        <FlipStatCard title={t('common.month')} value={counts.MonthTotal ?? 0} icon={TruckIcon} color="text-emerald-500" deliveryStats={data?.deliveryTypeStats} periodKey="MonthCount" />
        <FlipStatCard title={t('common.year')} value={counts.YearTotal ?? 0} icon={Package} color="text-violet-500" deliveryStats={data?.deliveryTypeStats} periodKey="YearCount" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dash.totalVehicles')} value={todayStats.TotalTrips || 0} sub={t('dash.trips')} icon={TruckIcon} color="text-blue-500" />
        <StatCard title={t('dash.completed')} value={todayStats.Completed || 0} sub={`${t('dash.avgTime')} ${formatDuration(data?.avgProcessingMinutes, t)}`} icon={CheckCircle} color="text-emerald-500" />
        <StatCard title={t('dash.inProgress')} value={todayStats.InProgress || 0} sub={t('dash.vehiclesInYard')} icon={Clock} color="text-amber-500" onClick={() => navigate('/monitor')} />
        <StatCard
          title={t('dash.totalWeight')}
          value={weight.TotalNetWeight ? `${parseFloat(weight.TotalNetWeight).toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '0'}
          sub={t('dash.totalWeightUnit')}
          icon={Scale}
          color="text-cyan-500"
        />
      </div>

      {/* Station load */}
      <div className="card">
        <SectionHeader title={t('dash.stationLoad')} sectionKey="station" collapsed={collapsed.station} onToggle={toggleSection}
          extra={<span className="text-xs text-slate-500">{data?.stationLoad?.filter(s => s.ActiveTrucks > 0).length || 0} {t('unit.station')}</span>} />
        {!collapsed.station && (
          data?.stationLoad?.filter(s => s.ActiveTrucks > 0).length ? (
            <div className="space-y-2">
              {[...data.stationLoad].filter(s => s.ActiveTrucks > 0).sort((a, b) => a.StationName.localeCompare(b.StationName, undefined, { numeric: true })).map(st => {
                const pct = Math.min(st.ActiveTrucks * 20, 100);
                const barColor = st.ActiveTrucks > 5 ? 'bg-red-400' : st.ActiveTrucks >= 3 ? 'bg-amber-400' : 'bg-emerald-400';
                const textColor = st.ActiveTrucks > 5 ? 'text-red-600' : st.ActiveTrucks >= 3 ? 'text-amber-600' : 'text-emerald-600';
                return (
                  <div key={st.StationName}
                    className={st.ActiveTrucks > 0 ? 'cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors' : ''}
                    onClick={() => st.ActiveTrucks > 0 && openStationPopup(st.StationName)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-slate-700">{st.StationName}</span>
                      <span className={`text-sm font-semibold ${textColor}`}>
                        {st.ActiveTrucks > 0 ? `${st.ActiveTrucks} ${t('unit.vehicles')}` : t('dash.free')}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${st.ActiveTrucks > 0 ? Math.max(pct, 8) : 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dash.noStationAssigned')}</p>
          )
        )}
      </div>

      {/* Checker avg time by vehicle type */}
      {data?.checkerAvgByVehicleType?.length > 0 && (() => {
        const maxAvg = Math.max(...data.checkerAvgByVehicleType.map(s => s.AvgMinutes || 0), 1);
        return (
          <div className="card">
            <SectionHeader title={t('dash.checkerAvgByType')} sectionKey="checkerAvg" collapsed={collapsed.checkerAvg} onToggle={toggleSection}
              icon={Clock}
              extra={<span className="text-xs text-slate-400">30 {t('common.date')}</span>} />
            {!collapsed.checkerAvg && (
              <div className="space-y-3">
                {data.checkerAvgByVehicleType.map(s => {
                  const pct = Math.round((s.AvgMinutes / maxAvg) * 100);
                  const barColor = pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-400';
                  return (
                    <div key={s.TypeName}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-slate-700 truncate">{s.TypeName}</span>
                          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                            {s.TripCount} {t('dash.checkerAvgTrips')}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 ml-2 whitespace-nowrap">{fmtMin(s.AvgMinutes)}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-xs text-slate-400">{fmtMin(s.MinMinutes)}</span>
                        <span className="text-xs text-slate-400">{fmtMin(s.MaxMinutes)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Weight history */}
      <div className="card">
        <SectionHeader title={t('dash.weight')} sectionKey="weight" collapsed={collapsed.weight} onToggle={toggleSection} />
        {!collapsed.weight && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">{t('dash.yesterday')}</p>
              {wh.YesterdayWeight ? (
                <p className="text-base font-bold text-blue-600">{fmtKg(wh.YesterdayWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">{t('dash.noWeightData')}</p>
              )}
            </div>
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs text-slate-500 mb-1">{t('dash.dayBefore')}</p>
              {wh.DayBeforeWeight ? (
                <p className="text-base font-bold text-slate-600">{fmtKg(wh.DayBeforeWeight)}</p>
              ) : (
                <p className="text-sm text-slate-400">{t('dash.noWeightData')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* On time / overtime */}
      <div className="card">
        <SectionHeader title={t('dash.ontime')} sectionKey="ontime" collapsed={collapsed.ontime} onToggle={toggleSection} />
        {!collapsed.ontime && (() => {
          const todayMap = Object.fromEntries((data?.vehicleTypesToday || []).map(v => [v.TypeName, v.Count]));
          const monthMap = Object.fromEntries((data?.vtBreakdownMonth || []).map(v => [v.TypeName, v.Count]));
          const yearMap  = Object.fromEntries((data?.vtBreakdownYear  || []).map(v => [v.TypeName, v.Count]));
          const allTypes = [...new Set([...Object.keys(todayMap), ...Object.keys(monthMap), ...Object.keys(yearMap)])].sort();
          const otCards = [
            { label: t('common.today'),  inTime: ot.TodayOnTime,  overtime: ot.TodayOvertime,  types: data?.overtimeByTypeToday  || [] },
            { label: t('common.month'),  inTime: ot.MonthOnTime,  overtime: ot.MonthOvertime,  types: data?.overtimeByTypeMonth || [] },
            { label: t('common.year'),   inTime: ot.YearOnTime,   overtime: ot.YearOvertime,   types: data?.overtimeByTypeYear  || [] },
          ];
          const maxTypes = Math.max(0, ...otCards.map(c => c.types.length));
          const cardMinH = Math.max(100, maxTypes > 0 ? maxTypes * 28 + 52 : 100);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {otCards.map(({ label, inTime, overtime, types }) => {
                  const isFlipped = !!overtimeFlipped[label];
                  const face = {
                    borderRadius: 12, padding: 12,
                    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                    position: 'absolute', inset: 0, overflow: 'hidden', boxSizing: 'border-box'
                  };
                  return (
                    <div key={label}
                      style={{ perspective: '1000px', minHeight: cardMinH, cursor: 'pointer', borderRadius: 12 }}
                      onClick={() => setOvertimeFlipped(f => ({ ...f, [label]: !f[label] }))}>
                      <div style={{
                        position: 'relative', minHeight: cardMinH,
                        transformStyle: 'preserve-3d', transition: 'transform 0.4s ease',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)'
                      }}>
                        <div style={{ ...face, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <p className="text-xs font-semibold text-slate-400 mb-2 text-center">{label}</p>
                          <div className="flex justify-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-emerald-600">{inTime ?? 0}</p>
                              <p className="text-xs text-slate-400">{t('dash.ontimeLabel')}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-amber-500">{overtime ?? 0}</p>
                              <p className="text-xs text-slate-400">{t('dash.overtimeLabel')}</p>
                            </div>
                          </div>
                          {(overtime ?? 0) > 0 && (
                            <p className="text-xs text-slate-300 text-right mt-1.5">{t('dash.detailBtn')} →</p>
                          )}
                        </div>
                        <div style={{ ...face, transform: 'rotateY(180deg)', background: '#fffbeb', border: '1px solid #fde68a' }}>
                          <p className="text-xs font-semibold text-amber-700 mb-2">{label} — {t('dash.overtimeLabel')}</p>
                          {types.length > 0 ? (
                            <div className="space-y-1.5">
                              {types.map(item => (
                                <div key={item.TypeName} className="flex justify-between items-center">
                                  <span className="text-xs text-slate-600 truncate mr-1">{item.TypeName}</span>
                                  <span className="text-xs font-bold text-amber-600 flex-shrink-0">{item.Count} {t('unit.vehicles')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center mt-2">{t('dash.noInProgress')} ✓</p>
                          )}
                          <p className="text-xs text-slate-400 text-right mt-1.5">←</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {allTypes.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{t('common.vehicleType')}</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-blue-600">{t('common.today')}</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-emerald-600">{t('common.month')}</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-violet-600">{t('common.year')}</th>
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

      {/* Chart */}
      <div className="card">
        <SectionHeader title={t('dash.chart')} sectionKey="chart" collapsed={collapsed.chart} onToggle={toggleSection}
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
                formatter={(value) => [value, t('dash.totalVehicles')]}
              />
              <Bar dataKey="TotalTrips" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('dash.totalVehicles')} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent activity */}
      <div className="card">
        <SectionHeader title={t('dash.recentActivity')} sectionKey="activity" collapsed={collapsed.activity} onToggle={toggleSection}
          icon={Activity} iconColor="text-slate-400" />
        {!collapsed.activity && <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header text-left px-4 py-2">{t('common.licensePlate')}</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">{t('common.customer')}</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">{t('common.warehouse')}</th>
                <th className="table-header text-left px-4 py-2">{t('common.status')}</th>
                <th className="table-header text-left px-4 py-2 hide-mobile">{t('weighIn.entryTime')}</th>
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
                  <td colSpan={5} className="text-center py-8 text-slate-400">{t('dash.noActivity')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
      </div>

    </div>

    {/* Station popup */}
    {stationPopup && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-800">{stationPopup.stationName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stationPopup.loading ? t('common.loading') : `${stationPopup.vehicles.length} ${t('unit.vehicles')}`}
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
                <LoadingSpinner size="md" text={t('common.loading')} />
              </div>
            ) : stationPopup.vehicles.length === 0 ? (
              <p className="text-center text-slate-400 py-8">{t('dash.noVehiclesNow')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header text-left py-2 px-2">{t('common.licensePlate')}</th>
                    <th className="table-header text-left py-2 px-2">{t('common.customer')}</th>
                    <th className="table-header text-left py-2 px-2">{t('weighIn.entryTime')}</th>
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
