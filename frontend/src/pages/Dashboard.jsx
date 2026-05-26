import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { TruckIcon, CheckCircle, Clock, Scale, Activity, RefreshCw, ArrowRight } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime, formatDuration, formatWeight, getStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className={`stat-card ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-steel-400 text-sm">{title}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '-'}</p>
        {sub && <p className="text-steel-500 text-xs mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color === 'text-blue-400' ? 'bg-blue-500/10' : color === 'text-emerald-400' ? 'bg-emerald-500/10' : color === 'text-amber-400' ? 'bg-amber-500/10' : 'bg-steel-700'}`}>
        <Icon size={24} className={color} />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data.success) setData(res.data.data);
    } catch (err) {
      toast.error('ไม่สามารถโหลด Dashboard ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text="กำลังโหลด Dashboard..." />
    </div>
  );

  const today = data?.today || {};
  const weight = data?.weight || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="text-steel-400 text-sm mt-1">ข้อมูลวันนี้ — อัพเดตอัตโนมัติทุก 30 วินาที</p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm px-3 py-2">
          <RefreshCw size={14} />
          <span className="hidden sm:inline">รีเฟรช</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รถทั้งหมดวันนี้"
          value={today.TotalTrips || 0}
          sub="เที่ยวรถ"
          icon={TruckIcon}
          color="text-blue-400"
          onClick={() => navigate('/monitor')}
        />
        <StatCard
          title="เสร็จสิ้นแล้ว"
          value={today.Completed || 0}
          sub={`เฉลี่ย ${formatDuration(data?.avgProcessingMinutes)}`}
          icon={CheckCircle}
          color="text-emerald-400"
        />
        <StatCard
          title="กำลังดำเนินการ"
          value={today.InProgress || 0}
          sub="รถในคลัง"
          icon={Clock}
          color="text-amber-400"
          onClick={() => navigate('/monitor')}
        />
        <StatCard
          title="น้ำหนักรวม"
          value={weight.TotalNetWeight ? `${parseFloat(weight.TotalNetWeight).toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '0'}
          sub="กิโลกรัม (สุทธิ)"
          icon={Scale}
          color="text-cyan-400"
        />
      </div>

      {/* Flow status + Live trucks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Station flow status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">สถานะรถในคลัง</h3>
            <button onClick={() => navigate('/monitor')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
              ดูทั้งหมด <ArrowRight size={14} />
            </button>
          </div>

          {/* Flow pipeline */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { status: 'Data', label: 'รับเอกสาร' },
              { status: 'Loading', label: 'ขึ้นสินค้า' },
              { status: 'WeighOut', label: 'รอชั่งออก' }
            ].map(item => {
              const count = data?.statusFlow?.find(s => s.Status === item.status)?.Count || 0;
              const cfg = getStatusConfig(item.status);
              return (
                <div key={item.status} className={`border ${cfg.color.split(' ').find(c => c.startsWith('border')) || 'border-steel-600'} rounded-lg p-3 text-center`}>
                  <div className={`text-2xl font-bold ${cfg.color.split(' ').find(c => c.startsWith('text')) || 'text-white'}`}>
                    {count}
                  </div>
                  <div className="text-xs text-steel-400 mt-1">{item.label}</div>
                </div>
              );
            })}
          </div>

          {/* Loading station status */}
          <div>
            <p className="text-xs text-steel-500 uppercase tracking-wider mb-2">สถานีขึ้นสินค้า</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data?.stationLoad?.map(station => (
                <div key={station.StationName}
                  className="flex items-center justify-between px-3 py-2 bg-steel-700/50 rounded-lg">
                  <span className="text-steel-300 text-sm truncate">{station.StationName}</span>
                  <span className={`text-sm font-medium ${station.ActiveTrucks > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {station.ActiveTrucks > 0 ? `${station.ActiveTrucks} คัน` : '✓ ว่าง'}
                  </span>
                </div>
              ))}
              {!data?.stationLoad?.length && (
                <p className="text-steel-500 text-sm text-center py-4">ยังไม่มีสถานีที่กำหนด</p>
              )}
            </div>
          </div>
        </div>

        {/* Weekly trend chart */}
        <div className="card">
          <h3 className="card-header">จำนวนรถ 7 วันย้อนหลัง</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.weeklyTrend || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="TripDate" tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value, name) => [value, name === 'TotalTrips' ? 'รวม' : 'เสร็จ']}
              />
              <Bar dataKey="TotalTrips" fill="#3b82f6" radius={[4, 4, 0, 0]} name="TotalTrips" />
              <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">กิจกรรมล่าสุดวันนี้</h3>
          <Activity size={16} className="text-steel-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-steel-700">
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
                  className="border-b border-steel-700/50 hover:bg-steel-700/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/monitor?tripId=${trip.TripID}`)}>
                  <td className="table-cell font-medium text-white">
                    {trip.LicensePlate}
                    <div className="text-xs text-steel-500">{trip.VehicleType}</div>
                  </td>
                  <td className="table-cell hide-mobile">{trip.CustomerName || '-'}</td>
                  <td className="table-cell hide-mobile">{trip.WarehouseName || '-'}</td>
                  <td className="table-cell"><StatusBadge status={trip.Status} /></td>
                  <td className="table-cell hide-mobile">{formatDateTime(trip.CreatedAt)}</td>
                </tr>
              ))}
              {!data?.recentActivity?.length && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-steel-500">
                    ยังไม่มีข้อมูลวันนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
