import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { getMapStyle } from '@/config/mapConfig';
import { circlePolygon, boundsOf } from '@/utils/geo';
import { mapShareIconSvg, type MapShareIconName } from './mapShareIcons';
import type { MapShareItem, MapShareKind } from '@/utils/mapShareParsing';
import { mapShareKindLabel, mapShareLabel } from '@/utils/mapShareParsing';
import { decryptSharedFile } from '@/utils/fileDecryption';
import './SharedMapView.css';

maplibregl.setWorkerUrl(workerUrl);

const KIND_ICON: Record<MapShareKind, MapShareIconName> = {
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

function resolveColor(item: MapShareItem): string {
  if (item.color && COLOR_MAP[item.color.toLowerCase()]) return COLOR_MAP[item.color.toLowerCase()];
  if (item._messageType === 'alert' || item._messageType === 'sos' || item._messageType === 'casevac') {
    return '#ef4444';
  }
  if (item._messageType === 'geofence') return '#eab308';
  return '#22d3ee';
}

function createMarkerEl(iconName: MapShareIconName, color: string, endpoint = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `shared-map-marker${endpoint ? ' shared-map-marker--endpoint' : ''}`;
  el.style.borderColor = color;
  el.style.color = color;
  el.style.backgroundColor = `${color}2e`;
  el.innerHTML = mapShareIconSvg(iconName, endpoint ? 12 : 16);
  return el;
}

function buildFields(item: MapShareItem): { label: string; value: string }[] {
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

function QuickPicPhoto({ file }: { file: NonNullable<MapShareItem['file']> }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleView = async () => {
    try {
      setStatus('loading');
      setError(null);
      const blob = await decryptSharedFile(file);
      setUrl(URL.createObjectURL(blob));
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load photo');
    }
  };

  if (url) {
    return <img src={url} alt={file.fileName} className="shared-map-panel__photo-preview" />;
  }

  return (
    <>
      <button type="button" className="shared-map-panel__photo-btn" onClick={handleView} disabled={status === 'loading'}>
        {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        {status === 'loading' ? 'Decrypting...' : 'View Photo'}
      </button>
      {status === 'error' && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6 }}>{error}</div>}
    </>
  );
}

export function SharedMapView({ item }: { item: MapShareItem }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      const color = resolveColor(item);
      const iconName = KIND_ICON[item._messageType];
      const boundsPoints: [number, number][] = [];

      const addMarker = (lng: number, lat: number, endpoint = false, popupHtml?: string) => {
        const el = createMarkerEl(iconName, color, endpoint);
        const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);
        if (popupHtml) marker.setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(popupHtml));
        marker.addTo(map);
        markersRef.current.push(marker);
        boundsPoints.push([lng, lat]);
      };

      const popupHtml = `<strong>${mapShareLabel(item)}</strong><br/>${mapShareKindLabel(item._messageType)}`;

      switch (item._messageType) {
        case 'route': {
          const points = item.points || [];
          if (points.length > 0) {
            map.addSource('share-line', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } },
            });
            map.addLayer({
              id: 'share-line-layer',
              type: 'line',
              source: 'share-line',
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
            map.addSource('share-polygon', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
            });
            map.addLayer({
              id: 'share-polygon-fill',
              type: 'fill',
              source: 'share-polygon',
              paint: { 'fill-color': color, 'fill-opacity': 0.15 },
            });
            map.addLayer({
              id: 'share-polygon-line',
              type: 'line',
              source: 'share-polygon',
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
            map.addSource('share-line', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
            });
            map.addLayer({
              id: 'share-line-layer',
              type: 'line',
              source: 'share-line',
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

      if (boundsPoints.length > 1) {
        const [sw, ne] = boundsOf(boundsPoints);
        map.fitBounds([sw, ne], { padding: 60, maxZoom: 16, duration: 0 });
      } else if (boundsPoints.length === 1) {
        map.jumpTo({ center: boundsPoints[0], zoom: 15 });
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const fields = buildFields(item);

  return (
    <div className="shared-map-layout">
      <div className="shared-map-wrapper">
        <div ref={containerRef} className="shared-map-container" />
      </div>
      <aside className="shared-map-panel">
        <div className="shared-map-panel__header">
          <span className="shared-map-panel__icon">
            <span dangerouslySetInnerHTML={{ __html: mapShareIconSvg(KIND_ICON[item._messageType], 18) }} />
          </span>
          <div>
            <div className="shared-map-panel__title">{mapShareLabel(item)}</div>
            <div className="shared-map-panel__kind">{mapShareKindLabel(item._messageType)}</div>
          </div>
        </div>

        {item._messageType === 'quickpic' && item.file && <QuickPicPhoto file={item.file} />}

        {fields.length === 0 ? (
          <div className="shared-map-panel__empty">No additional details</div>
        ) : (
          fields.map((f) => (
            <div className="shared-map-panel__field" key={f.label}>
              <div className="shared-map-panel__field-label">{f.label}</div>
              <div className="shared-map-panel__field-value">{f.value}</div>
            </div>
          ))
        )}
      </aside>
    </div>
  );
}
