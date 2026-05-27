import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TruckIcon, CheckCircle, Clock, Scale, Activity, RefreshCw, ArrowRight,
  Calendar, Package, AlertTriangle, Search
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime, formatDuration, formatWeight, getStatusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className={`stat-card ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-500 text-sm">{title}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '-'}</p>
        {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color === 'text-blue-500' ? 'bg-blue-50' : color === 'text-emerald-500' ? 'bg-emerald-50' : color === 'text-amber-500' ? 'bg-amber-50' : color === 'text-cyan-500' ? 'bg-cyan-50' : color === 'text-red-500' ? 'bg-red-50' : color === 'text-violet-500' ? 'bg-violet-50' : 'bg-slate-100'}`}>
        <Icon size={24} className={color} />
      </div>
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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">ภาพรวมคลังสินค้า — อัพเดตอัตโนมัติทุก 30 วินาที</p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm px-3 py-2">
          <RefreshCw size={14} />
          <span className="hidden sm:inline">รีเฟรช</span>
        </button>
      </div>

      {/* Stat cards: today / month / year */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="วันนี้"
          value={counts.TodayTotal ?? 0}
          sub="คัน"
          icon={Calendar}
          color="text-blue-500"
          onClick={() => navigate('/monitor')}
        />
        <StatCard
          title="เดือนนี้"
          value={counts.MonthTotal ?? 0}
          sub="คัน"
          icon={TruckIcon}
          color="text-emerald-500"
        />
        <StatCard
          title="ปีนี้"
          value={counts.YearTotal ?? 0}
          sub="คัน"
          icon={Package}
          color="text-violet-500"
        />
      </div>

      {/* น้ำหนักสินค้าที่ขึ้น */}
      <div className="card">
        <h3 className="card-header">น้ำหนักสินค้าที่ขึ้น</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs text-slate-500 mb-1">วันนี้</p>
            {wh.TodayWeight ? (
              <p className="text-xl font-bold text-blue-600">{fmtKg(wh.TodayWeight)}</p>
            ) : (
              <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
            )}
          </div>
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs text-slate-500 mb-1">เมื่อวาน</p>
            {wh.YesterdayWeight ? (
              <p className="text-xl font-bold text-slate-600">{fmtKg(wh.YesterdayWeight)}</p>
            ) : (
              <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>
      </div>

      {/* ประเภทรถ วันนี้ */}
      <div className="card">
        <h3 className="card-header">ประเภทรถ (วันนี้)</h3>
        {data?.vehicleTypesToday?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.vehicleTypesToday.map(vt => (
              <TypeTag key={vt.TypeName} name={vt.TypeName} count={vt.Count} color="bg-blue-50 text-blue-700" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">ยังไม่มีวันนี้</p>
        )}
      </div>

      {/* ในเวลา / นอกเวลา */}
      <div className="card">
        <h3 className="card-header">ในเวลา / นอกเวลา</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* วันนี้ */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">วันนี้</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">ในเวลา</span>
                <span className="text-lg font-bold text-emerald-600 ml-1">{ot.TodayOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-lg font-bold text-amber-600 ml-1">{ot.TodayOvertime ?? 0}</span>
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
                <span className="text-lg font-bold text-emerald-600 ml-1">{ot.MonthOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-lg font-bold text-amber-600 ml-1">{ot.MonthOvertime ?? 0}</span>
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
                <span className="text-lg font-bold text-emerald-600 ml-1">{ot.YearOnTime ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm text-slate-600">นอกเวลา</span>
                <span className="text-lg font-bold text-amber-600 ml-1">{ot.YearOvertime ?? 0}</span>
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
        </div>
      </div>

      {/* ปริมาณรถสะสมที่สถานี */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-header mb-0">ปริมาณรถสะสมที่สถานี</h3>
          <span className="text-xs text-slate-500">{data?.stationLoad?.length || 0} สถานี</span>
        </div>
        {data?.stationLoad?.length ? (
          <div className="space-y-2">
            {data.stationLoad.map(st => {
              const pct = Math.min(st.ActiveTrucks * 20, 100);
              return (
                <div key={st.StationName}>
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
          <p className="text-sm text-slate-400">ยังไม่มีสถานีที่กำหนด</p>
        )}
      </div>

      {/* รถที่ขึ้นสินค้าไม่แล้วเสร็จ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-header mb-0 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            รถที่ขึ้นสินค้าไม่แล้วเสร็จ
          </h3>
          {incomplete.length > 0 && (
            <button onClick={() => navigate('/monitor')} className="text-blue-500 text-xs flex items-center gap-1 hover:underline">
              ดูรายละเอียด <ArrowRight size={12} />
            </button>
          )}
        </div>
        {incomplete.length ? (
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
          <p className="text-sm text-slate-400">ไม่มีรถค้างขึ้นสินค้า</p>
        )}
      </div>

      {/* รถที่ดำเนินการเสร็จแล้ววันนี้ */}
      <div className="card">
        <h3 className="card-header flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-500" />
          รถที่ดำเนินการเสร็จแล้ววันนี้
        </h3>
        {completedTodayList.length ? (
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
          <p className="text-sm text-slate-400">ยังไม่มีการดำเนินการเสร็จสิ้นวันนี้</p>
        )}
      </div>

      {/* รถที่ดำเนินการเสร็จแล้วย้อนหลัง */}
      <div className="card">
        <h3 className="card-header">รถที่ดำเนินการเสร็จแล้วย้อนหลัง</h3>
        <div className="flex flex-wrap items-end gap-3 mb-4">
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
        </div>
        {histData !== null && (
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
        <h3 className="card-header">รายงานผลการจัดส่งรายทะเบียน</h3>
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
      </div>

      {/* --- เดิม: สถานะรถในคลัง + chart + กิจกรรมล่าสุด --- */}

      {/* Flow status + weekly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">สถานะรถในคลัง</h3>
            <button onClick={() => navigate('/monitor')} className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1">
              ดูทั้งหมด <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { status: 'Data', label: 'รับเอกสาร' },
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
              {data?.stationLoad?.map(station => (
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
        </div>

        <div className="card">
          <h3 className="card-header">จำนวนรถ 7 วันย้อนหลัง</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.weeklyTrend || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="TripDate" tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                labelStyle={{ color: '#475569' }}
                formatter={(value, name) => [value, name === 'TotalTrips' ? 'รวม' : 'เสร็จ']}
              />
              <Bar dataKey="TotalTrips" fill="#3b82f6" radius={[4, 4, 0, 0]} name="TotalTrips" />
              <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">กิจกรรมล่าสุดวันนี้</h3>
          <Activity size={16} className="text-slate-400" />
        </div>
        <div className="overflow-x-auto">
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
        </div>
      </div>
    </div>
  );
}
