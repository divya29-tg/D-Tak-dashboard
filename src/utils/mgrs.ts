/**
 * Standalone, lightweight WGS84 to MGRS (Military Grid Reference System) Converter Utility.
 * Converts [longitude, latitude] into standard MGRS string representation.
 */

const NUMERIC_PRECISION = 5; // 5 digits = 1 meter precision

const BANDS = 'CDEFGHJKLMNPQRSTUVWXX';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const SET_ORIGINS = [
  { col: 1, row: 0 },
  { col: 9, row: 0 },
  { col: 17, row: 0 },
  { col: 25, row: 0 },
  { col: 33, row: 0 },
  { col: 41, row: 0 },
];

/**
 * Converts longitude and latitude (WGS84 degrees) into MGRS format.
 */
export function toMGRS(lng: number, lat: number): string {
  if (lat < -80 || lat > 84) {
    return 'OUT OF MGRS BOUNDS';
  }

  // Calculate UTM Zone
  let zone = Math.floor((lng + 180) / 6) + 1;
  if (zone === 61) zone = 60;

  // Handle Norway / Svalbard special UTM zones
  if (lat >= 56.0 && lat < 64.0 && lng >= 3.0 && lng < 12.0) {
    zone = 32;
  } else if (lat >= 72.0 && lat < 84.0) {
    if (lng >= 0.0 && lng < 9.0) zone = 31;
    else if (lng >= 9.0 && lng < 21.0) zone = 33;
    else if (lng >= 21.0 && lng < 33.0) zone = 35;
    else if (lng >= 33.0 && lng < 42.0) zone = 37;
  }

  // Latitude Band Letter
  const latBandIdx = Math.floor((lat + 80) / 8);
  const bandLetter = BANDS.charAt(Math.min(Math.max(0, latBandIdx), BANDS.length - 1));

  // Transverse Mercator UTM Projection
  const utm = latLngToUtm(lng, lat, zone);
  const easting = utm.easting;
  const northing = utm.northing;

  // 100km Square Identification
  const setIndex = (zone - 1) % 6;
  const colIndex = Math.floor(easting / 100000);
  const colLetter = getColLetter(colIndex, setIndex);

  const rowIndex = Math.floor((northing % 2000000) / 100000);
  const rowLetter = getRowLetter(rowIndex, setIndex);

  // 5-digit precision Easting & Northing string representation
  const eStr = Math.floor(easting % 100000)
    .toString()
    .padStart(NUMERIC_PRECISION, '0');
  const nStr = Math.floor(northing % 100000)
    .toString()
    .padStart(NUMERIC_PRECISION, '0');

  return `${zone}${bandLetter}${colLetter}${rowLetter} ${eStr} ${nStr}`;
}

function getColLetter(colIndex: number, setIndex: number): string {
  const colOrigin = SET_ORIGINS[setIndex].col;
  const letterIdx = ((colOrigin - 1 + colIndex - 1) % 24) % 26;
  return ALPHABET.charAt(letterIdx);
}

function getRowLetter(rowIndex: number, setIndex: number): string {
  const rowOrigin = SET_ORIGINS[setIndex].row;
  let letterIdx = (rowOrigin + rowIndex) % 20;
  // Account for I and O omissions in MGRS lettering
  const alphabetNoIO = 'ABCDEFGHJKLMNPQRSTUV';
  return alphabetNoIO.charAt(letterIdx % 20);
}

interface UtmResult {
  easting: number;
  northing: number;
}

/**
 * Transverse Mercator WGS84 conversion algorithm
 */
function latLngToUtm(lng: number, lat: number, zone: number): UtmResult {
  const a = 6378137.0; // WGS84 semi-major axis
  const f = 1 / 298.257223563; // WGS84 flattening
  const k0 = 0.9996; // UTM scale factor

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const centralMeridian = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  const e2 = 2 * f - f * f;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const ep2 = e2 / (1 - e2);

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ep2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - centralMeridian);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latRad) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latRad) -
      ((35 * e6) / 3072) * Math.sin(6 * latRad));

  let easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5)) / 120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6)) / 720));

  if (lat < 0) {
    northing += 10000000.0; // 10,000,000 meter offset for southern hemisphere
  }

  return { easting, northing };
}
