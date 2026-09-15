import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Crosshair,
  Map,
  Compass,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
  Layers,
  Check,
  X,
  Lock,
} from 'lucide-react';
import {
  MAP_CONFIG,
  MAPTILER_CONFIG,
  MAPTILER_STYLES,
  getMapStyle,
  preloadStyleDefinition,
  preloadAllStyleDefinitions,
  getCachedOrUrlStyle,
} from '@/config/mapConfig';
import { toMGRS } from '@/utils/mgrs';
import { boundsOf } from '@/utils/geo';
import { OverlayManager, type OverlayItem } from './OverlayManager';
import { addMapShareOverlay, buildFields, KIND_ICON } from './mapShareOverlay';
import { mapShareIconSvg } from './mapShareIcons';
import { mapShareKindBadge, mapShareLabel } from '@/utils/mapShareParsing';
import type { MapShareItem } from '@/utils/mapShareParsing';
import './MapView.css';

// Configure MapLibre worker URL explicitly using Vite worker bundler
maplibregl.setWorkerUrl(workerUrl);

interface MapViewProps {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  initialPitch?: number;
  initialBearing?: number;
  /** A map-share item opened from a chat card -- drawn on this live map and flown to. */
  focusItem?: MapShareItem | null;
  focusSender?: string;
}

export function MapView({
  initialCenter = MAP_CONFIG.initialCenter,
  initialZoom = MAP_CONFIG.initialZoom,
  initialPitch = MAP_CONFIG.initialPitch,
  initialBearing = MAP_CONFIG.initialBearing,
  focusItem = null,
  focusSender,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const focusOverlayRef = useRef<ReturnType<typeof addMapShareOverlay> | null>(null);

  const [focus, setFocus] = useState<MapShareItem | null>(focusItem);

  const [activeStyleId, setActiveStyleId] = useState<string>('streets-v4-dark');
  const [loadingStyleId, setLoadingStyleId] = useState<string | null>(null);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState<boolean>(false);
  const [isOverlayManagerOpen, setIsOverlayManagerOpen] = useState<boolean>(false);
  const [isGlobalOverlaysEnabled, setIsGlobalOverlaysEnabled] = useState<boolean>(true);
  const [overlays, setOverlays] = useState<OverlayItem[]>([
    {
      id: 'layer-3d-buildings',
      name: '3D Buildings Extrusion',
      category: 'LAYERS',
      type: 'layer',
      metadata: 'Vector Layer . Height Extrusion',
      enabled: true,
    },
    {
      id: 'layer-terrain-dem',
      name: '3D Terrain Elevation',
      category: 'LAYERS',
      type: 'layer',
      metadata: 'Raster DEM . Exaggeration 1.35x',
      enabled: true,
    },
  ]);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentCenter, setCurrentCenter] = useState<[number, number]>(initialCenter);
  const [elevationFt, setElevationFt] = useState<string>('N/A');

  const pendingStyleIdRef = useRef<string | null>(null);
  const hasPreloadedRef = useRef<boolean>(false);
  const stylePanelWrapperRef = useRef<HTMLDivElement | null>(null);

  // Keep a ref to the focused share item so the style.load handler (attached
  // once at mount) can always redraw it after a style swap without going stale.
  const focusRef = useRef<MapShareItem | null>(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  // A fresh chat-card click always produces a newly-parsed object, so this
  // fires again even for "the same" item re-opened after being dismissed.
  useEffect(() => {
    if (focusItem) setFocus(focusItem);
  }, [focusItem]);

  // Draws (or redraws) a map-share overlay for `item`, optionally flying the camera to it.
  const drawFocus = useCallback((map: maplibregl.Map, item: MapShareItem, opts: { fly: boolean }) => {
    if (focusOverlayRef.current) {
      focusOverlayRef.current.remove();
      focusOverlayRef.current = null;
    }
    const overlay = addMapShareOverlay(map, item, 'focus-share');
    focusOverlayRef.current = overlay;

    if (opts.fly) {
      // With 3D terrain on, MapLibre clamps a Marker's DOM position to the
      // terrain surface -- if the DEM tile for this (freshly-flown-to) area
      // hasn't loaded yet, the marker briefly renders below the surface and
      // is invisible until some later zoom/pan forces a recompute. A shared
      // pin doesn't need 3D anyway, so view it flat/terrain-off, same as the
      // dedicated Shared Map screen already does -- sidesteps the bug outright.
      disableTerrain(map);

      const { boundsPoints } = overlay;
      if (boundsPoints.length > 1) {
        const [sw, ne] = boundsOf(boundsPoints);
        map.fitBounds([sw, ne], { padding: 120, maxZoom: 17, duration: 900, pitch: 0 });
      } else if (boundsPoints.length === 1) {
        map.flyTo({
          center: boundsPoints[0],
          zoom: 16,
          pitch: 0,
          duration: 1200,
          essential: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearFocus = useCallback(() => {
    if (focusOverlayRef.current) {
      focusOverlayRef.current.remove();
      focusOverlayRef.current = null;
    }
    setFocus(null);
    // Restore terrain if the user had 3D mode on before a focus flattened it.
    const map = mapRef.current;
    if (map && is3DModeRef.current) {
      enableTerrain(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw / clear the overlay whenever the focused item changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!focus) {
      if (focusOverlayRef.current) {
        focusOverlayRef.current.remove();
        focusOverlayRef.current = null;
      }
      return;
    }

    const run = () => drawFocus(map, focus, { fly: true });
    if (map.isStyleLoaded()) {
      run();
    } else {
      map.once('load', run);
    }
  }, [focus, drawFocus]);

  // Close Map Style Panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isStylePanelOpen &&
        stylePanelWrapperRef.current &&
        !stylePanelWrapperRef.current.contains(event.target as Node)
      ) {
        setIsStylePanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStylePanelOpen]);

  // Keep a ref to is3DMode to access latest state inside map event callbacks
  const is3DModeRef = useRef<boolean>(is3DMode);
  useEffect(() => {
    is3DModeRef.current = is3DMode;
  }, [is3DMode]);

  // Helper to enable 3D Terrain DEM
  const enableTerrain = useCallback((map: maplibregl.Map) => {
    const apiKey = MAPTILER_CONFIG.apiKey;
    if (!apiKey) return;

    try {
      if (!map.getSource('maptiler-dem')) {
        map.addSource('maptiler-dem', {
          type: 'raster-dem',
          url: MAPTILER_CONFIG.terrainUrl,
          tileSize: 512,
        });
      }

      const applyTerrain = () => {
        try {
          if (map.getSource('maptiler-dem')) {
            map.setTerrain({
              source: 'maptiler-dem',
              exaggeration: MAP_CONFIG.terrainExaggeration,
            });
          }
        } catch {
          // Ignore
        }
      };

      if (map.isSourceLoaded('maptiler-dem')) {
        applyTerrain();
      } else {
        const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
          if (e.sourceId === 'maptiler-dem' && e.isSourceLoaded) {
            map.off('sourcedata', onSourceData);
            applyTerrain();
          }
        };
        map.on('sourcedata', onSourceData);
        setTimeout(applyTerrain, 200);
      }
    } catch {
      // Ignore if terrain DEM is unsupported or already configured
    }
  }, []);

  // Helper to disable 3D Terrain DEM
  const disableTerrain = useCallback((map: maplibregl.Map) => {
    try {
      map.setTerrain(null);
    } catch {
      // Ignore if terrain is already disabled
    }
  }, []);

  // Helper to configure 3D building extrusions
  const setup3DBuildings = useCallback((map: maplibregl.Map) => {
    if (map.getLayer('3d-buildings-custom')) return;
    const sourceId = map.getSource('maptiler_planet')
      ? 'maptiler_planet'
      : map.getSource('maptiler_planet_v4')
      ? 'maptiler_planet_v4'
      : null;
    if (!sourceId) return;

    const layers = map.getStyle().layers;
    const labelLayerId = layers?.find(
      (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    try {
      map.addLayer(
        {
          id: '3d-buildings-custom',
          source: sourceId,
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0,
              '#1e293b',
              50,
              '#334155',
              100,
              '#475569',
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0,
              15,
              ['get', 'render_height'],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0,
              15,
              ['get', 'render_min_height'],
            ],
            'fill-extrusion-opacity': 0.75,
          },
        },
        labelLayerId
      );
    } catch {
      // Building layer might already exist in style
    }
  }, []);

  // Helper to update telemetry & coordinates from map position
  const updateMapCenterInfo = useCallback((map: maplibregl.Map) => {
    const center = map.getCenter();
    const lngLat: [number, number] = [center.lng, center.lat];
    setCurrentCenter(lngLat);

    try {
      const elevationMeters = map.queryTerrainElevation(center);
      if (elevationMeters !== null && elevationMeters !== undefined) {
        const ft = elevationMeters * 3.28084;
        setElevationFt(`${ft.toFixed(2)} ft`);
      } else {
        setElevationFt('N/A');
      }
    } catch {
      setElevationFt('N/A');
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      maxPitch: 85,
      attributionControl: false, // We render a clean custom attribution overlay
    });

    // Add standard attribution control on bottom-left
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      'bottom-left'
    );

    // Handle style loading (initial load + whenever setStyle is called)
    map.on('style.load', () => {
      // A style swap wipes our custom sources/layers -- redraw a pending focus
      // item first. Fly the camera only the first time (fresh mount); a later
      // style swap should just restore the overlay in place. Terrain stays
      // off while a focus is showing (see drawFocus) so a freshly-flown-to
      // marker doesn't get hidden by not-yet-loaded DEM tiles.
      if (focusRef.current) {
        const hadOverlay = focusOverlayRef.current !== null;
        drawFocus(map, focusRef.current, { fly: !hadOverlay });
      } else if (is3DModeRef.current) {
        enableTerrain(map);
      }
      setup3DBuildings(map);

      // Trigger non-blocking background preloading of remaining style definitions
      if (!hasPreloadedRef.current) {
        hasPreloadedRef.current = true;
        preloadAllStyleDefinitions('streets-v4-dark');
      }
    });

    // Track map movements to update live coordinate display & elevation telemetry
    map.on('move', () => updateMapCenterInfo(map));
    map.on('load', () => updateMapCenterInfo(map));

    // Sync pitch state changes from user drag or compass resets
    map.on('pitch', () => {
      const pitch = map.getPitch();
      if (pitch < 5 && is3DModeRef.current) {
        setIs3DMode(false);
      } else if (pitch >= 15 && !is3DModeRef.current) {
        setIs3DMode(true);
      }
    });

    mapRef.current = map;

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      focusOverlayRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    initialCenter,
    initialZoom,
    initialPitch,
    initialBearing,
    enableTerrain,
    setup3DBuildings,
    updateMapCenterInfo,
    drawFocus,
  ]);

  // Handle individual overlay toggle
  const handleToggleOverlay = useCallback((id: string, enabled: boolean) => {
    setOverlays((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled } : item))
    );
  }, []);

  // Synchronize overlay state changes to MapLibre layers & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Current location marker DOM visibility
    const userLocItem = overlays.find((o) => o.id === 'pin-user-location');
    const showUserLoc = isGlobalOverlaysEnabled && (userLocItem?.enabled ?? true);
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        el.style.display = showUserLoc ? 'block' : 'none';
      }
    }

    // 2. 3D Buildings vector layer visibility
    const bldItem = overlays.find((o) => o.id === 'layer-3d-buildings');
    const showBld = isGlobalOverlaysEnabled && (bldItem?.enabled ?? true);
    if (map.getLayer('3d-buildings-custom')) {
      try {
        map.setLayoutProperty('3d-buildings-custom', 'visibility', showBld ? 'visible' : 'none');
      } catch {
        // Ignore
      }
    }

    // 3. 3D Terrain DEM elevation visibility
    const terrainItem = overlays.find((o) => o.id === 'layer-terrain-dem');
    const showTerrain = isGlobalOverlaysEnabled && (terrainItem?.enabled ?? true);
    if (is3DModeRef.current) {
      if (showTerrain) {
        enableTerrain(map);
      } else {
        disableTerrain(map);
      }
    }
  }, [isGlobalOverlaysEnabled, overlays, enableTerrain, disableTerrain]);

  // Optimized Map Style Switch with Cache & Latest-Selection Guard
  const handleStyleSelect = async (styleId: string) => {
    setIsStylePanelOpen(false);
    if (styleId === activeStyleId) return;

    const targetStyleObj = MAPTILER_STYLES.find((s) => s.id === styleId);
    const styleName = targetStyleObj ? targetStyleObj.name : styleId;

    pendingStyleIdRef.current = styleId;
    setLoadingStyleId(styleId);

    const map = mapRef.current;
    if (!map) return;

    try {
      let spec: string | maplibregl.StyleSpecification = getCachedOrUrlStyle(styleId);
      if (typeof spec === 'string') {
        const fetched = await preloadStyleDefinition(styleId);
        if (fetched) {
          spec = fetched;
        }
      }

      // Latest-selection-wins check: Abort if user selected a different style during fetch
      if (pendingStyleIdRef.current !== styleId) {
        return;
      }

      map.setStyle(spec);
      setActiveStyleId(styleId);
    } catch {
      showError(`Failed to load ${styleName} map style.`);
    } finally {
      if (pendingStyleIdRef.current === styleId) {
        setLoadingStyleId(null);
      }
    }
  };

  // Handle Compass Reset to North
  const handleResetNorth = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: 0,
      pitch: is3DMode ? 60 : 0,
      duration: 600,
    });
  };

  // Handle Zoom In / Zoom Out
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  // Handle Current Location Request via Browser Geolocation API
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [longitude, latitude];

        const map = mapRef.current;
        if (!map) return;

        // Smoothly fly to current location
        map.flyTo({
          center: coords,
          zoom: 15,
          pitch: is3DMode ? 55 : 0,
          speed: 1.2,
          curve: 1.4,
          essential: true,
        });

        // Add or update custom pulse location marker
        if (markerRef.current) {
          markerRef.current.setLngLat(coords);
        } else {
          const el = document.createElement('div');
          el.className = 'user-location-marker';
          el.innerHTML = `
            <div class="user-marker-pulse"></div>
            <div class="user-marker-core"></div>
          `;

          markerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);
        }

        // Register / update Current Location Pin overlay
        setOverlays((prev) => {
          const locationId = 'pin-user-location';
          const formattedLat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
          const formattedLon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
          const meta = `Current Location . ${formattedLat}, ${formattedLon}`;
          const exists = prev.some((item) => item.id === locationId);
          if (exists) {
            return prev.map((item) => (item.id === locationId ? { ...item, metadata: meta } : item));
          }
          return [
            {
              id: locationId,
              name: 'Current Location Pin',
              category: 'PINS',
              type: 'pin',
              metadata: meta,
              enabled: true,
            },
            ...prev,
          ];
        });
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            showError('Location permission denied. Please enable location access in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            showError('Current location is unavailable.');
            break;
          case error.TIMEOUT:
            showError('Location request timed out.');
            break;
          default:
            showError('Unable to retrieve current location.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
  };

  const formatLat = (lat: number) => {
    const dir = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lat).toFixed(5)}° ${dir}`;
  };

  const formatLon = (lon: number) => {
    const dir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lon).toFixed(5)}° ${dir}`;
  };

  const activeLoadingName = MAPTILER_STYLES.find((s) => s.id === loadingStyleId)?.name;

  return (
    <div className="map-view-wrapper">
      <div ref={containerRef} className="map-view-container" />

      {/* Top Centered Real-time Coordinate Overlay */}
      <div className="map-coord-panel" aria-label="Real-time Coordinates">
        <div className="map-coord-col">
          <span className="map-coord-label">LAT</span>
          <span className="map-coord-value">{formatLat(currentCenter[1])}</span>
        </div>
        <div className="map-coord-divider" />
        <div className="map-coord-col">
          <span className="map-coord-label">LON</span>
          <span className="map-coord-value">{formatLon(currentCenter[0])}</span>
        </div>
        <div className="map-coord-divider" />
        <div className="map-coord-col">
          <span className="map-coord-label">MGRS</span>
          <span className="map-coord-value">{toMGRS(currentCenter[0], currentCenter[1])}</span>
        </div>
      </div>

      {/* Focused Shared-Item Panel (opened from a chat card) */}
      {focus && (
        <aside className="map-focus-panel" aria-label="Shared map item details">
          <div className="map-focus-panel__header">
            <span className={`map-focus-panel__icon map-focus-panel__icon--${focus._messageType}`}>
              <span dangerouslySetInnerHTML={{ __html: mapShareIconSvg(KIND_ICON[focus._messageType], 16) }} />
            </span>
            <div className="map-focus-panel__heading">
              <span className="map-focus-panel__badge">{mapShareKindBadge(focus._messageType)}</span>
              <span className="map-focus-panel__title">{mapShareLabel(focus)}</span>
            </div>
            <Lock size={11} className="map-focus-panel__lock" aria-label="Encrypted" />
            <button type="button" className="map-focus-panel__close" onClick={handleClearFocus} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          {focusSender && <div className="map-focus-panel__sender">Shared by {focusSender}</div>}

          <div className="map-focus-panel__fields">
            {buildFields(focus).map((f) => (
              <div className="map-focus-panel__field" key={f.label}>
                <span className="map-focus-panel__field-label">{f.label}</span>
                <span className="map-focus-panel__field-value">{f.value}</span>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Right-Side Vertical Map Controls Column (52px x 52px Buttons) */}
      <div className="map-controls-stack" aria-label="Map Navigation Controls">
        {/* 1. Layers Toggle -> Opens Overlay Manager */}
        <button
          type="button"
          className={`map-stack-btn ${isOverlayManagerOpen ? 'active' : ''}`}
          onClick={() => {
            setIsStylePanelOpen(false);
            setIsOverlayManagerOpen((prev) => !prev);
          }}
          title="Overlay Manager"
        >
          <Layers size={20} />
        </button>

        {/* 2. Current Location */}
        <button
          type="button"
          className={`map-stack-btn ${isLocating ? 'locating' : ''}`}
          onClick={() => {
            setIsStylePanelOpen(false);
            handleCurrentLocation();
          }}
          disabled={isLocating}
          title="Fly to Current Location"
        >
          {isLocating ? <Loader2 size={20} className="animate-spin" /> : <Crosshair size={20} />}
        </button>

        {/* 3. MAP Button with Anchored Style Panel */}
        <div ref={stylePanelWrapperRef} className="map-btn-wrapper">
          <button
            type="button"
            className={`map-stack-btn ${isStylePanelOpen ? 'active' : ''}`}
            onClick={() => {
              setIsOverlayManagerOpen(false);
              setIsStylePanelOpen((prev) => !prev);
            }}
            title="Toggle Map Style Selector"
          >
            <Map size={20} />
          </button>

          {/* MAP STYLE Panel (Anchored Directly Below Map Button) */}
          {isStylePanelOpen && (
            <aside className="map-style-panel" aria-label="Map Style Selector">
              <div className="map-style-panel__header">
                <Layers size={13} className="map-style-panel__icon" />
                <span className="map-style-panel__title">MAP STYLE</span>
                {loadingStyleId && (
                  <div className="map-style-panel__loading-badge" title={`Loading ${activeLoadingName}...`}>
                    <Loader2 size={11} className="animate-spin text-emerald-400" />
                  </div>
                )}
              </div>
              <div className="map-style-panel__list" role="radiogroup" aria-label="Map Style Options">
                {MAPTILER_STYLES.map((style) => {
                  const isActive = activeStyleId === style.id;
                  const isLoading = loadingStyleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      className={`map-style-panel__item ${isActive ? 'map-style-panel__item--active' : ''} ${
                        isLoading ? 'map-style-panel__item--loading' : ''
                      }`}
                      onClick={() => handleStyleSelect(style.id)}
                      role="radio"
                      aria-checked={isActive}
                      title={style.purpose}
                    >
                      <span className="map-style-panel__check">
                        {isLoading ? (
                          <Loader2 size={11} className="animate-spin map-style-panel__spinner" />
                        ) : isActive ? (
                          <Check size={12} />
                        ) : null}
                      </span>
                      <span
                        className="map-style-panel__swatch"
                        style={{ backgroundColor: style.thumbnailColor }}
                      />
                      <span className="map-style-panel__name">{style.name}</span>
                    </button>
                  );
                })}
              </div>
              {loadingStyleId && (
                <div className="map-style-panel__status-bar">
                  <span>Loading {activeLoadingName}...</span>
                </div>
              )}
            </aside>
          )}
        </div>

        {/* 4. Compass Reset */}
        <button
          type="button"
          className="map-stack-btn"
          onClick={() => {
            setIsStylePanelOpen(false);
            handleResetNorth();
          }}
          title="Reset Bearing to North"
        >
          <Compass size={20} />
        </button>

        {/* 5. Zoom Controls (+ / -) */}
        <div className="map-zoom-group">
          <button
            type="button"
            className="map-zoom-btn"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <Plus size={18} />
          </button>
          <div className="map-zoom-divider" />
          <button
            type="button"
            className="map-zoom-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <Minus size={18} />
          </button>
        </div>
      </div>

      {/* Bottom-Right Real-time Telemetry Panel */}
      <div className="map-telemetry-panel" aria-label="Real-time Telemetry">
        <div className="map-telemetry-row">
          <span className="map-telemetry-label">Sea Level Height:</span>
          <span className="map-telemetry-value">{elevationFt}</span>
        </div>
        <div className="map-telemetry-row">
          <span className="map-telemetry-label">Relative Altitude:</span>
          <span className="map-telemetry-value">N/A</span>
        </div>
        <div className="map-telemetry-row">
          <span className="map-telemetry-label">Air Pressure:</span>
          <span className="map-telemetry-value">N/A</span>
        </div>
      </div>

      {/* Non-blocking Error Toast */}
      {errorMessage && (
        <div className="map-error-toast" role="alert">
          <AlertCircle size={16} className="error-toast-icon" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Overlay Manager Modal */}
      <OverlayManager
        isOpen={isOverlayManagerOpen}
        onClose={() => setIsOverlayManagerOpen(false)}
        isGlobalEnabled={isGlobalOverlaysEnabled}
        onToggleGlobal={setIsGlobalOverlaysEnabled}
        overlays={overlays}
        onToggleOverlay={handleToggleOverlay}
      />
    </div>
  );
}




