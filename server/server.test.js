import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app, parseCsvToGeoJSON, resolveAirportInfo, geocodingCache } from './server.js';

describe('🔥 Firewatch Backend Automated Test Suite', () => {

  describe('1. CSV Parsing Engine (parseCsvToGeoJSON)', () => {
    it('should parse valid NASA FIRMS CSV data correctly into GeoJSON Features', () => {
      const sampleCsv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
43.55,6.95,320.5,0.4,0.4,2026-07-26,1230,N,VIIRS,h,1.0,295.1,150.8,D`;

      const features = parseCsvToGeoJSON(sampleCsv, 'VIIRS_NOAA20');

      expect(features).toHaveLength(1);
      expect(features[0].type).toBe('Feature');
      expect(features[0].geometry.coordinates).toEqual([6.95, 43.55]);
      expect(features[0].properties.frp).toBe(150.8);
      expect(features[0].properties.confidence).toBe('h');
      expect(features[0].properties.source).toBe('VIIRS_NOAA20');
    });

    it('should handle missing latitude/longitude headers gracefully without crashing', () => {
      const badCsv = `invalid_header_1,invalid_header_2,frp\n10,20,30`;
      const features = parseCsvToGeoJSON(badCsv, 'BAD_SOURCE');

      expect(features).toEqual([]);
    });

    it('should skip malformed or empty rows safely', () => {
      const malformedCsv = `latitude,longitude,frp\nabc,def,10.0\n43.1,6.2,50.0`;
      const features = parseCsvToGeoJSON(malformedCsv, 'TEST_SOURCE');

      expect(features).toHaveLength(1);
      expect(features[0].geometry.coordinates).toEqual([6.2, 43.1]);
    });
  });

  describe('2. Airport Information Resolver', () => {
    it('should resolve fallback airport info when code is valid string', () => {
      const info = resolveAirportInfo('LFMN', 'France');
      expect(info).toBeDefined();
      expect(info.iata).toBeTruthy();
      expect(info.country).toBeDefined();
    });

    it('should resolve IATA code ACE (Lanzarote) correctly', () => {
      const info = resolveAirportInfo('ACE');
      expect(info).toBeDefined();
      expect(info.iata).toBe('ACE');
      expect(info.icao).toBe('GCRR');
      expect(info.name).toContain('Lanzarote');
      expect(info.country).toContain('Espagne');
    });

    it('should resolve IATA code BHX (Birmingham) correctly', () => {
      const info = resolveAirportInfo('BHX');
      expect(info).toBeDefined();
      expect(info.iata).toBe('BHX');
      expect(info.icao).toBe('EGBB');
      expect(info.name).toContain('Birmingham');
      expect(info.country).toContain('Royaume-Uni');
    });

    it('should return null for empty or null ICAO code', () => {
      expect(resolveAirportInfo(null)).toBeNull();
      expect(resolveAirportInfo('')).toBeNull();
    });
  });

  describe('3. API Endpoints Integration Tests', () => {
    it('GET /api/fires should return FeatureCollection with metadata', async () => {
      const res = await request(app).get('/api/fires?hours=24');
      
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(res.body.metadata).toBeDefined();
      expect(Array.isArray(res.body.features)).toBe(true);
    }, 15000);

    it('GET /api/earthquakes should return FeatureCollection', async () => {
      const res = await request(app).get('/api/earthquakes');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
    }, 15000);

    it('GET /api/flights should return FeatureCollection', async () => {
      const res = await request(app).get('/api/flights');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
    }, 15000);
  });

  describe('4. Geocoding API & Rate Limiting Tests', () => {
    it('GET /api/geocode without query param should return 400 Bad Request', async () => {
      const res = await request(app).get('/api/geocode');
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('GET /api/geocode with query too short (< 2 chars) should return 400 Bad Request', async () => {
      const res = await request(app).get('/api/geocode?q=a');
      expect(res.status).toBe(400);
    });

    it('GET /api/geocode with valid cached query should return cached center', async () => {
      // Seed LRU cache
      geocodingCache.set('paris', { center: [2.3522, 48.8566], fullLocation: 'Paris, France' });

      const res = await request(app).get('/api/geocode?q=paris');
      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
      expect(res.body.center).toEqual([2.3522, 48.8566]);
      expect(res.body.locationName).toBe('Paris, France');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. 💣 RESILIENCE TESTS — Simulation de pannes des services externes
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. 💣 Resilience Tests — Pannes Simulées (Mocks)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      // Restaurer le vrai fetch après chaque test de résilience
      globalThis.fetch = originalFetch;
    });

    it('GET /api/fires doit survivre si NASA FIRMS renvoie une erreur 500', async () => {
      // Mock: TOUTES les requêtes fetch retournent 500
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
        })
      );

      const res = await request(app).get('/api/fires?hours=24');

      // Le serveur ne doit PAS crasher — il retourne un FeatureCollection vide ou le cache existant
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
    });

    it('GET /api/earthquakes doit survivre si USGS renvoie une erreur 503', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
        })
      );

      const res = await request(app).get('/api/earthquakes');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
    });

    it('GET /api/flights doit survivre si le réseau radar ADSB est en panne totale', async () => {
      // Mock: fetch rejette complètement (réseau HS, DNS fail, etc.)
      globalThis.fetch = vi.fn(() =>
        Promise.reject(new Error('Network Error: ADSB network unreachable'))
      );

      const res = await request(app).get('/api/flights');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
    });

    it('GET /api/geocode doit retourner 404 si Mapbox renvoie 0 résultats', async () => {
      // Vider le cache LRU pour forcer un appel Mapbox
      geocodingCache.clear();

      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ features: [] }), // Mapbox retourne 0 résultats
          text: () => Promise.resolve(''),
        })
      );

      const res = await request(app).get('/api/geocode?q=xyznonexistent99');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('GET /api/geocode doit retourner 500 si Mapbox timeout (fetch reject)', async () => {
      geocodingCache.clear();

      globalThis.fetch = vi.fn(() =>
        Promise.reject(new Error('AbortError: Mapbox request timed out after 10s'))
      );

      const res = await request(app).get('/api/geocode?q=marseille');

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('GET /api/fires doit survivre si NASA renvoie du HTML au lieu du CSV', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve('<html><body>Service Maintenance</body></html>'),
        })
      );

      const res = await request(app).get('/api/fires?hours=24');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      // Le parseur CSV ne doit pas crasher sur du HTML
      expect(Array.isArray(res.body.features)).toBe(true);
    });
  });

});
