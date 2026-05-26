import { getStatusConfig } from '../utils/helpers';

export default function StatusBadge({ status }) {
  const config = getStatusConfig(status);
  return (
    <span className={`badge-status border ${config.color} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status !== 'Complete' && status !== 'Cancelled' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}
