import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus } from 'lucide-react';
import { getMapStyle } from '@/config/mapConfig';
import { destinationPoint } from '@/utils/geo';
import './EdgeNodeMap.css';

maplibregl.setWorkerUrl(workerUrl);

// Bangalore city center
const HUB_CENTER: [number, number] = [77.5946, 12.9716];
const EDGE_NODE_COUNT = 26;
const EDGE_RADIUS_KM = 3.5;

const TRUCK_ICON_PATHS =
  '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
  '<path d="M15 18H9"/>' +
  '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
  '<circle cx="17" cy="18" r="2"/>' +
  '<circle cx="7" cy="18" r="2"/>';

const BACKPACK_ICON_PATHS =
  '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>' +
  '<path d="M8 10h8"/>' +
  '<path d="M8 18h8"/>' +
  '<path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/>' +
  '<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>';

function iconSvg(paths: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

interface EdgeNode {
  id: string;
  coords: [number, number];
}

function buildEdgeNodes(): EdgeNode[] {
  return Array.from({ length: EDGE_NODE_COUNT }, (_, i) => {
    const bearing = (360 / EDGE_NODE_COUNT) * i;
    return {
      id: `EDGE-${String(i + 1).padStart(2, '0')}`,
      coords: destinationPoint(HUB_CENTER, bearing, EDGE_RADIUS_KM),
    };
  });
}

export function EdgeNodeMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const edgeNodes = buildEdgeNodes();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: HUB_CENTER,
      zoom: 12.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      const linkFeatures = edgeNodes.map((node) => ({
        type: 'Feature' as const,
        properties: { id: node.id },
        geometry: {
          type: 'LineString' as const,
          coordinates: [HUB_CENTER, node.coords],
        },
      }));

      map.addSource('edge-links', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: linkFeatures },
      });

      map.addLayer({
        id: 'edge-links-layer',
        type: 'line',
        source: 'edge-links',
        paint: {
          'line-color': '#8FBF3F',
          'line-width': 1.5,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2],
        },
      });

      // Hub marker (truck)
      const hubEl = document.createElement('div');
      hubEl.className = 'enode-marker enode-marker--hub';
      hubEl.title = 'HUB-01 · Central Relay Node';
      hubEl.innerHTML = iconSvg(TRUCK_ICON_PATHS, 22);
      const hubMarker = new maplibregl.Marker({ element: hubEl })
        .setLngLat(HUB_CENTER)
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML('<strong>HUB-01</strong><br/>Central Relay Node'))
        .addTo(map);
      markersRef.current.push(hubMarker);

      // Edge node markers (backpack)
      edgeNodes.forEach((node) => {
        const el = document.createElement('div');
        el.className = 'enode-marker enode-marker--edge';
        el.title = node.id;
        el.innerHTML = iconSvg(BACKPACK_ICON_PATHS, 14);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(node.coords)
          .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<strong>${node.id}</strong><br/>Connected to HUB-01`))
          .addTo(map);
        markersRef.current.push(marker);
      });
    });

    mapRef.current = map;

    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="enode-map-wrapper">
      <div ref={containerRef} className="enode-map-container" />

      <div className="enode-legend" aria-label="Network Legend">
        <div className="enode-legend__row">
          <span className="enode-legend__swatch enode-legend__swatch--hub">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </span>
          <span>Hub Node (Relay Truck)</span>
        </div>
        <div className="enode-legend__row">
          <span className="enode-legend__swatch enode-legend__swatch--edge">
            <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <path d="M8 10h8" />
              <path d="M8 18h8" />
              <path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <span>Edge Node (Backpack Unit)</span>
        </div>
      </div>

      <div className="enode-count-badge">{EDGE_NODE_COUNT} EDGE NODES · 1 HUB</div>

      <div className="enode-zoom-group">
        <button
          type="button"
          className="enode-zoom-btn"
          title="Zoom In"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus size={16} />
        </button>
        <div className="enode-zoom-divider" />
        <button
          type="button"
          className="enode-zoom-btn"
          title="Zoom Out"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
}
