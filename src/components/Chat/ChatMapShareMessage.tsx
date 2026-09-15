import {
  MapPin,
  Waypoints,
  Shield,
  AlertTriangle,
  Cross,
  Binoculars,
  Camera,
  LocateFixed,
  Siren,
  Lock,
} from 'lucide-react';
import type { MapShareItem, MapShareKind } from '@/utils/mapShareParsing';
import { hasPlaceableGeometry, mapShareKindBadge, mapShareLabel } from '@/utils/mapShareParsing';
import { toMGRS } from '@/utils/mgrs';
import './ChatMapShareMessage.css';

const KIND_ICON = {
  pin: MapPin,
  route: Waypoints,
  geofence: Shield,
  alert: AlertTriangle,
  casevac: Cross,
  bearing: Binoculars,
  quickpic: Camera,
  location: LocateFixed,
  sos: Siren,
};

type Tone = 'default' | 'danger' | 'warning' | 'success';
interface CardLine {
  text: string;
  tone?: Tone;
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatTime(item: MapShareItem): string | undefined {
  if (!item.createdAt) return undefined;
  return new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function coordOf(item: MapShareItem): string | undefined {
  if (item.mgrs) return item.mgrs;
  if (typeof item.lng === 'number' && typeof item.lat === 'number') return toMGRS(item.lng, item.lat);
  return undefined;
}

/** Card title, e.g. "064°" for a bearing, "CASEVAC-DT-1", "Enemy-1", or the item's own name. */
function cardTitle(item: MapShareItem): string {
  if (item.name) return item.name;
  if (item.title) return item.title;
  if (item._messageType === 'bearing' && typeof item.bearingDeg === 'number') return `${item.bearingDeg}°`;
  if (item._messageType === 'casevac') {
    const suffix = item.callsign && item.seq !== undefined ? `-${item.callsign}-${item.seq}` : '';
    return `CASEVAC${suffix}`;
  }
  if (item._messageType === 'alert' && item.alertType) {
    return item.seq !== undefined ? `${item.alertType}-${item.seq}` : String(item.alertType);
  }
  return mapShareLabel(item);
}

/** Up to a handful of detail lines shown under the title, tailored per share kind. */
function cardLines(item: MapShareItem): CardLine[] {
  const lines: CardLine[] = [];
  const time = formatTime(item);

  switch (item._messageType) {
    case 'alert': {
      const meta = [item.alertType, time].filter(Boolean).join(' · ');
      if (meta) lines.push({ text: meta });
      if (item.severity) lines.push({ text: `Priority: ${item.severity}`, tone: 'danger' });
      break;
    }
    case 'casevac': {
      if (item.precedence) lines.push({ text: `Priority: ${item.precedence}`, tone: 'danger' });
      if (item.patients) lines.push({ text: `${item.patients} casualt${item.patients === '1' ? 'y' : 'ies'}` });
      const pickup = coordOf(item);
      if (pickup) lines.push({ text: `Pickup: ${pickup}` });
      if (item.status) lines.push({ text: `Status: ${toTitleCase(item.status)}`, tone: 'warning' });
      break;
    }
    case 'bearing': {
      if (item.distance) lines.push({ text: `Distance: ${Math.round(item.distance)} m` });
      if (item.originMgrs) lines.push({ text: `From: ${item.originMgrs}` });
      if (item.destinationMgrs) lines.push({ text: `To: ${item.destinationMgrs}` });
      if (time) lines.push({ text: time });
      break;
    }
    case 'geofence': {
      const shapeLine =
        item.shape === 'CIRCLE' && item.radius ? `CIRCLE · ${Math.round(item.radius)} m radius` : item.shape;
      if (shapeLine) lines.push({ text: shapeLine });
      if (item.status) {
        const active = item.status.toUpperCase() === 'ACTIVE';
        lines.push({ text: toTitleCase(item.status), tone: active ? 'success' : 'default' });
      }
      break;
    }
    case 'pin': {
      const coord = coordOf(item);
      if (coord) lines.push({ text: coord });
      const meta = [item.category, time].filter(Boolean).join(' · ');
      if (meta) lines.push({ text: meta });
      break;
    }
    case 'route': {
      const meta = [item.travelMode, item.distance ? `${Math.round(item.distance)} m` : undefined]
        .filter(Boolean)
        .join(' · ');
      if (meta) lines.push({ text: meta });
      if (time) lines.push({ text: time });
      break;
    }
    case 'location': {
      const coord = coordOf(item);
      if (coord) lines.push({ text: coord });
      if (item.accuracy) lines.push({ text: `± ${item.accuracy} m` });
      if (time) lines.push({ text: time });
      break;
    }
    case 'sos': {
      if (item.groupName) lines.push({ text: `SOS in ${item.groupName}`, tone: 'danger' });
      if (time) lines.push({ text: time });
      break;
    }
    case 'quickpic': {
      if (item.file?.fileName) lines.push({ text: item.file.fileName });
      if (time) lines.push({ text: time });
      break;
    }
  }

  return lines;
}

function actionLabel(kind: MapShareKind): string {
  switch (kind) {
    case 'alert':
      return 'Open Alert';
    case 'casevac':
      return 'Open CASEVAC';
    case 'sos':
      return 'Open SOS';
    default:
      return 'Open on Map';
  }
}

export function ChatMapShareMessage({ item, onView }: { item: MapShareItem; onView: () => void }) {
  const Icon = KIND_ICON[item._messageType] || MapPin;
  const placeable = hasPlaceableGeometry(item);
  const lines = cardLines(item);

  return (
    <button type="button" className="chat-map-card" onClick={onView} disabled={!placeable}>
      <div className="chat-map-card__header">
        <span className={`chat-map-card__badge chat-map-card__badge--${item._messageType}`}>
          <Icon size={13} />
          {mapShareKindBadge(item._messageType)}
        </span>
        <Lock size={11} className="chat-map-card__lock" aria-label="Encrypted" />
      </div>

      <span className="chat-map-card__title">{cardTitle(item)}</span>

      {lines.length > 0 && (
        <div className="chat-map-card__lines">
          {lines.map((line, i) => (
            <span key={i} className={`chat-map-card__line chat-map-card__line--${line.tone || 'default'}`}>
              {line.text}
            </span>
          ))}
        </div>
      )}

      <div className="chat-map-card__footer">
        {placeable ? (
          <span className="chat-map-card__action">{actionLabel(item._messageType)}</span>
        ) : (
          <span className="chat-map-card__no-fix">No GPS fix</span>
        )}
      </div>
    </button>
  );
}
