import { getStatusConfig } from '../utils/helpers';

export default function StatusBadge({ status, soWait }) {
  const effectiveStatus = (status === 'WaitPick' && soWait) ? 'SOWait' : status;
  const config = getStatusConfig(effectiveStatus);
  return (
    <span className={`badge-status border ${config.color} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${effectiveStatus !== 'Complete' && effectiveStatus !== 'Cancelled' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}
