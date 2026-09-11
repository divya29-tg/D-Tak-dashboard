import type { StyleSpecification } from 'maplibre-gl';

export interface MapStyleOption {
  id: string;
  name: string;
  purpose: string;
  thumbnailColor: string;
  isDefault?: boolean;
}

/**
 * Verified MapTiler style options for DTAK Home Map
 * Contains 7 distinct operational, light, hybrid, outdoor, light topo, terrain, and winter styles.
 */
export const MAPTILER_STYLES: MapStyleOption[] = [
  {
    id: 'streets-v4-dark',
    name: 'Streets Dark',
    purpose: 'default DTAK operational dark map; clear roads and labels.',
    thumbnailColor: '#1e293b',
    isDefault: true,
  },
  {
    id: 'streets-v4',
    name: 'Streets',
    purpose: 'light/normal streets map; bright and clear for high visibility.',
    thumbnailColor: '#3b82f6',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    purpose: 'satellite imagery with crisp roads and place labels.',
    thumbnailColor: '#0f4c5c',
  },
  {
    id: 'outdoor-v4-dark',
    name: 'Outdoor Dark',
    purpose: 'outdoor, mountain and trail-oriented dark view.',
    thumbnailColor: '#133c55',
  },
  {
    id: 'topo-v4',
    name: 'Topo',
    purpose: 'official MapTiler light topographic & elevation view.',
    thumbnailColor: '#ca8a04',
  },
  {
    id: 'outdoor-v4',
    name: 'Terrain',
    purpose: 'official MapTiler light terrain view with hillshading & contours.',
    thumbnailColor: '#10b981',
  },
  {
    id: 'winter-v4-dark',
    name: 'Winter Dark',
    purpose: 'snow and winter environment-oriented dark map.',
    thumbnailColor: '#38bdf8',
  },
];

/**
 * MapTiler API Configuration.
 * Reads API key strictly from Vite environment variables.
 */
export const MAPTILER_CONFIG = {
  get apiKey(): string {
    return import.meta.env.VITE_MAPTILER_API_KEY || '';
  },
  styleId: 'streets-v4-dark',
  get styleUrl(): string {
    return getMapStyleUrl(this.styleId) as string;
  },
  get terrainUrl(): string {
    const key = this.apiKey;
    return key ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}` : '';
  },
};

export const MAP_CONFIG = {
  provider: 'maptiler' as const,
  initialCenter: [6.8651, 45.8326] as [number, number], // Mont Blanc / Alps region for dramatic 3D terrain
  initialZoom: 11,
  initialPitch: 60,
  initialBearing: -17.6,
  terrainExaggeration: 1.5,
};

/**
 * In-memory cache for preloaded MapTiler style JSON definitions.
 */
const styleDefinitionCache = new Map<string, StyleSpecification>();

/**
 * Preloads and caches style JSON definition + sprite metadata for a given style ID.
 */
export async function preloadStyleDefinition(styleId: string): Promise<StyleSpecification | null> {
  if (styleDefinitionCache.has(styleId)) {
    return styleDefinitionCache.get(styleId)!;
  }

  const url = getMapStyleUrl(styleId);
  if (typeof url !== 'string') return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as StyleSpecification;
    styleDefinitionCache.set(styleId, json);

    // Pre-warm sprite assets if present (supports string & array sprite schemas)
    if (json.sprite) {
      if (typeof json.sprite === 'string') {
        const spriteJsonUrl = json.sprite.endsWith('.json') ? json.sprite : `${json.sprite}.json`;
        const spritePngUrl = json.sprite.endsWith('.png') ? json.sprite : `${json.sprite}.png`;
        fetch(spriteJsonUrl, { cache: 'force-cache' }).catch(() => {});
        fetch(spritePngUrl, { cache: 'force-cache' }).catch(() => {});
      } else if (Array.isArray(json.sprite)) {
        json.sprite.forEach((item: { url?: string }) => {
          if (item?.url && typeof item.url === 'string') {
            const spriteJsonUrl = item.url.endsWith('.json') ? item.url : `${item.url}.json`;
            const spritePngUrl = item.url.endsWith('.png') ? item.url : `${item.url}.png`;
            fetch(spriteJsonUrl, { cache: 'force-cache' }).catch(() => {});
            fetch(spritePngUrl, { cache: 'force-cache' }).catch(() => {});
          }
        });
      }
    }

    return json;
  } catch {
    return null;
  }
}

/**
 * Background preloader for all style JSON definitions.
 * Triggered after initial map load so it never blocks initial render.
 */
export function preloadAllStyleDefinitions(excludeStyleId?: string): void {
  MAPTILER_STYLES.forEach((style) => {
    if (style.id !== excludeStyleId && !styleDefinitionCache.has(style.id)) {
      preloadStyleDefinition(style.id).catch(() => {});
    }
  });
}

/**
 * Returns cached style JSON specification if available, or the style URL string.
 */
export function getCachedOrUrlStyle(styleId: string): string | StyleSpecification {
  if (styleDefinitionCache.has(styleId)) {
    return styleDefinitionCache.get(styleId)!;
  }
  return getMapStyleUrl(styleId);
}

/**
 * Retrieves the MapLibre style configuration for a specific style ID.
 * Uses MapTiler style JSON when VITE_MAPTILER_API_KEY is configured.
 * Falls back cleanly to OpenStreetMap raster tiles if no key is supplied.
 */
export const getMapStyleUrl = (styleId: string = MAPTILER_CONFIG.styleId): string | StyleSpecification => {
  const apiKey = MAPTILER_CONFIG.apiKey;
  if (apiKey) {
    return `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`;
  }

  return {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
};

export const getMapStyle = (): string | StyleSpecification => {
  return getMapStyleUrl();
};

export const createMapStyle = (): string | StyleSpecification => {
  return getMapStyle();
};





