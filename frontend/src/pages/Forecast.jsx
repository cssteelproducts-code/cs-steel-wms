import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BrainCircuit, RefreshCw, TruckIcon, Clock, Scale, Users, Sparkles, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

function fmtMin(m) {
  if (m == null) return '-';
  if (m < 60) return `${m} นาที`;
  return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

const PEAK_COLORS = ['#94a3b8', '#60a5fa', '#f59e0b', '#ef4444', '#dc2626', '#b91c1c', '#ef4444', '#f59e0b', '#60a5fa', '#94a3b8'];
const getPeakColor = (pct) => {
  if (pct >= 20) return '#dc2626';
  if (pct >= 12) return '#ef4444';
  if (pct >= 6)  return '#f59e0b';
  if (pct >= 2)  return '#60a5fa';
  return '#e2e8f0';
};

export default function Forecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await api.get('/forecast/tomorrow');
      if (res.data.success) {
        setData(res.data.data);
        setLastUpdate(new Date());
        setAiInsight(null);
      } else {
        toast.error(res.data.message || 'ไม่มีข้อมูลเพียงพอ');
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลพยากรณ์ได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsight = async () => {
    if (!data) return;
    setAiLoading(true);
    try {
      const res = await api.post('/forecast/ai-insights', { forecastData: data });
      if (res.data.success) {
        setAiInsight(res.data.insight);
      } else {
        toast.error(res.data.message || 'AI ไม่พร้อมใช้งาน');
      }
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อ AI ได้');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { fetchForecast(); }, []);

  const activeHours = data?.hourDistribution?.filter(h => h.count > 0) || [];
  const displayHours = showAllHours ? activeHours : activeHours.filter(h => h.pct >= 1);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <BrainCircuit size={20} className="text-violet-500 flex-shrink-0" />
            วิเคราะห์และวางแผนล่วงหน้า
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `อัพเดตล่าสุด: ${lastUpdate.toLocaleTimeString('th-TH')}` : 'กำลังโหลด...'}
          </p>
        </div>
        <button onClick={fetchForecast} disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white flex-shrink-0">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">กำลังวิเคราะห์ข้อมูลย้อนหลัง...</p>
          </div>
        </div>
      ) : !data ? (
        <div className="card text-center py-16">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
          <p className="text-slate-500">ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์</p>
          <p className="text-slate-400 text-xs mt-1">ต้องมีข้อมูลย้อนหลังอย่างน้อย 1 สัปดาห์</p>
        </div>
      ) : (
        <>

          {/* Tomorrow label */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <BrainCircuit size={15} className="text-violet-500 flex-shrink-0" />
            <p className="text-sm text-violet-700">
              พยากรณ์วัน<span className="font-bold">ว{data.tomorrowDow}</span> — {data.tomorrowStr}
              <span className="text-violet-400 ml-2 text-xs">(อิงจากข้อมูลย้อนหลัง {data.basedOnDays} สัปดาห์)</span>
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">คาดการณ์จำนวนรถ</p>
                  <p className="text-2xl font-bold text-violet-600 mt-0.5">{data.vehicleCount.avg}</p>
                  <p className="text-slate-400 text-xs mt-0.5">คัน (ช่วง {data.vehicleCount.min}–{data.vehicleCount.max})</p>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-50">
                  <TruckIcon size={20} className="text-violet-500" />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">ช่วงหนาแน่นสูงสุด</p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">{data.peakHour.hour}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{data.peakHour.pct}% ของรถทั้งหมด</p>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50">
                  <Clock size={20} className="text-red-500" />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">น้ำหนักสุทธิเฉลี่ย</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                    {data.avgNetWeight ? data.avgNetWeight.toLocaleString('th-TH') : '-'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">กก. / คัน</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50">
                  <Scale size={20} className="text-emerald-500" />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">เวลาเฉลี่ยต่อคัน</p>
                  <p className="text-2xl font-bold text-amber-600 mt-0.5">
                    {data.avgTotalMinutes ?? '-'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">นาที (ชั่งเข้า → ชั่งออก)</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50">
                  <Clock size={20} className="text-amber-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Peak hours chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0">ช่วงเวลาหนาแน่น</h3>
                <button onClick={() => setShowAllHours(v => !v)}
                  className="text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1">
                  {showAllHours ? <><ChevronUp size={12} />ย่อ</> : <><ChevronDown size={12} />ดูทั้งหมด</>}
                </button>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={displayHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => [`${v} คัน`, 'คาดการณ์']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {displayHours.map((h, i) => (
                      <Cell key={i} fill={getPeakColor(h.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {[['#dc2626','หนาแน่นมาก (≥20%)'],['#ef4444','หนาแน่น (≥12%)'],['#f59e0b','ปานกลาง (≥6%)'],['#60a5fa','น้อย']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>

            {/* Vehicle type + time breakdown */}
            <div className="space-y-4">

              {/* Vehicle types */}
              <div className="card">
                <h3 className="card-header mb-3">ประเภทรถที่คาดว่าจะเข้า</h3>
                <div className="space-y-2">
                  {data.vehicleTypes.slice(0, 5).map(v => (
                    <div key={v.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{v.type}</span>
                        <span className="text-slate-400">{v.count} ครั้ง ({v.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-violet-400 rounded-full transition-all" style={{ width: `${v.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top customers */}
              {data.topCustomers.length > 0 && (
                <div className="card">
                  <h3 className="card-header mb-3 flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />ลูกค้าที่มาบ่อย
                  </h3>
                  <div className="space-y-1">
                    {data.topCustomers.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[10px]">{i + 1}</span>
                          <span className="text-slate-700">{c.name}</span>
                        </div>
                        <span className="text-slate-400">{c.count} ครั้ง</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Avg time per station */}
          {data.avgByStation.length > 0 && (
            <div className="card">
              <h3 className="card-header mb-3">เวลาเฉลี่ยต่อสถานีขึ้นสินค้า</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.avgByStation.map(s => (
                  <div key={s.station} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-amber-600 font-bold mb-1">{s.station}</p>
                    <p className="text-xl font-bold text-amber-700">{s.avgMinutes}</p>
                    <p className="text-xs text-amber-400">นาที ({s.sampleCount} ตัวอย่าง)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insights */}
          <div className="card border border-violet-100" style={{ background: 'linear-gradient(135deg,#faf5ff 0%,#f0fdf4 100%)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-violet-700 flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                AI คำแนะนำการวางแผน
              </h3>
              {!aiInsight && (
                <button onClick={fetchAiInsight} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
                  {aiLoading
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังวิเคราะห์...</>
                    : <><Sparkles size={12} />วิเคราะห์ด้วย AI</>}
                </button>
              )}
              {aiInsight && (
                <button onClick={() => { setAiInsight(null); fetchAiInsight(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 text-xs hover:bg-violet-50 transition-colors">
                  <RefreshCw size={12} />วิเคราะห์ใหม่
                </button>
              )}
            </div>

            {!aiInsight && !aiLoading && (
              <p className="text-sm text-slate-400 text-center py-6">
                กด <span className="font-medium text-violet-600">วิเคราะห์ด้วย AI</span> เพื่อให้ Claude สรุปและแนะนำแผนการทำงานวันพรุ่งนี้
              </p>
            )}

            {aiLoading && (
              <div className="text-center py-8 space-y-2">
                <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-violet-400">Claude กำลังวิเคราะห์ข้อมูล...</p>
              </div>
            )}

            {aiInsight && (
              <div className="bg-white rounded-xl border border-violet-100 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-xs text-slate-400">วิเคราะห์โดย Claude AI</span>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiInsight}</div>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
