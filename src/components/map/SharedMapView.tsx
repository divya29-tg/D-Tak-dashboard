import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { getMapStyle } from '@/config/mapConfig';
import { boundsOf } from '@/utils/geo';
import { mapShareIconSvg } from './mapShareIcons';
import { addMapShareOverlay, buildFields, KIND_ICON } from './mapShareOverlay';
import type { MapShareItem } from '@/utils/mapShareParsing';
import { mapShareKindLabel, mapShareLabel } from '@/utils/mapShareParsing';
import { decryptSharedFile } from '@/utils/fileDecryption';
import './SharedMapView.css';

maplibregl.setWorkerUrl(workerUrl);

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

    let overlay: ReturnType<typeof addMapShareOverlay> | null = null;

    map.on('load', () => {
      overlay = addMapShareOverlay(map, item, 'share');
      const { boundsPoints } = overlay;

      if (boundsPoints.length > 1) {
        const [sw, ne] = boundsOf(boundsPoints);
        map.fitBounds([sw, ne], { padding: 60, maxZoom: 16, duration: 0 });
      } else if (boundsPoints.length === 1) {
        map.jumpTo({ center: boundsPoints[0], zoom: 15 });
      }
    });

    return () => {
      overlay?.remove();
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
