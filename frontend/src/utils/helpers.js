import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

dayjs.extend(buddhistEra);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.locale('th');

export const formatDateTime = (dt) => {
  if (!dt) return '-';
  return dayjs(dt).format('DD/MM/YYYY HH:mm');
};

export const formatDate = (dt) => {
  if (!dt) return '-';
  return dayjs(dt).format('DD/MM/YYYY');
};

export const formatTime = (dt) => {
  if (!dt) return '-';
  return dayjs(dt).format('HH:mm:ss');
};

export const formatDuration = (minutes, t) => {
  if (!minutes || minutes < 0) return '-';
  const min = t ? t('unit.minutes') : 'นาที';
  const hr = t ? t('unit.hours') : 'ชม.';
  if (minutes < 60) return `${minutes} ${min}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ${hr} ${m} ${min}` : `${h} ${hr}`;
};

export const formatWeight = (weight) => {
  if (!weight && weight !== 0) return '-';
  return `${parseFloat(weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} กก.`;
};

export const getStatusConfig = (status) => {
  const configs = {
    WeighIn:        { labelKey: 'status.weighIn',         color: 'bg-blue-50 text-blue-600 border-blue-200',       dot: 'bg-blue-500',   step: 1 },
    Data:           { labelKey: 'status.data',            color: 'bg-purple-50 text-purple-600 border-purple-200', dot: 'bg-purple-500', step: 2 },
    WaitPick:       { labelKey: 'status.waitPick',        color: 'bg-rose-50 text-rose-600 border-rose-200',       dot: 'bg-rose-500',   step: 2 },
    SOWait:         { labelKey: 'status.soWait',          color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500', step: 2 },
    LoadingAssigned:{ labelKey: 'status.loadingAssigned', color: 'bg-amber-50 text-amber-600 border-amber-200',    dot: 'bg-amber-500',  step: 3 },
    Loading:        { labelKey: 'status.loading',         color: 'bg-amber-50 text-amber-600 border-amber-200',    dot: 'bg-amber-500',  step: 3 },
    LoadingBetween: { labelKey: 'status.loadingBetween',  color: 'bg-amber-50 text-amber-700 border-amber-300',    dot: 'bg-amber-600',  step: 3 },
    WeighOut:       { labelKey: 'status.weighOut',        color: 'bg-cyan-50 text-cyan-600 border-cyan-200',       dot: 'bg-cyan-500',   step: 4 },
    Checker:        { labelKey: 'status.checker',         color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500', step: 5 },
    Complete:       { labelKey: 'status.complete',        color: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500', step: 6 },
    Cancelled:      { labelKey: 'status.cancelled',       color: 'bg-red-50 text-red-500 border-red-200',          dot: 'bg-red-400',    step: 0 }
  };
  return configs[status] || { labelKey: null, label: status, color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', step: 0 };
};

export const getEffectiveStatusConfig = (trip) => {
  const { Status, SOWaitStartedAt, CurrentStation, HasLoadingRecord, HasDataStationTargets } = trip;
  if (Status === 'Loading') {
    const base = getStatusConfig('Loading');
    if (CurrentStation) return { ...base, labelKey: 'status.loadingAt', labelStation: CurrentStation };
    return { ...base, labelKey: 'status.loadingAssigned' };
  }
  if (Status === 'WaitPick') {
    if (HasLoadingRecord) return getStatusConfig('LoadingBetween');
    if (HasDataStationTargets) return getStatusConfig('LoadingAssigned');
    if (SOWaitStartedAt) return getStatusConfig('SOWait');
  }
  return getStatusConfig(Status);
};

export const getEtaStatus = (etaMinutes) => {
  if (etaMinutes === null || etaMinutes === undefined) return { color: 'text-slate-400', label: 'ไม่ทราบ' };
  if (etaMinutes <= 30) return { color: 'text-emerald-600', label: `${etaMinutes} นาที` };
  if (etaMinutes <= 60) return { color: 'text-amber-600', label: `${etaMinutes} นาที` };
  return { color: 'text-red-500', label: `${Math.round(etaMinutes / 60 * 10) / 10} ชม.` };
};

export const now = () => dayjs().format('HH:mm:ss');
