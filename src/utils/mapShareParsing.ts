/**
 * Parses the DTAK map-data payloads shared over chat (pin/route/geofence/
 * alert/casevac/range-bearing/quickpic/location/sos) -- the same shapes
 * app.js's mobile counterpart writes as `content` on a chat message
 * (`gun.get('chats')/'groupChats'...set({sender, content, timestamp})`).
 * Each payload is discriminated by its own `_messageType` field.
 */

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

export function parseMapShare(content: string): MapShareItem | null {
  if (!content || content[0] !== '{') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const mt = (parsed as Record<string, unknown>)._messageType;
  if (typeof mt === 'string' && (KNOWN_KINDS as string[]).includes(mt)) {
    return parsed as MapShareItem;
  }
  return null;
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
