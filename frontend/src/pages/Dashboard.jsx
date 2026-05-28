import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TruckIcon, CheckCircle, Clock, Scale, Activity,
  Calendar, Package, Search, ChevronDown, ChevronUp, X, RefreshCw, BarChart2
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
          <p className="text-xs font-semibold text-slate-600 mb-2">{title} — ประเภทขนส่ง</p>
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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dash_collapsed') || '{}'); } catch { return {}; }
  });
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
      if (res.data.success) setData(res.data.data);
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

      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white">
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

      {/* ในเวลา / นอกเวลา */}
      <div className="card">
        <SectionHeader title="ในเวลา / นอกเวลา" sectionKey="ontime" collapsed={collapsed.ontime} onToggle={toggleSection} />
        {!collapsed.ontime && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* วันนี้ */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">วันนี้</p>
            <div className="flex items-center gap-4 mb-2">
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
            {data?.vehicleTypesToday?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.vehicleTypesToday.map(vt => (
                  <TypeTag key={vt.TypeName} name={vt.TypeName} count={vt.Count} color="bg-blue-50 text-blue-700" />
                ))}
              </div>
            )}
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

      {/* Weekly bar chart */}
      <div className="card">
        <SectionHeader title="ปริมาณรถย้อนหลัง 7 วัน" sectionKey="chart" collapsed={collapsed.chart} onToggle={toggleSection}
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
