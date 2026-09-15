/**
 * Parses the DTAK map-data payloads shared over chat (pin/route/geofence/
 * alert/casevac/range-bearing/quickpic/location/sos) -- the same shapes
 * app.js's mobile counterpart writes as `content` on a chat message
 * (`gun.get('chats')/'groupChats'...set({sender, content, timestamp})`).
 * On the wire each payload is discriminated by a `"kind": "dtak.<type>.v1"`
 * field (older/alternate producers may instead send `_messageType`, which
 * is also honored below).
 */
import { fromMGRS } from './mgrs';

export type MapShareKind =
  | 'pin'
  | 'route'
  | 'geofence'
  | 'alert'
  | 'casevac'
  | 'bearing'
  | 'quickpic'
  | 'location'
  | 'sos';

const KNOWN_KINDS: MapShareKind[] = [
  'pin',
  'route',
  'geofence',
  'alert',
  'casevac',
  'bearing',
  'quickpic',
  'location',
  'sos',
];

export interface MapShareItem {
  _messageType: MapShareKind;
  markerId?: string;
  name?: string;
  title?: string;
  notes?: string;
  callsign?: string;
  sharedBy?: string;
  createdAt?: number;
  mgrs?: string;
  // pin
  category?: string;
  color?: string;
  lng?: number;
  lat?: number;
  // route
  travelMode?: string;
  points?: [number, number][] | null;
  distance?: number;
  visibility?: string;
  // geofence
  shape?: 'CIRCLE' | 'POLYGON';
  center?: [number, number] | null;
  radius?: number | null;
  trigger?: string;
  notifications?: string[];
  status?: string;
  // alert
  alertType?: string;
  severity?: string;
  // casevac
  patients?: string;
  precedence?: string;
  // bearing
  originLng?: number;
  originLat?: number;
  destinationLng?: number;
  destinationLat?: number;
  bearingDeg?: number;
  originMgrs?: string;
  destinationMgrs?: string;
  // quickpic
  file?: {
    cid: string;
    encryptedSymKey: string;
    iv: string;
    fileName: string;
    fileType?: string;
    expiryTime?: number;
  };
  // location
  accuracy?: number;
  // sos
  streamId?: string;
  groupId?: string;
  groupName?: string;
  peerId?: string;
  streamer?: string;
  [key: string]: unknown;
}

/** Maps a wire `"kind"` value (e.g. "dtak.range_bearing.v1") to our internal MapShareKind. */
const KIND_ALIASES: Record<string, MapShareKind> = {
  rb: 'bearing', // real wire kind: "dtak.rb.v1"
  rangebearing: 'bearing',
  range_bearing: 'bearing',
  photo: 'quickpic',
};

function resolveMessageKind(raw: Record<string, unknown>): MapShareKind | null {
  const mt = raw._messageType;
  if (typeof mt === 'string' && (KNOWN_KINDS as string[]).includes(mt)) {
    return mt as MapShareKind;
  }

  const kindStr = raw.kind;
  if (typeof kindStr === 'string') {
    const token = kindStr.trim().toLowerCase().replace(/^dtak\./, '').replace(/\.v\d+$/, '');
    if ((KNOWN_KINDS as string[]).includes(token)) return token as MapShareKind;
    if (KIND_ALIASES[token]) return KIND_ALIASES[token];
  }

  return null;
}

/** Fills in numeric lng/lat pairs from MGRS text fields when a payload only carries MGRS. */
function normalizeGeometry(item: MapShareItem): void {
  if ((typeof item.lng !== 'number' || typeof item.lat !== 'number') && item.mgrs) {
    const pt = fromMGRS(item.mgrs);
    if (pt) {
      item.lng = pt[0];
      item.lat = pt[1];
    }
  }

  if (item._messageType === 'bearing') {
    if ((typeof item.originLng !== 'number' || typeof item.originLat !== 'number') && item.originMgrs) {
      const pt = fromMGRS(item.originMgrs);
      if (pt) {
        item.originLng = pt[0];
        item.originLat = pt[1];
      }
    }
    if ((typeof item.destinationLng !== 'number' || typeof item.destinationLat !== 'number') && item.destinationMgrs) {
      const pt = fromMGRS(item.destinationMgrs);
      if (pt) {
        item.destinationLng = pt[0];
        item.destinationLat = pt[1];
      }
    }
  }

  if (item._messageType === 'geofence' && item.shape === 'CIRCLE' && !item.center) {
    if (typeof item.lng === 'number' && typeof item.lat === 'number') {
      item.center = [item.lng, item.lat];
    }
  }
}

export function parseMapShare(content: string): MapShareItem | null {
  if (!content || content[0] !== '{') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const raw = parsed as Record<string, unknown>;
  const kind = resolveMessageKind(raw);
  if (!kind) return null;

  const item = { ...raw, _messageType: kind } as MapShareItem;
  normalizeGeometry(item);
  return item;
}

/** Whether an item carries coordinates that can actually be placed on a map. */
export function hasPlaceableGeometry(item: MapShareItem): boolean {
  switch (item._messageType) {
    case 'route':
      return Array.isArray(item.points) && item.points.length > 0;
    case 'geofence':
      return item.shape === 'CIRCLE'
        ? Array.isArray(item.center) && typeof item.radius === 'number'
        : Array.isArray(item.points) && item.points.length > 0;
    case 'bearing':
      return (
        typeof item.originLng === 'number' &&
        typeof item.originLat === 'number' &&
        typeof item.destinationLng === 'number' &&
        typeof item.destinationLat === 'number'
      );
    default:
      return typeof item.lng === 'number' && typeof item.lat === 'number';
  }
}

const KIND_LABELS: Record<MapShareKind, string> = {
  pin: 'Map Pin',
  route: 'Route',
  geofence: 'Geofence',
  alert: 'Alert',
  casevac: 'CASEVAC',
  bearing: 'Range & Bearing',
  quickpic: 'Quick Pic',
  location: 'Location',
  sos: 'SOS',
};

export function mapShareLabel(item: MapShareItem): string {
  return item.name || item.title || KIND_LABELS[item._messageType] || 'Shared Location';
}

export function mapShareKindLabel(kind: MapShareKind): string {
  return KIND_LABELS[kind];
}

const KIND_BADGES: Record<MapShareKind, string> = {
  pin: 'PIN',
  route: 'ROUTE',
  geofence: 'GEO FENCE',
  alert: 'ALERT',
  casevac: 'CASEVAC',
  bearing: 'BEARING',
  quickpic: 'QUICK PIC',
  location: 'LOCATION',
  sos: 'SOS',
};

/** Short, all-caps badge text for the chat card header (e.g. "GEO FENCE"). */
export function mapShareKindBadge(kind: MapShareKind): string {
  return KIND_BADGES[kind];
}
