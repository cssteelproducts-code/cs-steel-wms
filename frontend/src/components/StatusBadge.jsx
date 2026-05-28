import { getStatusConfig, getEffectiveStatusConfig } from '../utils/helpers';

export default function StatusBadge({ status, trip }) {
  const config = trip ? getEffectiveStatusConfig(trip) : getStatusConfig(status);
  const key = trip ? trip.Status : status;
  const isActive = key !== 'Complete' && key !== 'Cancelled';
  return (
    <span className={`badge-status border ${config.color} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${isActive ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}
