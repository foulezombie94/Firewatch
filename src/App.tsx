import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Map } from './components/Map';
import { Legend } from './components/Legend';
import { FireInspector } from './components/FireInspector';
import { FlightInspector } from './components/FlightInspector';
import { ReportModal } from './components/ReportModal';
import { ErrorOverlay } from './components/ErrorOverlay';
import { FireGeoJSON, EarthquakeGeoJSON, FlightGeoJSON, FilterState, MapStyleKey, MapProjectionKey, FireFeature, FlightFeature, CameraPreset } from './types';
import { getReverseGeocode } from './utils/geocoding';
import { getCachedGeoJSON, setCachedGeoJSON } from './utils/idbCache';

interface ServiceStatus {
  fires: 'ok' | 'error' | 'loading';
  earthquakes: 'ok' | 'error' | 'loading';
  flights: 'ok' | 'error' | 'loading';
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const App: React.FC = () => {
  const [rawFiresData, setRawFiresData] = useState<FireGeoJSON | null>(() => {
    try {
      const saved = localStorage.getItem('firewatch_cached_fires');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [quakesGeoJson, setQuakesGeoJson] = useState<EarthquakeGeoJSON | null>(() => {
    try {
      const saved = localStorage.getItem('firewatch_cached_quakes');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [flightsGeoJson, setFlightsGeoJson] = useState<FlightGeoJSON | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Instant 0ms IndexedDB Cache Restoration on Mount!
  useEffect(() => {
    getCachedGeoJSON<FireGeoJSON>('firewatch_cached_fires').then((cached) => {
      if (cached && cached.features && cached.features.length > 0) {
        setRawFiresData(cached);
        setIsLoading(false);
      }
    });

    getCachedGeoJSON<EarthquakeGeoJSON>('firewatch_cached_quakes').then((cached) => {
      if (cached && cached.features && cached.features.length > 0) {
        setQuakesGeoJson(cached);
      }
    });
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [nextUpdateInSeconds, setNextUpdateInSeconds] = useState<number>(7200);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('satellite'); // Default style is Satellite HD
  const [mapProjection, setMapProjection] = useState<MapProjectionKey>('globe');
  const [searchLocationQuery, setSearchLocationQuery] = useState<string>('');
  
  // Camera fly-to preset & inspected features
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [inspectedFire, setInspectedFire] = useState<{
    feature: FireFeature;
    coords: [number, number];
  } | null>(null);

  const [inspectedFlight, setInspectedFlight] = useState<{
    feature: FlightFeature;
    coords: [number, number, number];
  } | null>(null);

  const [geocodedTopHotspots, setGeocodedTopHotspots] = useState<FireFeature[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    hours: 24,
    minFrp: 0,
    sensor: 'all',
    confidence: 'all',
    layerMode: 'all',
  });

  const [isAutoTourActive, setIsAutoTourActive] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    fires: 'loading',
    earthquakes: 'loading',
    flights: 'loading',
  });

  // Initial & progressive background fetch — render data on map instantly as each API responds!
  const fetchData = useCallback(async () => {
    setError(null);

    setServiceStatus({ fires: 'loading', earthquakes: 'loading', flights: 'loading' });

    // 1. 🔥 NASA FIRMS — Fires (Primary Data Source)
    const fetchFires = fetch('/api/fires?hours=48&min_frp=0&sensor=all')
      .then(async (res) => {
        if (!res.ok) throw new Error('Fires error');
        const data: FireGeoJSON = await res.json();
        setRawFiresData(data);
        setCachedGeoJSON('firewatch_cached_fires', data);
        if (data.metadata?.next_update_in_seconds) {
          setNextUpdateInSeconds(data.metadata.next_update_in_seconds);
        }
        setServiceStatus(prev => ({ ...prev, fires: 'ok' }));
      })
      .catch(() => {
        setServiceStatus(prev => ({ ...prev, fires: 'error' }));
        setError('Impossible de contacter le serveur NASA FIRMS. Les données incendies sont temporairement indisponibles.');
      })
      .finally(() => {
        setIsLoading(false); // Hide main loading spinner as soon as primary fire data arrives!
      });

    // 2. 🌍 USGS — Earthquakes (Progressive Parallel Load)
    const fetchQuakes = fetch('/api/earthquakes')
      .then(async (res) => {
        if (!res.ok) throw new Error('Quakes error');
        const qData: EarthquakeGeoJSON = await res.json();
        setQuakesGeoJson(qData);
        setCachedGeoJSON('firewatch_cached_quakes', qData);
        setServiceStatus(prev => ({ ...prev, earthquakes: 'ok' }));
      })
      .catch(() => {
        setServiceStatus(prev => ({ ...prev, earthquakes: 'error' }));
      });

    // 3. ✈️ OpenSky — Flights (Progressive Parallel Load)
    const fetchFlights = fetch('/api/flights')
      .then(async (res) => {
        if (!res.ok) throw new Error('Flights error');
        const flData: FlightGeoJSON = await res.json();
        setFlightsGeoJson(flData);
        setServiceStatus(prev => ({ ...prev, flights: 'ok' }));
      })
      .catch(() => {
        setServiceStatus(prev => ({ ...prev, flights: 'error' }));
      });

    await Promise.allSettled([fetchFires, fetchQuakes, fetchFlights]);
  }, []);

  useEffect(() => {
    fetchData();

    // 15-Second Ultra-Fast Real-Time Flight Radar Auto-Sync with ADSB!
    const flightInterval = setInterval(() => {
      fetch('/api/flights')
        .then(async (res) => {
          if (res.ok) {
            const flData: FlightGeoJSON = await res.json();
            setFlightsGeoJson(flData);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(flightInterval);
  }, [fetchData]);

  // Instantaneous 0ms Client-Side In-Memory Filtering for Fire Time Period, FRP, Sensor & Confidence!
  const geoJson = useMemo<FireGeoJSON | null>(() => {
    if (!rawFiresData || !rawFiresData.features) return null;

    const allFeatures = rawFiresData.features;
    if (allFeatures.length === 0) return rawFiresData;

    const latestTs = allFeatures.reduce((max, f) => (f.properties?.timestamp > max ? f.properties.timestamp : max), 0) || Date.now();
    const cutoffTs = latestTs - (filters.hours * 3600 * 1000);

    const filtered = allFeatures.filter((f) => {
      const p = f.properties;
      if (!p) return false;
      if (p.timestamp && p.timestamp < cutoffTs) return false;
      if (typeof p.frp === 'number' && p.frp < filters.minFrp) return false;
      if (filters.sensor !== 'all') {
        if (filters.sensor === 'viirs' && (!p.satellite || !p.satellite.includes('VIIRS'))) return false;
        if (filters.sensor === 'modis' && (!p.satellite || !p.satellite.includes('MODIS'))) return false;
      }
      if (filters.confidence === 'high' && p.confidence !== 'h') return false;
      return true;
    });

    return {
      ...rawFiresData,
      metadata: {
        ...rawFiresData.metadata,
        filtered_count: filtered.length,
      },
      features: filtered,
    };
  }, [rawFiresData, filters.hours, filters.minFrp, filters.sensor, filters.confidence, filters.layerMode]);

  // Unified 2-hour background data refresh for all 3 streams (Incendies, Séismes, Avions)
  useEffect(() => {
    const mainTimer = setInterval(() => {
      fetchData();
    }, 7200000);
    return () => clearInterval(mainTimer);
  }, [fetchData]);

  // Smooth 1-second countdown timer - purges old data and triggers full refresh at 0s (2h cycle)
  useEffect(() => {
    const interval = setInterval(() => {
      setNextUpdateInSeconds((prev) => {
        if (prev <= 1) {
          fetchData();
          return 7200;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute Top 10 spatially deduplicated hotspots by FRP rating
  const top10Hotspots = useMemo(() => {
    if (!geoJson || !geoJson.features) return [];
    const sorted = [...geoJson.features].sort((a, b) => b.properties.frp - a.properties.frp);
    
    const distinctSpots: FireFeature[] = [];
    for (const fire of sorted) {
      if (distinctSpots.length >= 10) break;
      const [lon, lat] = fire.geometry.coordinates;

      // Deduplicate fires within ~0.35 degrees (~35km) of each other
      const isTooClose = distinctSpots.some((existing) => {
        const [eLon, eLat] = existing.geometry.coordinates;
        return Math.abs(lat - eLat) < 0.35 && Math.abs(lon - eLon) < 0.35;
      });

      if (!isTooClose) {
        distinctSpots.push(fire);
      }
    }
    return distinctSpots;
  }, [geoJson]);

  // Asynchronous reverse-geocoding for top 10 hotspots
  useEffect(() => {
    if (!top10Hotspots || top10Hotspots.length === 0) {
      setGeocodedTopHotspots([]);
      return;
    }

    let isMounted = true;
    const geocodePromises = top10Hotspots.map(async (feature): Promise<FireFeature> => {
      if (feature.properties.locationName && feature.properties.locationName !== ',' && !feature.properties.locationName.startsWith(',')) {
        return feature;
      }
      const [lon, lat] = feature.geometry.coordinates;
      const placeObj = await getReverseGeocode(lon, lat);
      const strName = typeof placeObj === 'string' ? placeObj : placeObj.fullLocation || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          locationName: strName,
        },
      };
    });

    Promise.all(geocodePromises).then((results) => {
      if (isMounted) {
        setGeocodedTopHotspots(results);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [top10Hotspots]);

  // 3D Cinematic Auto-Tour Patrol
  useEffect(() => {
    if (!isAutoTourActive || geocodedTopHotspots.length === 0) return;

    let currentIndex = 0;
    const flyNext = () => {
      const target = geocodedTopHotspots[currentIndex];
      if (target) {
        setInspectedFire({
          feature: target,
          coords: target.geometry.coordinates as [number, number],
        });
      }
      currentIndex = (currentIndex + 1) % geocodedTopHotspots.length;
    };

    flyNext();
    const interval = setInterval(flyNext, 7000);

    return () => clearInterval(interval);
  }, [isAutoTourActive, geocodedTopHotspots]);

  const maxFrpFire = useMemo(() => {
    if (!geoJson || !geoJson.features || geoJson.features.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < geoJson.features.length; i++) {
      const frp = geoJson.features[i].properties.frp;
      if (frp > max) max = frp;
    }
    return max;
  }, [geoJson]);

  const handleInspectFire = (feature: FireFeature) => {
    setInspectedFlight(null);
    setInspectedFire({
      feature,
      coords: feature.geometry.coordinates as [number, number],
    });
  };

  const handleInspectFlight = (feature: FlightFeature) => {
    setInspectedFire(null);
    const coords = feature.geometry.coordinates as [number, number, number];
    setInspectedFlight({
      feature,
      coords,
    });
  };

  // Find nearest active fire to an aircraft
  const nearestFireToFlight = useMemo(() => {
    if (!inspectedFlight || !geoJson || !geoJson.features || geoJson.features.length === 0) return null;
    const [fLon, fLat] = inspectedFlight.coords;
    let closest: FireFeature | null = null;
    let minDistance = Infinity;

    for (const fire of geoJson.features) {
      const [fireLon, fireLat] = fire.geometry.coordinates;
      const dist = haversineDistanceKm(fLat, fLon, fireLat, fireLon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = fire;
      }
    }

    if (!closest) return null;
    return {
      fire: closest,
      distanceKm: Math.round(minDistance * 10) / 10,
    };
  }, [inspectedFlight, geoJson]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white">
      {/* Error Overlay — Full-screen or Partial Banner */}
      <ErrorOverlay
        error={error}
        serviceStatus={serviceStatus}
        onRetry={fetchData}
        isRetrying={isLoading}
      />

      {/* Fixed Top Floating Command Header */}
      <Header
        totalFires={geoJson?.metadata?.filtered_count || 0}
        lastUpdated={geoJson?.metadata?.last_updated || null}
        nextUpdateInSeconds={nextUpdateInSeconds}
        isLoading={isLoading}
        maxFrpFire={maxFrpFire}
        topHotspots={geocodedTopHotspots}
        onFlyTo={(preset) => {
          setCameraPreset(preset);
          setInspectedFire(null);
          setInspectedFlight(null);
        }}
        onSearchLocation={(query) => setSearchLocationQuery(query)}
        onSelectFire={(fire) => handleInspectFire(fire)}
        isAutoTourActive={isAutoTourActive}
        onToggleAutoTour={() => setIsAutoTourActive((prev) => !prev)}
        onGenerateReport={() => setIsReportModalOpen(true)}
      />

      {/* Main Mapbox GL 3D Canvas */}
      <main className="w-full h-full">
        <Map
          geoJson={geoJson}
          quakesGeoJson={quakesGeoJson}
          flightsGeoJson={flightsGeoJson}
          layerMode={filters.layerMode}
          mapStyle={mapStyle}
          mapProjection={mapProjection}
          searchLocationQuery={searchLocationQuery}
          cameraPreset={cameraPreset}
          selectedFireFeature={inspectedFire?.feature}
          onInspectFire={handleInspectFire}
          onInspectFlight={handleInspectFlight}
        />
      </main>

      {/* Left Collapsible Glass Control Sidebar */}
      <Sidebar
        filters={filters}
        onFilterChange={(newFilters) => setFilters(newFilters)}
        mapStyle={mapStyle}
        onStyleChange={(style) => setMapStyle(style)}
        mapProjection={mapProjection}
        onProjectionChange={(proj) => setMapProjection(proj)}
        onSearchLocation={(query) => setSearchLocationQuery(query)}
        filteredCount={geoJson?.metadata?.filtered_count || 0}
        totalCount={rawFiresData?.metadata?.total_in_cache || rawFiresData?.features?.length || 0}
        topHotspots={geocodedTopHotspots}
        onSelectFire={(fire) => handleInspectFire(fire)}
      />

      {/* Map Legend */}
      <Legend />

      {/* Active Fire Detail Inspector Modal */}
      {inspectedFire && (
        <FireInspector
          fireProps={inspectedFire.feature.properties}
          coordinates={inspectedFire.coords}
          onClose={() => setInspectedFire(null)}
          onFlyToFire={(c) => {
            setCameraPreset({ id: 'custom', name: 'Fire', center: c, zoom: 10, pitch: 45 });
          }}
        />
      )}

      {/* Active Aircraft Detail Inspector Modal */}
      {inspectedFlight && (
        <FlightInspector
          flightProps={inspectedFlight.feature.properties}
          coordinates={inspectedFlight.coords}
          onClose={() => setInspectedFlight(null)}
          onFlyToFlight={(c) => {
            setCameraPreset({ id: 'custom', name: 'Flight', center: c, zoom: 9, pitch: 35 });
          }}
        />
      )}

      {/* SITREP Emergency Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        topHotspots={geocodedTopHotspots}
        totalFires={geoJson?.metadata?.filtered_count || 0}
        lastUpdated={geoJson?.metadata?.last_updated || null}
      />
    </div>
  );
};
