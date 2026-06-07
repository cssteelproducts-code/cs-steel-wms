import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BrainCircuit, RefreshCw, TruckIcon, Clock, Scale, Users, Sparkles, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, TrendingUp, Package, Star } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';

const getPeakColor = (pct) => {
  if (pct >= 20) return '#dc2626';
  if (pct >= 12) return '#ef4444';
  if (pct >= 6)  return '#f59e0b';
  if (pct >= 2)  return '#60a5fa';
  return '#e2e8f0';
};

export default function Forecast() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);

  const fmtMin = (m) => {
    if (m == null) return '-';
    if (m < 60) return `${m} ${t('unit.minutes')}`;
    return `${Math.floor(m / 60)} ${t('unit.hours')} ${m % 60} ${t('unit.minutes')}`;
  };

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await api.get('/forecast/tomorrow');
      if (res.data.success) { setData(res.data.data); setLastUpdate(new Date()); setAiInsight(null); }
      else { toast.error(res.data.message || t('forecast.noData')); }
    } catch {
      toast.error(t('common.noData'));
    } finally { setLoading(false); }
  };

  const fetchAiInsight = async () => {
    if (!data) return;
    setAiLoading(true);
    try {
      const res = await api.post('/forecast/ai-insights', { forecastData: data });
      if (res.data.success) { setAiInsight(res.data.insight); }
      else { toast.error(res.data.message || t('common.noData')); }
    } catch {
      toast.error(t('common.noData'));
    } finally { setAiLoading(false); }
  };

  useEffect(() => { fetchForecast(); }, []);

  const activeHours = data?.hourDistribution?.filter(h => h.count > 0) || [];
  const displayHours = showAllHours ? activeHours : activeHours.filter(h => h.pct >= 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <BrainCircuit size={20} className="text-violet-500 flex-shrink-0" />
            {t('forecast.title')}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {lastUpdate ? `${t('monitor.lastUpdate')} ${lastUpdate.toLocaleTimeString()}` : t('common.loading')}
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
            <p className="text-sm text-slate-400">{t('forecast.loading')}</p>
          </div>
        </div>
      ) : !data ? (
        <div className="card text-center py-16">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
          <p className="text-slate-500">{t('forecast.noData')}</p>
          <p className="text-slate-400 text-xs mt-1">{t('forecast.needWeeks')}</p>
        </div>
      ) : (
        <>
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <BrainCircuit size={15} className="text-violet-500 flex-shrink-0" />
            <p className="text-sm text-violet-700">
              {data.tomorrowStr}
              <span className="text-violet-400 ml-2 text-xs">{t('forecast.basedOn').replace('{n}', data.basedOnDays)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('forecast.expectedVehicles')}</p>
                  <p className="text-2xl font-bold text-violet-600 mt-0.5">{data.vehicleCount.avg}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{t('forecast.range').replace('{min}', data.vehicleCount.min).replace('{max}', data.vehicleCount.max)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-50"><TruckIcon size={20} className="text-violet-500" /></div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('forecast.peakHour')}</p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">{data.peakHour.hour}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{t('forecast.peakPct').replace('{n}', data.peakHour.pct)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50"><Clock size={20} className="text-red-500" /></div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('forecast.avgWeight')}</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                    {data.avgNetWeight ? data.avgNetWeight.toLocaleString('th-TH') : '-'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {data.minNetWeight != null && data.maxNetWeight != null
                      ? `${data.minNetWeight.toLocaleString('th-TH')} – ${data.maxNetWeight.toLocaleString('th-TH')} กก.`
                      : t('forecast.avgWeightUnit')}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50"><Scale size={20} className="text-emerald-500" /></div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('forecast.avgTime')}</p>
                  <p className="text-2xl font-bold text-amber-600 mt-0.5">{data.avgTotalMinutes ?? '-'}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {data.minTotalMinutes != null && data.maxTotalMinutes != null
                      ? `${data.minTotalMinutes} – ${data.maxTotalMinutes} นาที`
                      : t('forecast.avgTimeUnit')}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50"><Clock size={20} className="text-amber-500" /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-header mb-0">{t('forecast.peakChart')}</h3>
                <button onClick={() => setShowAllHours(v => !v)}
                  className="text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1">
                  {showAllHours ? <><ChevronUp size={12} />{t('forecast.collapse')}</> : <><ChevronDown size={12} />{t('forecast.showAll')}</>}
                </button>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={displayHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => [`${v} ${t('unit.vehicles')}`, t('forecast.expectedVehicles')]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {displayHours.map((h, i) => <Cell key={i} fill={getPeakColor(h.pct)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="card">
                <h3 className="card-header mb-3">{t('forecast.vehicleTypes')}</h3>
                <div className="space-y-2">
                  {data.vehicleTypes.slice(0, 5).map(v => (
                    <div key={v.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{v.type}</span>
                        <span className="text-slate-400">{v.count} {t('forecast.times')} ({v.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-violet-400 rounded-full transition-all" style={{ width: `${v.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {data.topCustomers.length > 0 && (
                <div className="card">
                  <h3 className="card-header mb-3 flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />{t('forecast.topCustomers')}
                  </h3>
                  <div className="space-y-1">
                    {data.topCustomers.slice(0, 10).map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[10px]">{i + 1}</span>
                          <span className="text-slate-700">{c.name}</span>
                        </div>
                        <span className="text-slate-400">{c.count} {t('forecast.times')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* แนวโน้มย้อนหลัง */}
          {data.historicalTrend?.length > 1 && (
            <div className="card">
              <h3 className="card-header mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-violet-500" />
                แนวโน้มจำนวนรถ ({data.historicalTrend.length} ครั้งย้อนหลัง)
              </h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={data.historicalTrend} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v} คัน`, 'จำนวนรถ']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Delivery type + Priority + เวลาแยกตามรถ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {data.deliveryTypeBreakdown?.length > 0 && (
              <div className="card">
                <h3 className="card-header mb-3 flex items-center gap-2">
                  <Package size={14} className="text-blue-500" />
                  ประเภทการส่ง
                </h3>
                <div className="space-y-2">
                  {data.deliveryTypeBreakdown.map(d => (
                    <div key={d.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{d.type}</span>
                        <span className="text-slate-400">{d.count} คัน ({d.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-blue-400 rounded-full" style={{ width: `${d.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.priorityBreakdown?.length > 0 && (
              <div className="card">
                <h3 className="card-header mb-3 flex items-center gap-2">
                  <Star size={14} className="text-amber-500" />
                  ระดับความสำคัญ
                </h3>
                <div className="space-y-2">
                  {data.priorityBreakdown.map(p => (
                    <div key={p.priority}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{p.priority}</span>
                        <span className="text-slate-400">{p.count} คัน ({p.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className={`h-1.5 rounded-full ${p.priority === 'Urgent' ? 'bg-red-400' : 'bg-slate-400'}`}
                          style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.avgTimeByType?.length > 0 && (
              <div className="card">
                <h3 className="card-header mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-emerald-500" />
                  เวลาเฉลี่ยแยกตามรถ
                </h3>
                <div className="space-y-2">
                  {data.avgTimeByType.map(v => (
                    <div key={v.type} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-700 font-medium">{v.type}</span>
                      <span className="font-bold text-emerald-600">{fmtMin(v.avgMinutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.avgByStation.length > 0 && (
            <div className="card">
              <h3 className="card-header mb-3">{t('forecast.avgByStation')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.avgByStation.map(s => (
                  <div key={s.station} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-amber-600 font-bold mb-1">{s.station}</p>
                    <p className="text-xl font-bold text-amber-700">{s.avgMinutes}</p>
                    <p className="text-xs text-amber-400">{t('unit.minutes')} ({s.sampleCount} {t('forecast.sample')})</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card border border-violet-100" style={{ background: 'linear-gradient(135deg,#faf5ff 0%,#f0fdf4 100%)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-violet-700 flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                {t('forecast.aiTitle')}
              </h3>
              {!aiInsight && (
                <button onClick={fetchAiInsight} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
                  {aiLoading
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('forecast.aiAnalyzing')}</>
                    : <><Sparkles size={12} />{t('forecast.aiAnalyze')}</>}
                </button>
              )}
              {aiInsight && (
                <button onClick={() => { setAiInsight(null); fetchAiInsight(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 text-xs hover:bg-violet-50 transition-colors">
                  <RefreshCw size={12} />{t('forecast.aiReanalyze')}
                </button>
              )}
            </div>

            {!aiInsight && !aiLoading && (
              <p className="text-sm text-slate-400 text-center py-6">{t('forecast.aiPrompt')}</p>
            )}
            {aiLoading && (
              <div className="text-center py-8 space-y-2">
                <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-violet-400">{t('forecast.aiLoading')}</p>
              </div>
            )}
            {aiInsight && (
              <div className="bg-white rounded-xl border border-violet-100 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-xs text-slate-400">{t('forecast.aiBy')}</span>
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
