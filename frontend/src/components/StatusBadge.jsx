import { getStatusConfig, getEffectiveStatusConfig } from '../utils/helpers';
import { useLang } from '../context/LanguageContext';

export default function StatusBadge({ status, trip }) {
  const { t } = useLang();
  const config = trip ? getEffectiveStatusConfig(trip) : getStatusConfig(status);
  const key = trip ? trip.Status : status;
  const isActive = key !== 'Complete' && key !== 'Cancelled';

  let label;
  if (config.labelKey === 'status.loadingAt' && config.labelStation) {
    label = t('status.loadingAt').replace('{station}', config.labelStation);
  } else if (config.labelKey) {
    label = t(config.labelKey);
  } else {
    label = config.label || status;
  }

  return (
    <span className={`badge-status border ${config.color} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${isActive ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}
