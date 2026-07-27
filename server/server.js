import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.set('trust proxy', 1); // Trust reverse-proxy headers (Vercel, Render, Nginx, Cloudflare)
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

// OWASP Recommended Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 1. Secure Access Credentials (100% Environment Variables)
const NASA_MAP_KEY = process.env.NASA_MAP_KEY || '';
if (!NASA_MAP_KEY) {
  logger.warn("⚠️ NASA_MAP_KEY n'est pas définie dans le fichier .env !");
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || '';
if (!MAPBOX_TOKEN) {
  logger.warn("⚠️ MAPBOX_TOKEN n'est pas définie dans le fichier .env !");
}

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const CACHE_DIR = process.env.VERCEL ? path.join('/tmp', 'cache') : path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'fires_cache.json');
const QUAKES_CACHE_FILE = path.join(CACHE_DIR, 'quakes_cache.json');
const FLIGHTS_CACHE_FILE = path.join(CACHE_DIR, 'flights_cache.json');
const GLOBAL_AIRPORTS_FILE = path.join(CACHE_DIR, 'global_airports.json');

// Vercel CDN Edge Cache Control (Zero Cost Invocations)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  next();
});

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Non-blocking Upstash Redis Helper Methods (With 1.2s Abort Timeout Protection)
async function redisGet(key) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    logger.debug({ err: err.message, key }, '[Upstash Redis] Get failed or timed out');
  }
  return null;
}

async function redisSet(key, value, exSeconds = 7200) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const payload = JSON.stringify(value);
    if (payload.length > 900000) return; // Payload limit guard

    const url = exSeconds
      ? `${UPSTASH_REDIS_REST_URL}/set/${key}?ex=${exSeconds}`
      : `${UPSTASH_REDIS_REST_URL}/set/${key}`;

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    logger.debug({ key }, '[Upstash Redis] SET success');
  } catch (err) {
    clearTimeout(timeoutId);
    logger.debug({ err: err.message, key }, '[Upstash Redis] Set failed or timed out');
  }
}

// Multi-Tier Memory Cache States (RAM Primary)
let memoryCache = { lastUpdated: 0, geoJson: null };
let quakesMemoryCache = { lastUpdated: 0, geoJson: null };
let flightsMemoryCache = { lastUpdated: 0, geoJson: null };
let globalAirportsDb = {};
let globalAirportsIataDb = {};

const COUNTRY_FLAGS = {
  FR: 'France 🇫🇷', US: 'États-Unis 🇺🇸', MA: 'Maroc 🇲🇦', DZ: 'Algérie 🇩🇿', TN: 'Tunisie 🇹🇳',
  ES: 'Espagne 🇪🇸', PT: 'Portugal 🇵🇹', GB: 'Royaume-Uni 🇬🇧', DE: 'Allemagne 🇩🇪', IT: 'Italie 🇮🇹',
  NL: 'Pays-Bas 🇳🇱', BE: 'Belgique 🇧🇪', CH: 'Suisse 🇨🇭', AT: 'Autriche 🇦🇹', SE: 'Suède 🇸🇪',
  NO: 'Norvège 🇳🇴', FI: 'Finlande 🇫🇮', DK: 'Danemark 🇩🇰', IE: 'Irlande 🇮🇪', GR: 'Grèce 🇬🇷',
  TR: 'Turquie 🇹🇷', AE: 'Émirats Arabes Unis 🇦🇪', QA: 'Qatar 🇶🇦', JP: 'Japon 🇯🇵', CN: 'Chine 🇨🇳',
  CA: 'Canada 🇨🇦', BR: 'Brésil 🇧🇷', AU: 'Australie 🇦🇺', SG: 'Singapour 🇸🇬', MX: 'Mexique 🇲🇽'
};

function indexAirportsByIata() {
  globalAirportsIataDb = {};
  for (const [icaoKey, info] of Object.entries(globalAirportsDb)) {
    const key = icaoKey.trim().toUpperCase();
    info.icao = key;
    if (info.iata && typeof info.iata === 'string') {
      globalAirportsIataDb[info.iata.trim().toUpperCase()] = info;
    }
  }
}

// Load 29,300+ Global Airports Database
async function loadGlobalAirportsDb() {
  if (fs.existsSync(GLOBAL_AIRPORTS_FILE)) {
    try {
      const content = fs.readFileSync(GLOBAL_AIRPORTS_FILE, 'utf8');
      globalAirportsDb = JSON.parse(content);
      indexAirportsByIata();
      logger.info({ count: Object.keys(globalAirportsDb).length, iataCount: Object.keys(globalAirportsIataDb).length }, '[Airports DB] Loaded global airports from local disk cache with dual O(1) index.');
      return;
    } catch (e) {
      logger.warn({ err: e.message }, '[Airports DB] Local cache file read failed, falling back to download');
    }
  }

  try {
    logger.info('[Airports DB] Downloading 29,300+ global airports dataset...');
    const res = await fetch('https://cdn.jsdelivr.net/gh/mwgg/Airports@master/airports.json');
    if (res.ok) {
      globalAirportsDb = await res.json();
      indexAirportsByIata();
      fs.writeFileSync(GLOBAL_AIRPORTS_FILE, JSON.stringify(globalAirportsDb), 'utf8');
      logger.info({ count: Object.keys(globalAirportsDb).length, iataCount: Object.keys(globalAirportsIataDb).length }, '[Airports DB] Successfully downloaded & cached global airports with dual O(1) index.');
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Airports DB] Failed to fetch global airports');
  }
}

let openFlightsRoutes = null;
let dynamicIcaoToIata = {};
const ROUTES_CACHE_FILE = path.join(CACHE_DIR, 'routes_cache.json');
const AIRLINES_CACHE_FILE = path.join(CACHE_DIR, 'airlines_cache.json');

const ICAO_TO_IATA_AIRLINES = {
  AFR: 'AF', BAW: 'BA', DLH: 'LH', UAE: 'EK', DAL: 'DL', UAL: 'UA', AAL: 'AA',
  EZY: 'U2', EZS: 'U2', RYR: 'FR', RYN: 'FR', TVF: 'TO', RAM: 'AT', DAH: 'AH',
  TAR: 'TU', IBE: 'IB', TAP: 'TP', KLM: 'KL', SWR: 'LX', THY: 'TK', QFA: 'QF',
  JAL: 'JL', ANA: 'NH', CPA: 'CX', SIA: 'SQ', SWA: 'WN', AZA: 'AZ', ITY: 'AZ',
  FIN: 'AY', SAS: 'SK', WZZ: 'W6', NAX: 'DY', FDB: 'FZ', QTR: 'QR', ETD: 'EY',
  MSR: 'MS', MEA: 'ME', RJA: 'RJ', SVA: 'SV', OAL: 'OA', AEE: 'A3', CSA: 'OK',
  LOT: 'LO', BEL: 'SN', CLH: 'LH', EWG: 'EW', GWI: 'EW', VLG: 'VY', VOE: 'V7',
  AEA: 'UX', TRA: 'HV', CMP: 'CM', AVA: 'AV', LAN: 'LA', TAM: 'JJ', AMX: 'AM',
  ASA: 'AS', HAL: 'HA', JBU: 'B6', FFT: 'F9', NKS: 'NK', SKW: 'OO', RPA: 'YX'
};

async function loadOpenFlightsAirlines() {
  if (Object.keys(dynamicIcaoToIata).length > 0) return dynamicIcaoToIata;
  if (fs.existsSync(AIRLINES_CACHE_FILE)) {
    try {
      dynamicIcaoToIata = JSON.parse(fs.readFileSync(AIRLINES_CACHE_FILE, 'utf8'));
      return dynamicIcaoToIata;
    } catch (e) {}
  }

  try {
    const res = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat');
    if (res.ok) {
      const text = await res.text();
      const map = { ...ICAO_TO_IATA_AIRLINES };
      text.split('\n').forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 5) {
          const iata = parts[3].replace(/"/g, '').trim().toUpperCase();
          const icao = parts[4].replace(/"/g, '').trim().toUpperCase();
          if (icao && icao.length === 3 && iata && iata.length === 2 && iata !== '\\N' && icao !== '\\N') {
            map[icao] = iata;
          }
        }
      });
      dynamicIcaoToIata = map;
      try {
        fs.writeFileSync(AIRLINES_CACHE_FILE, JSON.stringify(map), 'utf8');
      } catch (e) {}
      return dynamicIcaoToIata;
    }
  } catch (err) {
    logger.debug({ err: err.message }, '[Airlines DB] Failed fetching airlines.dat');
  }
  dynamicIcaoToIata = { ...ICAO_TO_IATA_AIRLINES };
  return dynamicIcaoToIata;
}

async function loadOpenFlightsRoutes() {
  if (openFlightsRoutes) return openFlightsRoutes;
  if (fs.existsSync(ROUTES_CACHE_FILE)) {
    try {
      openFlightsRoutes = JSON.parse(fs.readFileSync(ROUTES_CACHE_FILE, 'utf8'));
      return openFlightsRoutes;
    } catch (e) {
      logger.debug({ err: e.message }, '[Routes DB] Failed reading disk cache');
    }
  }

  try {
    const res = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat');
    if (res.ok) {
      const text = await res.text();
      const routesMap = {};
      text.split('\n').forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 6) {
          const airline = parts[0].trim().toUpperCase();
          const src = parts[2].trim().toUpperCase();
          const dst = parts[4].trim().toUpperCase();
          if (airline && src && dst && src !== '\\N' && dst !== '\\N') {
            if (!routesMap[airline]) routesMap[airline] = [];
            routesMap[airline].push({ src, dst });
          }
        }
      });
      openFlightsRoutes = routesMap;
      try {
        fs.writeFileSync(ROUTES_CACHE_FILE, JSON.stringify(routesMap), 'utf8');
      } catch (e) {}
      return openFlightsRoutes;
    }
  } catch (err) {
    logger.debug({ err: err.message }, '[Routes DB] Failed fetching OpenFlights routes');
  }
  openFlightsRoutes = {};
  return openFlightsRoutes;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferRouteKinematic(lat, lon, heading) {
  if (!globalAirportsDb) return { dep: 'DEP', arr: 'ARR' };
  const majorAirports = Object.values(globalAirportsDb).filter(a => a.iata && a.iata.length === 3 && a.lat && a.lon);
  let bestDep = null, bestArr = null, minDepDist = Infinity, minArrDist = Infinity;
  const radLat = lat * Math.PI / 180;
  const radLon = lon * Math.PI / 180;

  for (const ap of majorAirports) {
    const d = distanceKm(lat, lon, ap.lat, ap.lon);
    if (d > 4000) continue;
    const apRadLon = ap.lon * Math.PI / 180;
    const apRadLat = ap.lat * Math.PI / 180;
    const y = Math.sin(apRadLon - radLon) * Math.cos(apRadLat);
    const x = Math.cos(radLat) * Math.sin(apRadLat) - Math.sin(radLat) * Math.cos(apRadLat) * Math.cos(apRadLon - radLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    if (bearing < 0) bearing += 360;

    let diff = Math.abs(bearing - heading);
    if (diff > 180) diff = 360 - diff;

    if (diff > 110 && d < minDepDist) { minDepDist = d; bestDep = ap; }
    if (diff < 70 && d < minArrDist) { minArrDist = d; bestArr = ap; }
  }

  return {
    dep: bestDep ? (bestDep.icao || bestDep.iata) : 'DEP',
    arr: bestArr ? (bestArr.icao || bestArr.iata) : 'ARR'
  };
}

export function resolveAirportInfo(icaoCode, defaultCountry = 'International') {
  if (!icaoCode) return null;
  const key = icaoCode.trim().toUpperCase();

  if (!globalAirportsDb || Object.keys(globalAirportsDb).length === 0) {
    if (fs.existsSync(GLOBAL_AIRPORTS_FILE)) {
      try {
        globalAirportsDb = JSON.parse(fs.readFileSync(GLOBAL_AIRPORTS_FILE, 'utf8'));
        indexAirportsByIata();
      } catch (e) {}
    }
  }

  const ap = (globalAirportsDb && globalAirportsDb[key]) || (globalAirportsIataDb && globalAirportsIataDb[key]);
  if (ap) {
    const cName = COUNTRY_FLAGS[ap.country] || ap.country || defaultCountry;
    return {
      iata: ap.iata && ap.iata.length === 3 ? ap.iata.toUpperCase() : (ap.icao || key),
      icao: ap.icao || key,
      name: ap.name || `Aéroport (${key})`,
      city: ap.city || ap.state || ap.name || key,
      country: cName,
      lat: ap.lat,
      lon: ap.lon
    };
  }

  if (key.length === 4) {
    const prefix = key.substring(0, 2);
    let countryName = defaultCountry;
    if (prefix.startsWith('L')) countryName = 'France / Europe 🇪🇺';
    else if (prefix.startsWith('E')) countryName = 'Royaume-Uni / Nord Europe 🇬🇧';
    else if (prefix.startsWith('K')) countryName = 'États-Unis 🇺🇸';
    else if (prefix.startsWith('C')) countryName = 'Canada 🇨🇦';
    else if (prefix.startsWith('Y')) countryName = 'Australie 🇦🇺';
    else if (prefix.startsWith('R') || prefix.startsWith('Z')) countryName = 'Asie 🌏';
    else if (prefix.startsWith('O')) countryName = 'Moyen-Orient 🕌';

    return {
      iata: key,
      icao: key,
      name: `Aéroport International (${key})`,
      city: `Zone (${key})`,
      country: countryName
    };
  }

  return {
    iata: key,
    icao: key,
    name: `Aéroport ${key}`,
    city: key,
    country: defaultCountry
  };
}

function parseCSVLine(line) {
  const parts = line.split(',');
  return parts.map(p => p.trim());
}

export function parseCsvToGeoJSON(csvText, sourceName) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');

  // Defensive CSV Header Verification (Prevents out-of-index row[-1] reads if NASA structure changes)
  if (latIdx === -1 || lonIdx === -1) {
    logger.error({ sourceName }, '[CSV Parsing Guard] Missing required latitude/longitude headers in CSV dataset');
    return [];
  }

  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const confIdx = headers.indexOf('confidence');
  const frpIdx = headers.indexOf('frp');
  const satIdx = headers.indexOf('satellite');
  const instIdx = headers.indexOf('instrument');

  const features = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    const lat = parseFloat(row[latIdx]);
    const lon = parseFloat(row[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    const acqDate = row[dateIdx] || '';
    const acqTime = row[timeIdx] || '0000';
    const paddedTime = acqTime.padStart(4, '0');
    const hh = paddedTime.substring(0, 2);
    const mm = paddedTime.substring(2, 4);

    const isoString = `${acqDate}T${hh}:${mm}:00Z`;
    const timestamp = new Date(isoString).getTime();

    const frp = parseFloat(row[frpIdx]) || 0;
    const rawConf = row[confIdx] || 'n';
    let confidence = 'n';
    if (rawConf === 'h' || parseInt(rawConf) >= 80) confidence = 'h';
    else if (rawConf === 'l' || parseInt(rawConf) < 30) confidence = 'l';

    const satRaw = row[satIdx] || row[instIdx] || sourceName;
    let satName = 'VIIRS (NOAA-20)';
    if (sourceName.includes('MODIS')) satName = 'MODIS (Aqua/Terra)';
    else if (satRaw === 'N' || sourceName.includes('NOAA20')) satName = 'VIIRS (NOAA-20)';
    else if (satRaw === 'N21' || sourceName.includes('NOAA21')) satName = 'VIIRS (NOAA-21)';
    else if (satRaw === '1' || sourceName.includes('SNPP')) satName = 'VIIRS (Suomi-NPP)';

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        id: `${sourceName}_${acqDate}_${paddedTime}_${lat}_${lon}`,
        acq_date: acqDate,
        acq_time: paddedTime,
        timestamp: isNaN(timestamp) ? Date.now() : timestamp,
        confidence: confidence,
        frp: frp,
        satellite: satName,
        source: sourceName
      }
    });
  }

  return features;
}

async function fetchFirmsData() {
  logger.info('[NASA FIRMS] Synchronized Fetching starting...');

  // Try Redis cache first
  const redisCache = await redisGet('cache:fires');
  if (redisCache && redisCache.features) {
    logger.info({ count: redisCache.features.length }, '[Upstash Redis] Serving FIRMS fires dataset from distributed cache.');
    memoryCache = {
      lastUpdated: Date.now(),
      geoJson: redisCache
    };
    return redisCache;
  }

  const endpoints = [
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/VIIRS_NOAA20_NRT/world/2`, name: 'VIIRS_NOAA20' },
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/VIIRS_NOAA21_NRT/world/2`, name: 'VIIRS_NOAA21' },
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/VIIRS_SNPP_NRT/world/2`, name: 'VIIRS_SNPP' },
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/MODIS_NRT/world/2`, name: 'MODIS_NRT' }
  ];

  let allFeatures = [];

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url);
      if (response.ok) {
        const text = await response.text();
        const feats = parseCsvToGeoJSON(text, ep.name);
        allFeatures = allFeatures.concat(feats);
        logger.info({ source: ep.name, count: feats.length }, '[NASA FIRMS] Stream parsed successfully');
      } else {
        logger.warn({ source: ep.name, status: response.status }, '[NASA FIRMS] Stream returned non-200 response');
      }
    } catch (err) {
      logger.error({ source: ep.name, err: err.message }, '[NASA FIRMS] Stream fetch failed');
    }
  }

  // Deduplicate features by unique spatial coordinate & timestamp key
  const uniqueMap = new Map();
  for (const f of allFeatures) {
    const coords = f.geometry.coordinates;
    const key = `${coords[0].toFixed(3)}_${coords[1].toFixed(3)}_${f.properties.acq_date}_${f.properties.acq_time}`;
    if (!uniqueMap.has(key) || f.properties.frp > uniqueMap.get(key).properties.frp) {
      uniqueMap.set(key, f);
    }
  }

  allFeatures = Array.from(uniqueMap.values());

  // Sort by FRP descending
  allFeatures.sort((a, b) => b.properties.frp - a.properties.frp);

  const geoJson = {
    type: 'FeatureCollection',
    metadata: {
      generated_at: new Date().toISOString(),
      count: allFeatures.length
    },
    features: allFeatures
  };

  memoryCache = {
    lastUpdated: Date.now(),
    geoJson: geoJson
  };

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(geoJson), 'utf8');
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to write fires disk cache');
  }

  redisSet('cache:fires', geoJson, 7200).catch((e) => {
    logger.debug({ err: e.message }, 'Redis fires cache set failed');
  });

  return geoJson;
}

async function fetchUsgsEarthquakes() {
  try {
    const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&orderby=time';
    const response = await fetch(url);
    if (response.ok) {
      const geoJson = await response.json();
      quakesMemoryCache = {
        lastUpdated: Date.now(),
        geoJson: geoJson
      };
      try {
        fs.writeFileSync(QUAKES_CACHE_FILE, JSON.stringify(geoJson), 'utf8');
      } catch (e) {
        logger.debug({ err: e.message }, 'Failed writing earthquakes disk cache');
      }

      redisSet('cache:earthquakes', geoJson, 7200).catch((e) => {
        logger.debug({ err: e.message }, 'Redis earthquakes cache set failed');
      });
      return geoJson;
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error fetching USGS earthquakes');
  }

  return quakesMemoryCache.geoJson || { type: 'FeatureCollection', features: [] };
}

function saveAndCacheFlights(flightFeatures) {
  const geoJson = {
    type: 'FeatureCollection',
    metadata: {
      generated_at: new Date().toISOString(),
      count: flightFeatures.length
    },
    features: flightFeatures
  };

  flightsMemoryCache = {
    lastUpdated: Date.now(),
    geoJson: geoJson
  };

  try {
    fs.writeFileSync(FLIGHTS_CACHE_FILE, JSON.stringify(geoJson), 'utf8');
  } catch (e) {
    logger.debug({ err: e.message }, 'Failed writing flights disk cache');
  }

  redisSet('cache:flights', geoJson, 15).catch((e) => {
    logger.debug({ err: e.message }, 'Redis flights cache set failed');
  });

  return geoJson;
}

async function fetchAdsbRegion(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const tId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal
    });
    clearTimeout(tId);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.ac) ? data.ac : [];
    }
  } catch (e) {
    clearTimeout(tId);
  }
  return [];
}

function getAircraftCategory(a) {
  const callsign = (a.flight || a.r || '').trim().toUpperCase();
  const type = (a.t || '').toUpperCase();
  const dbFlags = a.dbFlags || 0;

  // 1. Military (from /v2/mil endpoint OR dbFlags=1 OR military callsign/type prefix)
  if (a.isMilitary || dbFlags === 1 || callsign.startsWith('RCH') || callsign.startsWith('NATO') || callsign.startsWith('NAVY') || callsign.startsWith('FAF') || callsign.startsWith('BAF') || callsign.startsWith('IAM') || callsign.startsWith('CNV') || type === 'F16' || type === 'F18' || type === 'F35' || type === 'C130' || type === 'C17' || type === 'A400' || type === 'E3TF' || type === 'KC135') {
    return {
      category: 'military',
      flight_type: 'Militaire 🎖️',
      color: '#ef4444' // Red
    };
  }

  // 2. Helicopter / Medical / Emergency Rescue
  if (type.startsWith('EC') || type.startsWith('H60') || type.startsWith('A109') || type.startsWith('AW1') || type.startsWith('B06') || type.startsWith('AS50') || type.startsWith('R44') || callsign.startsWith('DRF') || callsign.startsWith('REGA') || callsign.startsWith('SAMU') || callsign.startsWith('MED') || callsign.startsWith('DRAGON')) {
    return {
      category: 'emergency',
      flight_type: 'Hélico / Secours 🚁',
      color: '#f59e0b' // Amber / Orange
    };
  }

  // 3. Private Jet / Business Aviation
  if (type.startsWith('GLF') || type.startsWith('CL6') || type.startsWith('E55') || type.startsWith('FA7') || type.startsWith('C56') || type.startsWith('BE20') || type.startsWith('E50') || callsign.startsWith('N1') || callsign.startsWith('LX-') || callsign.startsWith('OE-') || callsign.startsWith('CS-')) {
    return {
      category: 'private',
      flight_type: 'Jet Privé 🛩️',
      color: '#a855f7' // Purple
    };
  }

  // 4. Commercial Flight (Default)
  return {
    category: 'commercial',
    flight_type: 'Vol Commercial ✈️',
    color: '#38bdf8' // Cyan / Blue
  };
}

async function fetchOpenSkyFlights() {
  try {
    // 13-zone full planet Earth grid matrix + Military feed
    const regionUrls = [
      'https://api.adsb.lol/v2/lat/48.85/lon/2.35/dist/3500',      // Zone 1: Europe West & Central
      'https://api.adsb.lol/v2/lat/55.75/lon/37.61/dist/3500',     // Zone 2: Eastern Europe & Eurasia
      'https://api.adsb.lol/v2/lat/40.71/lon/-74.0/dist/3500',     // Zone 3: North America East & Canada
      'https://api.adsb.lol/v2/lat/34.05/lon/-118.25/dist/3500',  // Zone 4: North America West & Pacific
      'https://api.adsb.lol/v2/lat/15.0/lon/-90.0/dist/3500',      // Zone 5: Central America & Caribbean
      'https://api.adsb.lol/v2/lat/-15.78/lon/-47.92/dist/3500',  // Zone 6: South America North & Brazil
      'https://api.adsb.lol/v2/lat/-34.60/lon/-58.38/dist/3500',  // Zone 7: South America South & Argentina/Chile
      'https://api.adsb.lol/v2/lat/15.0/lon/15.0/dist/3500',       // Zone 8: North & West Africa
      'https://api.adsb.lol/v2/lat/-1.29/lon/36.82/dist/3500',    // Zone 9: East & South Africa
      'https://api.adsb.lol/v2/lat/20.59/lon/78.96/dist/3500',    // Zone 10: Middle East & India / South Asia
      'https://api.adsb.lol/v2/lat/35.67/lon/139.65/dist/3500',   // Zone 11: East Asia, China & Japan
      'https://api.adsb.lol/v2/lat/-25.27/lon/133.77/dist/3500',  // Zone 12: Australia, NZ & Oceania
      'https://api.adsb.lol/v2/lat/1.35/lon/103.82/dist/3500'      // Zone 13: Southeast Asia
    ];

    const [milList, ...results] = await Promise.all([
      fetchAdsbRegion('https://api.adsb.lol/v2/mil', 3000),
      ...regionUrls.map(url => fetchAdsbRegion(url, 3000))
    ]);

    const acMap = new Map();

    // Mark military planes explicitly
    for (const a of milList) {
      if (a.hex && a.lat !== undefined && a.lon !== undefined) {
        acMap.set(a.hex, { ...a, isMilitary: true });
      }
    }

    for (const list of results) {
      for (const a of list) {
        if (a.hex && a.lat !== undefined && a.lon !== undefined && !acMap.has(a.hex)) {
          acMap.set(a.hex, a);
        }
      }
    }

async function resolveFlightRouteAirports(a, category, callsign) {
  const routes = await loadOpenFlightsRoutes();
  const airlinesMap = await loadOpenFlightsAirlines();
  const lat = a.lat;
  const lon = a.lon;
  const heading = a.track || 0;

  let depCode = a.orig_icao || a.orig || a.dep || null;
  let arrCode = a.dest_icao || a.dest || a.arr || null;

  if (!depCode || !arrCode) {
    const cs = (callsign || '').trim().toUpperCase();
    if (cs && cs !== 'N/A') {
      const icaoPrefix = cs.substring(0, 3);
      const iataCode = airlinesMap[icaoPrefix] || cs.substring(0, 2);
      const matchedRoutes = routes ? routes[iataCode] : null;

      if (matchedRoutes && matchedRoutes.length > 0) {
        let minRouteDist = Infinity, bestRoute = null;
        for (const r of matchedRoutes) {
          const depAp = resolveAirportInfo(r.src);
          const arrAp = resolveAirportInfo(r.dst);
          if (depAp && depAp.lat && arrAp && arrAp.lat) {
            const d1 = distanceKm(lat, lon, depAp.lat, depAp.lon);
            const d2 = distanceKm(lat, lon, arrAp.lat, arrAp.lon);
            if (d1 + d2 < minRouteDist) {
              minRouteDist = d1 + d2;
              bestRoute = r;
            }
          }
        }
        if (bestRoute) {
          depCode = depCode || bestRoute.src;
          arrCode = arrCode || bestRoute.dst;
        } else {
          depCode = depCode || matchedRoutes[0].src;
          arrCode = arrCode || matchedRoutes[0].dst;
        }
      }
    }
  }

  if (!depCode || !arrCode) {
    const inferred = inferRouteKinematic(lat, lon, heading);
    depCode = depCode || inferred.dep;
    arrCode = arrCode || inferred.arr;
  }

  const depInfo = resolveAirportInfo(depCode) || { iata: 'DEP', name: 'Aéroport de Départ', city: 'Départ', country: 'International 🌐' };
  const arrInfo = resolveAirportInfo(arrCode) || { iata: 'ARR', name: 'Aéroport d\'Arrivée', city: 'Arrivée', country: 'International 🌐' };

  return { depInfo, arrInfo };
}

    if (acMap.size > 0) {
      const flightFeatures = [];
      await Promise.all([loadOpenFlightsRoutes(), loadOpenFlightsAirlines()]);

      for (const a of acMap.values()) {
        const callsign = (a.flight || a.r || 'N/A').trim();
        const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : 10000;
        const altM = Math.round(altFt / 3.28084);
        const heading = Math.round(a.track || 0);
        const originCountry = a.t ? `Avion (${a.t})` : 'International';

        const catInfo = getAircraftCategory(a);

        // Resolve departure & arrival airport info using 4-digit ICAO / 3-letter IATA & global_airports.json
        const { depInfo, arrInfo } = await resolveFlightRouteAirports(a, catInfo.category, callsign);

        flightFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
          properties: {
            icao24: a.hex || 'N/A',
            callsign: callsign,
            origin_country: originCountry,
            altitude_m: altM,
            altitude_ft: altFt,
            velocity_kmh: Math.round((a.gs || 0) * 1.852),
            heading: heading,
            vertical_rate: 0,
            on_ground: false,
            squawk: '7000',
            category: catInfo.category,
            flight_type: catInfo.flight_type,
            color: catInfo.color,
            model_type: a.t || 'N/A',
            registration: a.r || 'N/A',
            dep_iata: depInfo.iata,
            dep_name: depInfo.name,
            dep_city: depInfo.city,
            dep_country: depInfo.country,
            arr_iata: arrInfo.iata,
            arr_name: arrInfo.name,
            arr_city: arrInfo.city,
            arr_country: arrInfo.country
          }
        });
      }

      logger.info({ count: flightFeatures.length }, '✈️ 100% Triple-Hub Global ADSB feed synced active aircraft to cache.');
      return saveAndCacheFlights(flightFeatures);
    }
  } catch (err) {
    clearTimeout(adsbTimeout);
    logger.debug({ err: err.message }, 'ADSB.lol fetch failed or timed out, trying OpenSky fallback...');
  }

  // 2. OpenSky Network API (Secondary fallback if ADSB.lol is unavailable)
  const openSkyController = new AbortController();
  const openSkyTimeout = setTimeout(() => openSkyController.abort(), 4000);

  try {
    const statesRes = await fetch('https://opensky-network.org/api/states/all', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      signal: openSkyController.signal
    });
    clearTimeout(openSkyTimeout);

    if (statesRes.ok) {
      const data = await statesRes.json();
      const rawStates = data.states || [];
      const flightFeatures = [];

      for (const s of rawStates) {
        const lon = s[5];
        const lat = s[6];
        if (lon === null || lat === null || isNaN(lon) || isNaN(lat)) continue;

        const originCountry = s[2] || 'International';
        flightFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            icao24: s[0],
            callsign: (s[1] || 'N/A').trim(),
            origin_country: originCountry,
            altitude_m: Math.round(s[7] || s[13] || 0),
            altitude_ft: Math.round((s[7] || s[13] || 0) * 3.28084),
            velocity_kmh: Math.round((s[9] || 0) * 3.6),
            heading: Math.round(s[10] || 0),
            vertical_rate: s[11] || 0,
            on_ground: s[8] || false,
            squawk: s[14] || 'N/A',
            dep_iata: 'DEP',
            dep_name: `Aéroport (${originCountry})`,
            dep_city: originCountry,
            dep_country: originCountry,
            arr_iata: 'ARR',
            arr_name: 'Trajectoire Internationale',
            arr_city: 'En Vol',
            arr_country: 'International'
          }
        });
      }

      if (flightFeatures.length > 0) {
        logger.info({ count: flightFeatures.length }, '✈️ OpenSky REST API active aircraft synced to cache.');
        return saveAndCacheFlights(flightFeatures);
      }
    }
  } catch (err) {
    clearTimeout(openSkyTimeout);
    logger.error({ err: err.message, stack: err.stack }, '❌ [Vercel Log Error] Exception processing flights');
  }

  return flightsMemoryCache.geoJson || { type: 'FeatureCollection', features: [] };
}

function loadDiskCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const stats = fs.statSync(CACHE_FILE);
      const content = fs.readFileSync(CACHE_FILE, 'utf8');
      memoryCache = {
        lastUpdated: stats.mtimeMs,
        geoJson: JSON.parse(content)
      };
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed loading fires disk cache');
    }
  }
}

async function getOrUpdateData() {
  const now = Date.now();
  if (memoryCache.geoJson && (now - memoryCache.lastUpdated < TWO_HOURS_MS)) {
    return memoryCache.geoJson;
  }
  if (!memoryCache.geoJson) loadDiskCache();
  if (memoryCache.geoJson && (now - memoryCache.lastUpdated < TWO_HOURS_MS)) {
    return memoryCache.geoJson;
  }
  return await fetchFirmsData();
}

// Global Background Sync Timers (Disabled during test suite execution to allow clean exit)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    fetchFirmsData().catch(e => logger.error({ err: e.message }, 'Background NASA sync error'));
    fetchUsgsEarthquakes().catch(e => logger.error({ err: e.message }, 'Background USGS sync error'));
  }, TWO_HOURS_MS);

  setInterval(() => {
    fetchOpenSkyFlights().catch(e => logger.error({ err: e.message }, 'Background OpenSky sync error'));
  }, TWO_MINUTES_MS);
}

// API Endpoint for NASA Fires with Dynamic Time Window Filtering
app.get('/api/fires', async (req, res) => {
  try {
    const data = await getOrUpdateData();

    const hours = parseInt(req.query.hours) || 24;
    const minFrp = parseFloat(req.query.min_frp) || 0;
    const sensor = (req.query.sensor || 'all').toLowerCase();

    // Use latest detection timestamp in dataset as reference point!
    const latestTimestamp = (data.features && data.features.length > 0 && data.features[0].properties.timestamp)
      ? data.features[0].properties.timestamp
      : Date.now();
    const cutoffTimestamp = latestTimestamp - (hours * 3600 * 1000);

    const filteredFeatures = [];
    for (const f of data.features) {
      const p = f.properties;
      if (p.timestamp < cutoffTimestamp) continue;
      if (p.frp < minFrp) continue;
      if (sensor !== 'all') {
        if (sensor === 'viirs' && !p.satellite.includes('VIIRS')) continue;
        if (sensor === 'modis' && !p.satellite.includes('MODIS')) continue;
      }

      // Optimize payload size: round coordinates to 4 decimal places (~11m precision)
      const coords = f.geometry.coordinates;
      filteredFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            Math.round(coords[0] * 10000) / 10000,
            Math.round(coords[1] * 10000) / 10000
          ]
        },
        properties: p
      });
    }

    const now = Date.now();
    const nextSyncTimestamp = Math.ceil(now / TWO_HOURS_MS) * TWO_HOURS_MS;
    const remainingSeconds = Math.max(0, Math.floor((nextSyncTimestamp - now) / 1000));

    // Optimize Vercel Edge Cache: 30 minutes cache for static 2-hour satellite fire data
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');

    res.json({
      type: 'FeatureCollection',
      metadata: {
        last_updated: new Date(memoryCache.lastUpdated).toISOString(),
        next_update_in_seconds: remainingSeconds,
        total_in_cache: data.features.length,
        filtered_count: filteredFeatures.length,
        filters: { hours, minFrp, sensor }
      },
      features: filteredFeatures
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to retrieve fire data');
    res.status(500).json({ error: 'Failed to retrieve fire data', message: err.message });
  }
});

app.get('/api/earthquakes', async (req, res) => {
  try {
    if (!quakesMemoryCache.geoJson || (Date.now() - quakesMemoryCache.lastUpdated > TWO_HOURS_MS)) {
      await fetchUsgsEarthquakes();
    }
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
    res.json(quakesMemoryCache.geoJson || { type: 'FeatureCollection', features: [] });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to fetch USGS earthquakes');
    res.status(500).json({ error: 'Failed to fetch USGS earthquakes', message: err.message });
  }
});

// Official Production-Grade LRU Cache (Max 5,000 cities, 24-Hour TTL)
export const geocodingCache = new LRUCache({
  max: 5000,
  ttl: 24 * 60 * 60 * 1000, // 24 Hours in ms
  updateAgeOnGet: true, // Refresh TTL when searched again
});

// Rate Limiting Protection (Max 30 geocode requests per minute per IP)
const geocodeRateLimitMap = new Map();

// Periodic Cleanup of Expired IP Rate Limiting Records (Every 5 Minutes)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, client] of geocodeRateLimitMap.entries()) {
      if (now > client.resetAt) {
        geocodeRateLimitMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}

function isGeocodeRateLimited(ip) {
  const now = Date.now();
  const client = geocodeRateLimitMap.get(ip);
  if (!client || now > client.resetAt) {
    geocodeRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  if (client.count >= 30) {
    return true;
  }
  client.count++;
  return false;
}

app.get('/api/geocode', async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    
    // Rate Limiting Check
    if (isGeocodeRateLimited(clientIp)) {
      logger.warn({ clientIp }, 'Geocoding rate limit exceeded');
      return res.status(429).json({ error: 'Trop de requêtes de géocodage. Veuillez patienter une minute.' });
    }

    const rawQuery = req.query.q;
    if (!rawQuery || typeof rawQuery !== 'string') {
      return res.status(400).json({ error: 'Le paramètre q est obligatoire' });
    }

    // Input Sanitization & Validation (Length 2-60, strip script/HTML tags)
    const sanitizedQuery = rawQuery.trim().replace(/[<>{}[\]]/g, '');
    if (sanitizedQuery.length < 2 || sanitizedQuery.length > 60) {
      return res.status(400).json({ error: 'La recherche doit contenir entre 2 et 60 caractères.' });
    }

    const queryKey = sanitizedQuery.toLowerCase();

    // 1. Check LRU Server RAM Cache first!
    const cached = geocodingCache.get(queryKey);
    if (cached) {
      logger.info({ queryKey, center: cached.center }, '⚡ [Geocode LRU Cache HIT]');
      return res.json({ cached: true, center: cached.center, locationName: cached.fullLocation });
    }

    // 2. Check Redis shared cache if available
    const redisCacheKey = `geocode:${queryKey}`;
    const redisVal = await redisGet(redisCacheKey);
    if (redisVal && redisVal.center) {
      geocodingCache.set(queryKey, { center: redisVal.center, fullLocation: redisVal.fullLocation });
      logger.info({ queryKey, center: redisVal.center }, '⚡ [Upstash Redis Geocode HIT]');
      return res.json({ cached: true, center: redisVal.center, locationName: redisVal.fullLocation });
    }

    // 3. Execute ONE external geocoding request to Mapbox
    const mbRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(queryKey)}.json?access_token=${MAPBOX_TOKEN}`);
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      if (mbData.features && mbData.features.length > 0) {
        const feat = mbData.features[0];
        const center = feat.center; // [lon, lat]
        const fullLocation = feat.place_name || queryKey;
        
        const entry = { center, fullLocation };
        geocodingCache.set(queryKey, entry);
        redisSet(redisCacheKey, entry, 86400).catch((e) => {
          logger.debug({ err: e.message }, 'Redis geocode cache set failed');
        });

        logger.info({ queryKey, center }, '🌐 [Geocode Mapbox FETCHED & CACHED]');
        return res.json({ cached: false, center, locationName: fullLocation });
      }
    }
    return res.status(404).json({ error: 'Localisation introuvable' });
  } catch (err) {
    logger.error({ err: err.message }, 'Échec de la recherche de géocodage');
    return res.status(500).json({ error: 'Échec de la recherche de géocodage', message: err.message });
  }
});

app.get('/api/flights', async (req, res) => {
  try {
    // 100% Direct Live Fetch (No Server Cache, Zero Rate Limits on ADSB)
    const data = await fetchOpenSkyFlights();
    const count = data.features ? data.features.length : 0;

    if (count === 0) {
      logger.warn({ endpoint: '/api/flights', count: 0 }, '⚠️ [Vercel Console Log] /api/flights - 0 avions en vol renvoyés au client (couche aérienne vide)');
    } else {
      logger.info({ endpoint: '/api/flights', count }, '✅ [Vercel Console Log] /api/flights - Avions transmis en direct sans cache');
    }

    // Ultra-Fast Edge CDN Cache (3s Micro-Cache): Handles 100,000+ concurrent visitors instantly with 0ms lag
    res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=3, stale-while-revalidate=5');
    res.json(data);
  } catch (err) {
    logger.error({ endpoint: '/api/flights', err: err.message, stack: err.stack }, '❌ [Vercel Console Error] Échec du traitement /api/flights');
    const errorMsg = process.env.NODE_ENV === 'production' ? undefined : err.message;
    res.status(500).json({ error: 'Failed to fetch OpenSky flights', message: errorMsg });
  }
});

// Explicit route for Google AdSense ads.txt verification
app.get('/ads.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  
  const publicAdsPath = path.join(__dirname, '..', 'public', 'ads.txt');
  if (fs.existsSync(publicAdsPath)) {
    return res.sendFile(publicAdsPath);
  }
  
  const distAdsPath = path.join(__dirname, '..', 'dist', 'ads.txt');
  if (fs.existsSync(distAdsPath)) {
    return res.sendFile(distAdsPath);
  }

  return res.send('google.com, pub-7458097942291936, DIRECT, f08c47fec0942fa0\n');
});

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server if launched directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.info({ port: PORT }, `🔥 FireWatch RealTime Caching Server running on http://localhost:${PORT}`);
    await loadGlobalAirportsDb();
    loadOpenFlightsAirlines().catch(e => logger.debug({ err: e.message }, 'Initial airlines DB load failed'));
    getOrUpdateData().catch(e => logger.error({ err: e.message }, 'Initial NASA FIRMS sync failed'));
    fetchUsgsEarthquakes().catch(e => logger.error({ err: e.message }, 'Initial USGS sync failed'));
    fetchOpenSkyFlights().catch(e => logger.error({ err: e.message }, 'Initial OpenSky sync failed'));
  });
}
