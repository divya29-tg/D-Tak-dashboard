/** Forward geodesic: point at `distanceKm` from [lng,lat] along `bearingDeg`. */
export function destinationPoint(
  center: [number, number],
  bearingDeg: number,
  distanceKm: number
): [number, number] {
  const R = 6371;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (center[1] * Math.PI) / 180;
  const lng1 = (center[0] * Math.PI) / 180;
  const angularDist = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** GeoJSON polygon ring approximating a circle of `radiusMeters` around `center`. */
export function circlePolygon(center: [number, number], radiusMeters: number, steps = 64): [number, number][] {
  const radiusKm = radiusMeters / 1000;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 / steps) * i;
    ring.push(destinationPoint(center, bearing, radiusKm));
  }
  return ring;
}

/** Bounding box [[minLng,minLat],[maxLng,maxLat]] over a set of [lng,lat] points. */
export function boundsOf(points: [number, number][]): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
