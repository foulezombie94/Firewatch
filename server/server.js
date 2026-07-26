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

const COUNTRY_FLAGS = {
  FR: 'France 🇫🇷', US: 'États-Unis 🇺🇸', MA: 'Maroc 🇲🇦', DZ: 'Algérie 🇩🇿', TN: 'Tunisie 🇹🇳',
  ES: 'Espagne 🇪🇸', PT: 'Portugal 🇵🇹', GB: 'Royaume-Uni 🇬🇧', DE: 'Allemagne 🇩🇪', IT: 'Italie 🇮🇹',
  NL: 'Pays-Bas 🇳🇱', BE: 'Belgique 🇧🇪', CH: 'Suisse 🇨🇭', AT: 'Autriche 🇦🇹', SE: 'Suède 🇸🇪',
  NO: 'Norvège 🇳🇴', FI: 'Finlande 🇫🇮', DK: 'Danemark 🇩🇰', IE: 'Irlande 🇮🇪', GR: 'Grèce 🇬🇷',
  TR: 'Turquie 🇹🇷', AE: 'Émirats Arabes Unis 🇦🇪', QA: 'Qatar 🇶🇦', JP: 'Japon 🇯🇵', CN: 'Chine 🇨🇳',
  CA: 'Canada 🇨🇦', BR: 'Brésil 🇧🇷', AU: 'Australie 🇦🇺', SG: 'Singapour 🇸🇬', MX: 'Mexique 🇲🇽'
};

// Load 29,300+ Global Airports Database
async function loadGlobalAirportsDb() {
  if (fs.existsSync(GLOBAL_AIRPORTS_FILE)) {
    try {
      const content = fs.readFileSync(GLOBAL_AIRPORTS_FILE, 'utf8');
      globalAirportsDb = JSON.parse(content);
      logger.info({ count: Object.keys(globalAirportsDb).length }, '[Airports DB] Loaded global airports from local disk cache.');
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
      fs.writeFileSync(GLOBAL_AIRPORTS_FILE, JSON.stringify(globalAirportsDb), 'utf8');
      logger.info({ count: Object.keys(globalAirportsDb).length }, '[Airports DB] Successfully downloaded & cached global airports.');
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Airports DB] Failed to fetch global airports');
  }
}

export function resolveAirportInfo(icaoCode, defaultCountry = 'International') {
  if (!icaoCode) return null;
  const key = icaoCode.trim().toUpperCase();

  const ap = globalAirportsDb[key];
  if (ap) {
    const cName = COUNTRY_FLAGS[ap.country] || ap.country || defaultCountry;
    return {
      iata: ap.iata && ap.iata.length === 3 ? ap.iata : key,
      name: `${ap.name} (${key})`,
      city: ap.city || ap.name,
      country: cName
    };
  }

  return {
    iata: key,
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
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/VIIRS_NOAA20_NRT/world/1`, name: 'VIIRS_NOAA20' },
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/VIIRS_SNPP_NRT/world/1`, name: 'VIIRS_SNPP' },
    { url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_MAP_KEY}/MODIS_NRT/world/1`, name: 'MODIS_NRT' }
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

async function fetchOpenSkyFlights() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const begin = now - 7200;

    const [statesRes, schedulesRes] = await Promise.all([
      fetch('https://opensky-network.org/api/states/all'),
      fetch(`https://opensky-network.org/api/flights/all?begin=${begin}&end=${now}`).catch((e) => {
        logger.debug({ err: e.message }, 'OpenSky schedules optional request failed');
        return null;
      })
    ]);

    let flightSchedulesMap = new Map();
    if (schedulesRes && schedulesRes.ok) {
      try {
        const schedData = await schedulesRes.json();
        if (Array.isArray(schedData)) {
          for (const item of schedData) {
            if (item.icao24) {
              flightSchedulesMap.set(item.icao24.toLowerCase(), {
                dep: item.estDepartureAirport,
                arr: item.estArrivalAirport
              });
            }
          }
        }
      } catch (e) {
        logger.debug({ err: e.message }, 'Failed parsing OpenSky schedules payload');
      }
    }

    if (statesRes.ok) {
      const data = await statesRes.json();
      const rawStates = data.states || [];
      const flightFeatures = [];

      for (const s of rawStates) {
        const lon = s[5];
        const lat = s[6];
        if (lon === null || lat === null || isNaN(lon) || isNaN(lat)) continue;

        const icao24 = (s[0] || '').toLowerCase();
        const altM = s[7] || s[13] || 0;
        const callsign = (s[1] || 'N/A').trim();
        const originCountry = s[2] || 'International';
        const heading = Math.round(s[10] || 0);

        const realSchedule = flightSchedulesMap.get(icao24);

        let depIata = 'DEP';
        let depName = `Point d'Envol (${originCountry})`;
        let depCity = originCountry;
        let depCountry = originCountry;

        let arrIata = 'ARR';
        let arrName = 'Trajectoire Internationale';
        let arrCity = 'En Vol';
        let arrCountry = 'International';

        if (realSchedule) {
          if (realSchedule.dep) {
            const depResolved = resolveAirportInfo(realSchedule.dep, originCountry);
            depIata = depResolved.iata;
            depName = depResolved.name;
            depCity = depResolved.city;
            depCountry = depResolved.country;
          }

          if (realSchedule.arr) {
            const arrResolved = resolveAirportInfo(realSchedule.arr, 'International');
            arrIata = arrResolved.iata;
            arrName = arrResolved.name;
            arrCity = arrResolved.city;
            arrCountry = arrResolved.country;
          }
        }

        flightFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            icao24: s[0],
            callsign: callsign,
            origin_country: originCountry,
            altitude_m: Math.round(altM),
            altitude_ft: Math.round(altM * 3.28084),
            velocity_kmh: Math.round((s[9] || 0) * 3.6),
            heading: heading,
            vertical_rate: s[11] || 0,
            on_ground: s[8] || false,
            squawk: s[14] || 'N/A',
            dep_iata: depIata,
            dep_name: depName,
            dep_city: depCity,
            dep_country: depCountry,
            arr_iata: arrIata,
            arr_name: arrName,
            arr_city: arrCity,
            arr_country: arrCountry
          }
        });
      }

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

      redisSet('cache:flights', geoJson, 120).catch((e) => {
        logger.debug({ err: e.message }, 'Redis flights cache set failed');
      });
      logger.info({ count: flightFeatures.length }, 'OpenSky REST API active aircraft synced to cache.');
      return geoJson;
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error fetching OpenSky flights');
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

    const filteredFeatures = data.features.filter(f => {
      const p = f.properties;
      if (p.timestamp < cutoffTimestamp) return false;
      if (p.frp < minFrp) return false;
      if (sensor !== 'all') {
        if (sensor === 'viirs' && !p.satellite.includes('VIIRS')) return false;
        if (sensor === 'modis' && !p.satellite.includes('MODIS')) return false;
      }
      return true;
    });

    const now = Date.now();
    const nextSyncTimestamp = Math.ceil(now / TWO_HOURS_MS) * TWO_HOURS_MS;
    const remainingSeconds = Math.max(0, Math.floor((nextSyncTimestamp - now) / 1000));

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
    if (!flightsMemoryCache.geoJson || (Date.now() - flightsMemoryCache.lastUpdated > TWO_MINUTES_MS)) {
      await fetchOpenSkyFlights();
    }
    res.json(flightsMemoryCache.geoJson || { type: 'FeatureCollection', features: [] });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to fetch OpenSky flights');
    res.status(500).json({ error: 'Failed to fetch OpenSky flights', message: err.message });
  }
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
    getOrUpdateData().catch(e => logger.error({ err: e.message }, 'Initial NASA FIRMS sync failed'));
    fetchUsgsEarthquakes().catch(e => logger.error({ err: e.message }, 'Initial USGS sync failed'));
    fetchOpenSkyFlights().catch(e => logger.error({ err: e.message }, 'Initial OpenSky sync failed'));
  });
}
