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

// --- Inverse conversion: MGRS string -> [lng, lat] -----------------------
// Standard MGRS decode (100km-square lettering skips I/O), independent of
// the forward converter above -- needed to place `dtak.*.v1` payloads that
// only carry MGRS text (no raw lat/lng), e.g. bearing origin/destination.

const SET_ORIGIN_COLUMN_LETTERS = 'AJSAJS';
const SET_ORIGIN_ROW_LETTERS = 'AFAFAF';

const MIN_NORTHING_BY_BAND: Record<string, number> = {
  C: 1100000, D: 2000000, E: 2800000, F: 3700000, G: 4600000, H: 5500000,
  J: 6400000, K: 7300000, L: 8200000, M: 9100000,
  N: 0, P: 800000, Q: 1700000, R: 2600000, S: 3500000,
  T: 4400000, U: 5300000, V: 6200000, W: 7000000, X: 7900000,
};

function get100KSetForZone(zone: number): number {
  const setNumber = zone % 6;
  return setNumber === 0 ? 6 : setNumber;
}

function getEastingFromChar(letter: string, set: number): number {
  let curCol = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(set - 1);
  let eastingValue = 100000;
  let rewound = false;
  const target = letter.charCodeAt(0);
  const A = 65, I = 73, O = 79, Z = 90;
  while (curCol !== target) {
    curCol++;
    if (curCol === I) curCol++;
    if (curCol === O) curCol++;
    if (curCol > Z) {
      if (rewound) return NaN;
      curCol = A;
      rewound = true;
    }
    eastingValue += 100000;
  }
  return eastingValue;
}

function getNorthingFromChar(letter: string, set: number): number {
  let curRow = SET_ORIGIN_ROW_LETTERS.charCodeAt(set - 1);
  let northingValue = 0;
  const target = letter.charCodeAt(0);
  const A = 65, I = 73, O = 79, V = 86;
  while (curRow !== target) {
    curRow++;
    if (curRow === I) curRow++;
    if (curRow === O) curRow++;
    if (curRow > V) curRow = A;
    northingValue += 100000;
  }
  return northingValue;
}

function utmToLatLng(zoneNumber: number, zoneLetter: string, easting: number, northing: number): [number, number] {
  const a = 6378137.0;
  const eccSquared = 0.00669438;
  const k0 = 0.9996;
  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

  const x = easting - 500000.0;
  let y = northing;
  if (zoneLetter < 'N') y -= 10000000.0; // southern hemisphere bands

  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const M = y / k0;
  const mu = M / (a * (1 - eccSquared / 4 - (3 * eccSquared * eccSquared) / 64 - (5 * eccSquared ** 3) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) ** 2);
  const T1 = Math.tan(phi1Rad) ** 2;
  const C1 = eccPrimeSquared * Math.cos(phi1Rad) ** 2;
  const R1 = (a * (1 - eccSquared)) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) ** 2, 1.5);
  const D = x / (N1 * k0);

  let lat =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D ** 6) / 720);
  lat = (lat * 180) / Math.PI;

  let lng =
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * D ** 5) / 120) /
    Math.cos(phi1Rad);
  lng = (zoneNumber - 1) * 6 - 180 + 3 + (lng * 180) / Math.PI;

  return [lng, lat];
}

/** Parses an MGRS string (e.g. "43P GQ 82945 35615") back into [lng, lat] (WGS84 degrees), or null if unparsable. */
export function fromMGRS(mgrs: string | undefined | null): [number, number] | null {
  if (!mgrs) return null;
  const cleaned = mgrs.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = cleaned.match(/^(\d{1,2})([C-HJ-NP-X])\s([A-HJ-NP-Z])([A-HJ-NP-V])\s(\d+)\s(\d+)$/);
  if (!match) return null;

  const zoneNumber = parseInt(match[1], 10);
  const zoneLetter = match[2];
  const colLetter = match[3];
  const rowLetter = match[4];
  const eDigits = match[5];
  const nDigits = match[6];
  if (eDigits.length !== nDigits.length) return null;

  const precision = eDigits.length;
  const scale = Math.pow(10, 5 - precision);

  const set = get100KSetForZone(zoneNumber);
  const east100k = getEastingFromChar(colLetter, set);
  let north100k = getNorthingFromChar(rowLetter, set);
  if (Number.isNaN(east100k)) return null;

  const minNorthing = MIN_NORTHING_BY_BAND[zoneLetter] ?? 0;
  while (north100k < minNorthing) north100k += 2000000;

  const easting = east100k + parseInt(eDigits, 10) * scale;
  const northing = north100k + parseInt(nDigits, 10) * scale;

  const [lng, lat] = utmToLatLng(zoneNumber, zoneLetter, easting, northing);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  return [lng, lat];
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
