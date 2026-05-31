import { useLang } from '../context/LanguageContext';

const CONFIG = {
  'ด่วนมาก': { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#dc2626', key: 'priority.veryUrgent' },
  'เร่งด่วน': { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', dot: '#f97316', key: 'priority.urgent' },
  'ปกติ':    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#22c55e', key: 'priority.normal' },
};

export default function PriorityBadge({ priority }) {
  const { t } = useLang();
  if (!priority) return null;
  const c = CONFIG[priority] || CONFIG['ปกติ'];
  const label = c.key ? t(c.key) : priority;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}
