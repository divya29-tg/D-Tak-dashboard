import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus } from 'lucide-react';
import { getMapStyle } from '@/config/mapConfig';
import { boundsOf } from '@/utils/geo';
import './EdgeNodeMap.css';

maplibregl.setWorkerUrl(workerUrl);

// Central relay hub -- Vidhana Soudha
const HUB_CENTER: [number, number] = [77.5912, 12.9794];
const HUB_NAME = 'Vidhana Soudha';

interface EdgeNode {
  id: string;
  name: string;
  coords: [number, number]; // [lng, lat]
}

// Fixed real-world deployment sites across Bangalore (lng/lat, from the
// [id, name, lat, lng] table).
const EDGE_NODES: EdgeNode[] = [
  { id: 'E01', name: 'Yelahanka', coords: [77.59633, 13.10073] },
  { id: 'E02', name: 'Hebbal', coords: [77.5888, 13.04022] },
  { id: 'E03', name: 'Jakkur', coords: [77.60689, 13.07847] },
  { id: 'E04', name: 'Jalahalli', coords: [77.53905, 13.0543] },
  { id: 'E05', name: 'Peenya', coords: [77.51902, 13.02279] },
  { id: 'E06', name: 'Rajajinagar', coords: [77.553, 12.991] },
  { id: 'E07', name: 'Vijayanagar', coords: [77.54337, 12.97031] },
  { id: 'E08', name: 'Kengeri', coords: [77.4827, 12.91218] },
  { id: 'E09', name: 'Uttarahalli', coords: [77.542, 12.9059] },
  { id: 'E10', name: 'Jayanagar', coords: [77.58782, 12.92169] },
  { id: 'E11', name: 'Koramangala', coords: [77.6245, 12.9352] },
  { id: 'E12', name: 'HSR Layout', coords: [77.66493, 12.91377] },
  { id: 'E13', name: 'Electronic City', coords: [77.64216, 12.84521] },
  { id: 'E14', name: 'Bommanahalli', coords: [77.62854, 12.90786] },
  { id: 'E15', name: 'Indiranagar', coords: [77.63929, 12.97782] },
  { id: 'E16', name: 'CV Raman Nagar', coords: [77.659, 12.978] },
  { id: 'E17', name: 'Mahadevapura', coords: [77.6869, 12.99226] },
  { id: 'E18', name: 'Marathahalli', coords: [77.701, 12.956] },
  { id: 'E19', name: 'Whitefield / ITPL', coords: [77.74732, 12.97159] },
  { id: 'E20', name: 'Varthur', coords: [77.74121, 12.93888] },
  { id: 'E21', name: 'Bellandur', coords: [77.678, 12.93] },
  { id: 'E22', name: 'Banaswadi', coords: [77.64871, 13.01576] },
  { id: 'E23', name: 'Frazer Town', coords: [77.61638, 12.99933] },
  { id: 'E24', name: 'Sarjapur', coords: [77.68, 12.91] },
  { id: 'E25', name: 'Chandapura', coords: [77.70355, 12.80293] },
  { id: 'E26', name: 'Devanahalli / Airport', coords: [77.70879, 13.20071] },
];
const EDGE_NODE_COUNT = EDGE_NODES.length;

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

export function EdgeNodeMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const edgeNodes = EDGE_NODES;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: HUB_CENTER,
      zoom: 10,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      // Real sites span the whole metro area (Devanahalli to Chandapura), so
      // fit to them instead of the old fixed zoom sized for a tight synthetic ring.
      const [sw, ne] = boundsOf([HUB_CENTER, ...edgeNodes.map((n) => n.coords)]);
      map.fitBounds([sw, ne], { padding: 48, duration: 0 });

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
      hubEl.title = `CENTRAL HUB · ${HUB_NAME}`;
      hubEl.innerHTML = iconSvg(TRUCK_ICON_PATHS, 22);
      const hubMarker = new maplibregl.Marker({ element: hubEl })
        .setLngLat(HUB_CENTER)
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>CENTRAL HUB</strong><br/>${HUB_NAME}`))
        .addTo(map);
      markersRef.current.push(hubMarker);

      // Edge node markers (backpack)
      edgeNodes.forEach((node) => {
        const el = document.createElement('div');
        el.className = 'enode-marker enode-marker--edge';
        el.title = `${node.id} · ${node.name}`;
        el.innerHTML = iconSvg(BACKPACK_ICON_PATHS, 14);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(node.coords)
          .setPopup(
            new maplibregl.Popup({ offset: 14 }).setHTML(
              `<strong>${node.id} · ${node.name}</strong><br/>Connected to CENTRAL HUB`
            )
          )
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
