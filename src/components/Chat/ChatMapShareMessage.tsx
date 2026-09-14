import {
  MapPin,
  Route,
  Shield,
  AlertTriangle,
  HeartPulse,
  Compass,
  Camera,
  LocateFixed,
  Siren,
  ChevronRight,
} from 'lucide-react';
import type { MapShareItem } from '@/utils/mapShareParsing';
import { hasPlaceableGeometry, mapShareLabel } from '@/utils/mapShareParsing';
import './ChatMapShareMessage.css';

const KIND_ICON = {
  pin: MapPin,
  route: Route,
  geofence: Shield,
  alert: AlertTriangle,
  casevac: HeartPulse,
  bearing: Compass,
  quickpic: Camera,
  location: LocateFixed,
  sos: Siren,
};

function kindSubtitle(item: MapShareItem): string {
  switch (item._messageType) {
    case 'route':
      return item.distance ? `${Math.round(item.distance)} m route` : 'Route';
    case 'geofence':
      return item.shape === 'CIRCLE' && item.radius ? `${Math.round(item.radius)} m radius geofence` : 'Geofence';
    case 'alert':
      return [item.alertType, item.severity].filter(Boolean).join(' · ') || 'Alert';
    case 'casevac':
      return [item.precedence, item.patients ? `${item.patients} patient(s)` : null].filter(Boolean).join(' · ');
    case 'bearing':
      return item.distance ? `${Math.round(item.distance)} m · ${item.bearingDeg ?? '?'}°` : 'Range & bearing';
    case 'sos':
      return item.groupName ? `SOS in ${item.groupName}` : 'SOS';
    default:
      return item.callsign ? `Shared by ${item.callsign}` : 'Shared location';
  }
}

export function ChatMapShareMessage({ item, onView }: { item: MapShareItem; onView: () => void }) {
  const Icon = KIND_ICON[item._messageType] || MapPin;
  const placeable = hasPlaceableGeometry(item);

  return (
    <button type="button" className="chat-map-card" onClick={onView} disabled={!placeable}>
      <span className={`chat-map-card__icon chat-map-card__icon--${item._messageType}`}>
        <Icon size={16} />
      </span>
      <span className="chat-map-card__body">
        <span className="chat-map-card__title">{mapShareLabel(item)}</span>
        <span className="chat-map-card__subtitle">{kindSubtitle(item)}</span>
      </span>
      {placeable ? (
        <ChevronRight size={16} className="chat-map-card__chevron" />
      ) : (
        <span className="chat-map-card__no-fix">No GPS fix</span>
      )}
    </button>
  );
}
