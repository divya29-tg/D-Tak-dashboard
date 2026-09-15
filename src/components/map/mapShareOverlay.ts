/**
 * Shared drawing logic for a single MapShareItem (pin/route/geofence/
 * bearing/...) on a MapLibre map -- used by both the dedicated Shared Map
 * screen and the live map console (Home) when a chat card is opened there.
 */
import * as maplibregl from 'maplibre-gl';
import { circlePolygon } from '@/utils/geo';
import { mapShareIconSvg, type MapShareIconName } from './mapShareIcons';
import type { MapShareItem, MapShareKind } from '@/utils/mapShareParsing';
import { mapShareKindLabel, mapShareLabel } from '@/utils/mapShareParsing';

export const KIND_ICON: Record<MapShareKind, MapShareIconName> = {
  pin: 'pin',
  route: 'flag',
  geofence: 'shield',
  alert: 'alert',
  casevac: 'casevac',
  bearing: 'bearing',
  quickpic: 'camera',
  location: 'location',
  sos: 'sos',
};

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  black: '#111827',
  white: '#f9fafb',
  cyan: '#22d3ee',
};

export function resolveColor(item: MapShareItem): string {
  if (item.color && COLOR_MAP[item.color.toLowerCase()]) return COLOR_MAP[item.color.toLowerCase()];
  if (item._messageType === 'alert' || item._messageType === 'sos' || item._messageType === 'casevac') {
    return '#ef4444';
  }
  if (item._messageType === 'geofence') return '#eab308';
  return '#22d3ee';
}

export function createMarkerEl(iconName: MapShareIconName, color: string, endpoint = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `shared-map-marker${endpoint ? ' shared-map-marker--endpoint' : ''}`;
  el.style.borderColor = color;
  el.style.color = color;
  el.style.backgroundColor = `${color}2e`;
  el.innerHTML = mapShareIconSvg(iconName, endpoint ? 12 : 16);
  return el;
}

export function buildFields(item: MapShareItem): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    fields.push({ label, value: String(value) });
  };

  switch (item._messageType) {
    case 'pin':
      push('Category', item.category);
      break;
    case 'route':
      push('Travel Mode', item.travelMode);
      push('Distance', item.distance ? `${Math.round(item.distance)} m` : undefined);
      push('Visibility', item.visibility);
      break;
    case 'geofence':
      push('Shape', item.shape);
      push('Radius', item.radius ? `${Math.round(item.radius)} m` : undefined);
      push('Trigger', item.trigger);
      push('Status', item.status);
      if (item.notifications && item.notifications.length > 0) {
        push('Notify', item.notifications.join(', '));
      }
      break;
    case 'alert':
      push('Type', item.alertType);
      push('Severity', item.severity);
      push('Visibility', item.visibility);
      break;
    case 'casevac':
      push('Patients', item.patients);
      push('Precedence', item.precedence);
      push('Status', item.status);
      push('Visibility', item.visibility);
      break;
    case 'bearing':
      push('Distance', item.distance ? `${Math.round(item.distance)} m` : undefined);
      push('Bearing', item.bearingDeg !== undefined ? `${item.bearingDeg}°` : undefined);
      push('Origin MGRS', item.originMgrs);
      push('Destination MGRS', item.destinationMgrs);
      break;
    case 'location':
      push('Accuracy', item.accuracy ? `${item.accuracy} m` : undefined);
      break;
    case 'sos':
      push('Group', item.groupName);
      push('Streamer', item.streamer);
      push('Accuracy', item.accuracy ? `${item.accuracy} m` : undefined);
      break;
    case 'quickpic':
      break;
  }

  push('Callsign', item.callsign);
  push('MGRS', item.mgrs);
  push('Shared By', item.sharedBy);
  push('Notes', item.notes);
  if (item.createdAt) push('Created', new Date(item.createdAt).toLocaleString());

  return fields;
}

export interface MapShareOverlayHandle {
  /** Removes every marker/source/layer this overlay added. */
  remove: () => void;
  /** All points touched (markers, line vertices, polygon ring) -- fit the map to these. */
  boundsPoints: [number, number][];
}

/**
 * Draws a single MapShareItem onto `map` (marker, route line, geofence
 * polygon, or bearing line) using ids namespaced by `idPrefix` so multiple
 * independent overlays can coexist / be swapped out on the same map.
 */
export function addMapShareOverlay(
  map: maplibregl.Map,
  item: MapShareItem,
  idPrefix = 'share'
): MapShareOverlayHandle {
  const markers: maplibregl.Marker[] = [];
  const sourceIds: string[] = [];
  const layerIds: string[] = [];
  const boundsPoints: [number, number][] = [];

  const color = resolveColor(item);
  const iconName = KIND_ICON[item._messageType];
  const popupHtml = `<strong>${mapShareLabel(item)}</strong><br/>${mapShareKindLabel(item._messageType)}`;

  const addMarker = (lng: number, lat: number, endpoint = false, popup?: string) => {
    const el = createMarkerEl(iconName, color, endpoint);
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);
    if (popup) marker.setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(popup));
    marker.addTo(map);
    markers.push(marker);
    boundsPoints.push([lng, lat]);
  };

  const addLayer = (spec: Parameters<typeof map.addLayer>[0]) => {
    map.addLayer(spec);
    layerIds.push((spec as { id: string }).id);
  };

  switch (item._messageType) {
    case 'route': {
      const points = item.points || [];
      if (points.length > 0) {
        const lineId = `${idPrefix}-line`;
        map.addSource(lineId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } },
        });
        sourceIds.push(lineId);
        addLayer({
          id: `${lineId}-layer`,
          type: 'line',
          source: lineId,
          paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85 },
        });
        addMarker(points[0][0], points[0][1], true, 'Start');
        addMarker(points[points.length - 1][0], points[points.length - 1][1], true, 'End');
        points.forEach((p) => boundsPoints.push(p));
      }
      break;
    }
    case 'geofence': {
      const ring =
        item.shape === 'CIRCLE' && item.center && item.radius
          ? circlePolygon(item.center, item.radius)
          : item.points && item.points.length > 0
          ? [...item.points, item.points[0]]
          : [];
      if (ring.length > 0) {
        const polyId = `${idPrefix}-polygon`;
        map.addSource(polyId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
        });
        sourceIds.push(polyId);
        addLayer({
          id: `${polyId}-fill`,
          type: 'fill',
          source: polyId,
          paint: { 'fill-color': color, 'fill-opacity': 0.15 },
        });
        addLayer({
          id: `${polyId}-line`,
          type: 'line',
          source: polyId,
          paint: { 'line-color': color, 'line-width': 2 },
        });
        ring.forEach((p) => boundsPoints.push(p));
        const centerPt = item.shape === 'CIRCLE' && item.center ? item.center : ring[0];
        addMarker(centerPt[0], centerPt[1], false, popupHtml);
      }
      break;
    }
    case 'bearing': {
      if (
        typeof item.originLng === 'number' &&
        typeof item.originLat === 'number' &&
        typeof item.destinationLng === 'number' &&
        typeof item.destinationLat === 'number'
      ) {
        const line: [number, number][] = [
          [item.originLng, item.originLat],
          [item.destinationLng, item.destinationLat],
        ];
        const lineId = `${idPrefix}-line`;
        map.addSource(lineId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
        });
        sourceIds.push(lineId);
        addLayer({
          id: `${lineId}-layer`,
          type: 'line',
          source: lineId,
          paint: { 'line-color': color, 'line-width': 3, 'line-dasharray': [2, 2] },
        });
        addMarker(item.originLng, item.originLat, true, 'Origin');
        addMarker(item.destinationLng, item.destinationLat, true, 'Destination');
      }
      break;
    }
    default: {
      if (typeof item.lng === 'number' && typeof item.lat === 'number') {
        addMarker(item.lng, item.lat, false, popupHtml);
      }
    }
  }

  const remove = () => {
    markers.forEach((m) => m.remove());
    layerIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    sourceIds.forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  };

  return { remove, boundsPoints };
}
