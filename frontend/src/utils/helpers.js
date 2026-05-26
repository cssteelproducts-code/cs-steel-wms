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

export const formatDuration = (minutes) => {
  if (!minutes || minutes < 0) return '-';
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
};

export const formatWeight = (weight) => {
  if (!weight && weight !== 0) return '-';
  return `${parseFloat(weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} กก.`;
};

export const getStatusConfig = (status) => {
  const configs = {
    WeighIn: { label: 'ชั่งเข้า', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-400', step: 1 },
    Data: { label: 'รับเอกสาร', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', dot: 'bg-purple-400', step: 2 },
    Loading: { label: 'ขึ้นสินค้า', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400', step: 3 },
    Checker: { label: 'เช็คเกอร์', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-400', step: 4 },
    WeighOut: { label: 'รอชั่งออก', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', dot: 'bg-cyan-400', step: 5 },
    Complete: { label: 'เสร็จสิ้น', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', step: 6 },
    Cancelled: { label: 'ยกเลิก', color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-400', step: 0 }
  };
  return configs[status] || { label: status, color: 'bg-steel-500/20 text-steel-400', dot: 'bg-steel-400', step: 0 };
};

export const getEtaStatus = (etaMinutes) => {
  if (etaMinutes === null || etaMinutes === undefined) return { color: 'text-steel-400', label: 'ไม่ทราบ' };
  if (etaMinutes <= 30) return { color: 'text-emerald-400', label: `${etaMinutes} นาที` };
  if (etaMinutes <= 60) return { color: 'text-amber-400', label: `${etaMinutes} นาที` };
  return { color: 'text-red-400', label: `${Math.round(etaMinutes / 60 * 10) / 10} ชม.` };
};

export const now = () => dayjs().format('HH:mm:ss');
