import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { FireGeoJSON, EarthquakeGeoJSON, FlightGeoJSON, MapStyleKey, MapProjectionKey, LayerModeKey, FireProperties, FireFeature, FlightFeature, CameraPreset } from '../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
try {
  if ((mapboxgl as any).config) {
    (mapboxgl as any).config.REGISTER_SERVICE_WORKER = false;
  }
} catch (e) {}

interface MapProps {
  geoJson: FireGeoJSON | null;
  quakesGeoJson?: EarthquakeGeoJSON | null;
  flightsGeoJson?: FlightGeoJSON | null;
  layerMode?: LayerModeKey;
  mapStyle: MapStyleKey;
  mapProjection: MapProjectionKey;
  searchLocationQuery?: string;
  cameraPreset?: CameraPreset | null;
  selectedFireFeature?: FireFeature | null;
  onInspectFire: (feature: FireFeature) => void;
  onInspectFlight?: (feature: FlightFeature) => void;
}

const escapeHtml = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const STYLE_URLS: Record<MapStyleKey, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

// Synchronously generate high-resolution category-specific airplane & helicopter vector icons for Mapbox
const createAirplaneImageData = (category: string = 'commercial', fillColor: string = '#38bdf8', glowColor: string = '#0284c7'): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 48, 48);

  ctx.save();
  ctx.translate(24, 24);
  
  // Neon glow background
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  let pathString = '';

  if (category === 'military') {
    // 🎖️ Sharp Delta-Wing Fighter Jet (F-22 / Rafale / Eurofighter style)
    pathString = 'M 0 -21 L 2 -12 L 3 -8 L 18 5 L 18 8 L 15 8 L 4 10 L 4 15 L 9 19 L 9 21 L 3 20 L 2.5 21 L 0 19 L -2.5 21 L -3 20 L -9 21 L -9 19 L -4 15 L -4 10 L -15 8 L -18 8 L -18 5 L -3 -8 L -2 -12 Z';
    const path = new Path2D(pathString);
    ctx.fill(path);
    ctx.stroke(path);

    // Inner cockpit canopy accent
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -11, 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

  } else if (category === 'private') {
    // 🛩️ Executive Business Jet (T-Tail & Winglets style)
    pathString = 'M 0 -21 C 1 -18 2 -10 2 -3 L 16 3 L 16 1 L 17 2 L 16 6 L 2 7 L 2 12 L 3.5 13 L 3.5 16 L 2 16 L 7 19 L 7 21 L 0 19.5 L -7 21 L -7 19 L -2 16 L -3.5 16 L -3.5 13 L -2 12 L -2 7 L -16 6 L -17 2 L -16 1 L -16 3 L -2 -3 C -2 -10 -1 -18 0 -21 Z';
    const path = new Path2D(pathString);
    ctx.fill(path);
    ctx.stroke(path);

    // Engine pod accents
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3.5, 13, 1.2, 3);
    ctx.fillRect(2.3, 13, 1.2, 3);

  } else if (category === 'emergency') {
    // 🚁 Rescue Helicopter (Main Rotor Disc + Teardrop Cockpit + Glass Windshield)
    pathString = 'M 0 -16 C 5 -16 6.5 -10 6.5 -3 C 6.5 3 4.5 7 2 15 L 2 19 L 4.5 19 L 4.5 21 L 0 20 L -4.5 21 L -4.5 19 L -2 19 L -2 15 C -4.5 7 -6.5 3 -6.5 -3 C -6.5 -10 -5 -16 0 -16 Z';
    const path = new Path2D(pathString);
    ctx.fill(path);
    ctx.stroke(path);

    // Large Main Rotor Disc (spanning across top)
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-20, -5, 40, 2.5);
    ctx.fill();
    ctx.stroke();

    // Rotor Hub Center Node
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -3.7, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Glass Windshield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -11, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // ✈️ Commercial Airliner (A320 / B737 Jet with engines under wings)
    pathString = 'M 0 -20 C 1.2 -18 2.5 -12 2.5 -4 L 19 4 L 19 7 L 2.5 5.5 L 2.5 14 L 8 18 L 8 20.5 L 0 19 L -8 20.5 L -8 18 L -2.5 14 L -2.5 5.5 L -19 7 L -19 4 L -2.5 -4 C -2.5 -12 -1.2 -18 0 -20 Z';
    const path = new Path2D(pathString);
    ctx.fill(path);
    ctx.stroke(path);

    // Jet Engine Nacelles under wings
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7.5, 3, 2, 4);
    ctx.fillRect(5.5, 3, 2, 4);
  }

  ctx.restore();

  return ctx.getImageData(0, 0, 48, 48);
};

// Helper to safely check if Mapbox internal style object is fully loaded and ready
const isMapStyleReady = (map: mapboxgl.Map | null): boolean => {
  if (!map) return false;
  try {
    return map.isStyleLoaded() && !!(map as any).style && !!(map as any).style._loaded;
  } catch (e) {
    return false;
  }
};

const ensureAirplaneImage = (map: mapboxgl.Map) => {
  if (!map || !isMapStyleReady(map)) return;
  try {
    const icons = [
      { id: 'airplane-icon', category: 'commercial', fill: '#38bdf8', glow: '#0284c7' },           // Default Cyan
      { id: 'airplane-icon-commercial', category: 'commercial', fill: '#38bdf8', glow: '#0284c7' },// Cyan Blue ✈️
      { id: 'airplane-icon-military', category: 'military', fill: '#ef4444', glow: '#dc2626' },    // Neon Red 🎖️
      { id: 'airplane-icon-private', category: 'private', fill: '#c084fc', glow: '#a855f7' },      // Purple 🛩️
      { id: 'airplane-icon-emergency', category: 'emergency', fill: '#fbbf24', glow: '#f59e0b' }   // Amber Orange 🚁
    ];

    for (const ico of icons) {
      if (!map.hasImage(ico.id)) {
        const imgData = createAirplaneImageData(ico.category, ico.fill, ico.glow);
        map.addImage(ico.id, { width: 48, height: 48, data: imgData.data }, { pixelRatio: 2 });
      }
    }
  } catch (e) {}
};

export const Map: React.FC<MapProps> = ({
  geoJson,
  quakesGeoJson,
  flightsGeoJson,
  layerMode = 'all',
  mapStyle,
  mapProjection,
  searchLocationQuery,
  cameraPreset,
  selectedFireFeature,
  onInspectFire,
  onInspectFlight,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const geoJsonRef = useRef(geoJson);
  const quakesGeoJsonRef = useRef(quakesGeoJson);
  const flightsGeoJsonRef = useRef(flightsGeoJson);
  const layerModeRef = useRef(layerMode);

  geoJsonRef.current = geoJson;
  quakesGeoJsonRef.current = quakesGeoJson;
  flightsGeoJsonRef.current = flightsGeoJson;
  layerModeRef.current = layerMode;

  const flightStateRef = useRef<Map<string, {
    startLon: number;
    startLat: number;
    heading: number;
    velocityKmh: number;
    updateTime: number;
    feature: any;
  }>>(new globalThis.Map());

  // Synchronize flight dataset into dead-reckoning animation state (Zero-Rollback Smooth Transition)
  useEffect(() => {
    if (!flightsGeoJson || !flightsGeoJson.features) return;
    const now = Date.now();
    const oldMap = flightStateRef.current;
    const newMap = new globalThis.Map();

    for (const f of flightsGeoJson.features) {
      const icao = f.properties?.icao24 || Math.random().toString();
      const coords = f.geometry.coordinates;
      const speed = f.properties?.velocity_kmh || 500;
      const heading = f.properties?.heading || 0;

      const existing = oldMap.get(icao);

      if (existing) {
        // Compute exact current position on screen to anchor new trajectory seamlessly with ZERO rollback
        const elapsedSec = Math.min((now - existing.updateTime) / 1000, 25);
        const distKm = (existing.velocityKmh / 3600) * elapsedSec;
        const headingRad = (existing.heading * Math.PI) / 180;

        const dLat = (distKm * Math.cos(headingRad)) / 111.12;
        const cosLat = Math.cos((existing.startLat * Math.PI) / 180);
        const dLon = (distKm * Math.sin(headingRad)) / (111.12 * (Math.abs(cosLat) < 0.01 ? 1 : cosLat));

        const curLon = existing.startLon + dLon;
        const curLat = existing.startLat + dLat;

        newMap.set(icao, {
          startLon: curLon,
          startLat: curLat,
          heading,
          velocityKmh: speed,
          updateTime: now,
          feature: f
        });
      } else {
        newMap.set(icao, {
          startLon: coords[0],
          startLat: coords[1],
          heading,
          velocityKmh: speed,
          updateTime: now,
          feature: f
        });
      }
    }

    flightStateRef.current = newMap;
  }, [flightsGeoJson]);

  // 60 FPS Continuous Smooth Flight Animation Engine (Dead-Reckoning Physics)
  useEffect(() => {
    let animFrameId: number;

    const animateFlights = () => {
      const map = mapRef.current;
      if (map && isMapStyleReady(map)) {
        const flightSrc = map.getSource('flights-source') as mapboxgl.GeoJSONSource;
        if (flightSrc && flightStateRef.current.size > 0) {
          const now = Date.now();
          const animatedFeatures: any[] = [];

          // Get visible screen bounds to ONLY animate planes in viewport (+ margin)
          let bounds: mapboxgl.LngLatBounds | null = null;
          try {
            bounds = map.getBounds();
          } catch (e) {}

          for (const state of flightStateRef.current.values()) {
            const elapsedSec = (now - state.updateTime) / 1000;
            const clampedSec = Math.min(elapsedSec, 25);

            // Viewport culling: skip heavy math for planes far off-screen
            if (bounds) {
              const west = bounds.getWest() - 5;
              const east = bounds.getEast() + 5;
              const south = bounds.getSouth() - 5;
              const north = bounds.getNorth() + 5;

              if (state.startLon < west || state.startLon > east || state.startLat < south || state.startLat > north) {
                animatedFeatures.push(state.feature);
                continue;
              }
            }

            // Distance in km = (speed in km/h / 3600) * seconds
            const distKm = (state.velocityKmh / 3600) * clampedSec;
            const headingRad = (state.heading * Math.PI) / 180;

            // Dead reckoning GPS coordinates calculation
            const dLat = (distKm * Math.cos(headingRad)) / 111.12;
            const cosLat = Math.cos((state.startLat * Math.PI) / 180);
            const dLon = (distKm * Math.sin(headingRad)) / (111.12 * (Math.abs(cosLat) < 0.01 ? 1 : cosLat));

            animatedFeatures.push({
              ...state.feature,
              geometry: {
                type: 'Point',
                coordinates: [state.startLon + dLon, state.startLat + dLat]
              }
            });
          }

          try {
            flightSrc.setData({
              type: 'FeatureCollection',
              features: animatedFeatures
            } as any);
          } catch (e) {}
        }
      }

      animFrameId = requestAnimationFrame(animateFlights);
    };

    animFrameId = requestAnimationFrame(animateFlights);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  const lastFireDataRef = useRef<any>(null);
  const lastQuakeDataRef = useRef<any>(null);

  const pushData = () => {
    const map = mapRef.current;
    if (!map) return;

    if (!isMapStyleReady(map)) {
      map.once('idle', pushData);
      map.once('style.load', pushData);
      return;
    }

    ensureAirplaneImage(map);
    setupLayers(map);

    try {
      const firesData = geoJsonRef.current || { type: 'FeatureCollection', features: [] };
      const quakesData = quakesGeoJsonRef.current || { type: 'FeatureCollection', features: [] };

      const fireSrc = map.getSource('fires-source') as mapboxgl.GeoJSONSource;
      if (fireSrc && lastFireDataRef.current !== firesData) {
        lastFireDataRef.current = firesData;
        fireSrc.setData(firesData as any);
      }

      const quakeSrc = map.getSource('earthquakes-source') as mapboxgl.GeoJSONSource;
      if (quakeSrc && lastQuakeDataRef.current !== quakesData) {
        lastQuakeDataRef.current = quakesData;
        quakeSrc.setData(quakesData as any);
      }
    } catch (err) {
      console.warn('⚠️ [Map.tsx pushData Error]:', err);
    }

    applyLayerVisibility(map, layerModeRef.current);
  };

  // Setup Atmosphere Fog
  const configureAtmosphereAndTerrain = (map: mapboxgl.Map) => {
    if (!map || !isMapStyleReady(map)) return;
    try {
      map.setFog({
        color: 'rgb(15, 23, 42)',
        'high-color': 'rgb(2, 6, 23)',
        'space-color': 'rgb(2, 6, 23)',
        'star-intensity': 0.7,
      });
    } catch (e) {}
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Suppress browser Cache API tile registration errors (Cache.put network error)
    try {
      if ((mapboxgl as any).config) {
        (mapboxgl as any).config.REGISTER_SERVICE_WORKER = false;
      }
    } catch (e) {}

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: STYLE_URLS[mapStyle],
      center: [15, 22],
      zoom: 2.2,
      projection: mapProjection as any,
      attributionControl: false,
    });

    mapRef.current = map;

    try {
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-left');
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-left');
      map.addControl(new mapboxgl.FullscreenControl(), 'bottom-left');
      map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    } catch (err) {}

    map.on('styleimagemissing', (e) => {
      if (e.id === 'airplane-icon') {
        ensureAirplaneImage(map);
      }
    });

    map.on('styledata', () => {
      ensureAirplaneImage(map);
      applyLayerVisibility(map, layerModeRef.current);
    });

    const handleStyleLoad = () => {
      ensureAirplaneImage(map);
      configureAtmosphereAndTerrain(map);
      pushData();
      applyLayerVisibility(map, layerModeRef.current);
    };

    map.on('style.load', handleStyleLoad);
    map.on('load', handleStyleLoad);
    map.on('idle', pushData);

    // Custom window zoom & rotation event listeners for ultra-smooth navigation
    const onZoomIn = () => mapRef.current?.zoomIn({ duration: 400 });
    const onZoomOut = () => mapRef.current?.zoomOut({ duration: 400 });
    const onResetNorth = () => mapRef.current?.easeTo({ bearing: 0, pitch: 35, duration: 800 });

    window.addEventListener('map-zoom-in', onZoomIn);
    window.addEventListener('map-zoom-out', onZoomOut);
    window.addEventListener('map-reset-north', onResetNorth);

    return () => {
      window.removeEventListener('map-zoom-in', onZoomIn);
      window.removeEventListener('map-zoom-out', onZoomOut);
      window.removeEventListener('map-reset-north', onResetNorth);
      if (popupRef.current) popupRef.current.remove();
      try {
        map.remove();
      } catch (err) {}
      mapRef.current = null;
    };
  }, []);

  const applyLayerVisibility = (map: mapboxgl.Map, mode: LayerModeKey) => {
    if (!map) return;

    const fireLayers = ['fires-heatmap', 'fires-clusters', 'fires-cluster-count', 'fires-unclustered-point'];
    const quakeLayers = ['earthquakes-point'];
    const flightLayers = ['flights-point'];

    const showFires = mode === 'all' || mode === 'fires';
    const showQuakes = mode === 'all' || mode === 'earthquakes';
    const showFlights = mode === 'all' || mode === 'flights';

    fireLayers.forEach((id) => {
      try {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showFires ? 'visible' : 'none');
      } catch (e) {}
    });
    quakeLayers.forEach((id) => {
      try {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showQuakes ? 'visible' : 'none');
      } catch (e) {}
    });
    flightLayers.forEach((id) => {
      try {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showFlights ? 'visible' : 'none');
      } catch (e) {}
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyLayerVisibility(map, layerMode);
  }, [layerMode]);

  // Update Projection instantly (0ms delay)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setProjection({ name: mapProjection as any });
    } catch (e) {
      try {
        map.setProjection(mapProjection as any);
      } catch (err) {}
    }
  }, [mapProjection]);

  // Update Style safely
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const newStyle = STYLE_URLS[mapStyle];
      map.setStyle(newStyle);

      const onStyleLoaded = () => {
        if (!isMapStyleReady(map)) return;
        ensureAirplaneImage(map);
        configureAtmosphereAndTerrain(map);
        try {
          map.setProjection(mapProjection as any);
        } catch (e) {}
        pushData();
      };

      map.once('style.load', onStyleLoaded);
    } catch (err) {}
  }, [mapStyle]);

  // Update Fire Source
  useEffect(() => {
    pushData();
  }, [geoJson]);

  // Update Earthquakes Source
  useEffect(() => {
    pushData();
  }, [quakesGeoJson]);

  // Update Flights Source
  useEffect(() => {
    pushData();
  }, [flightsGeoJson]);

  // Camera Fly to Preset
  useEffect(() => {
    if (!cameraPreset || !mapRef.current) return;
    try {
      mapRef.current.flyTo({
        center: cameraPreset.center,
        zoom: cameraPreset.zoom,
        pitch: cameraPreset.pitch || 0,
        bearing: cameraPreset.bearing || 0,
        duration: 1800,
        essential: true,
      });
    } catch (err) {}
  }, [cameraPreset]);

  // Fly to Selected Fire Feature
  useEffect(() => {
    if (!selectedFireFeature || !mapRef.current) return;
    try {
      const coords = selectedFireFeature.geometry.coordinates;
      mapRef.current.flyTo({
        center: coords,
        zoom: 10,
        pitch: 45,
        duration: 2000,
        essential: true,
      });
      showPopup(mapRef.current, coords, selectedFireFeature.properties, selectedFireFeature);
    } catch (err) {}
  }, [selectedFireFeature]);

  // Handle Geocoding Search Query via 24-Hour Shared Server Cache
  useEffect(() => {
    if (!searchLocationQuery || !mapRef.current) return;

    fetch(`/api/geocode?q=${encodeURIComponent(searchLocationQuery)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.center && mapRef.current) {
          const [lon, lat] = data.center;
          mapRef.current.flyTo({
            center: [lon, lat],
            zoom: 7,
            duration: 2500,
            essential: true,
          });
        }
      })
      .catch((err) => console.error('Geocoding error:', err));
  }, [searchLocationQuery]);

  const showPopup = (map: mapboxgl.Map, coords: [number, number], props: FireProperties, feature: FireFeature) => {
    if (!map || !isMapStyleReady(map)) return;
    if (popupRef.current) popupRef.current.remove();

    const localTime = new Date(props.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const popupHTML = `
      <div style="font-family: system-ui, sans-serif; color: #f8fafc; padding: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 13px; color: #ff5500; display: flex; align-items: center; gap: 4px;">
            🔥 FOYER INCENDIE
          </span>
          <span style="font-family: monospace; font-weight: 700; font-size: 12px; color: #fbbf24; background: rgba(251,191,36,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.3);">
            ${props.frp} MW
          </span>
        </div>
        
        <div style="font-size: 11px; line-height: 1.5; color: #cbd5e1;">
          <div><strong style="color: #94a3b8;">Lieu :</strong> ${escapeHtml(props.locationName) || 'Anomalie thermiques'}</div>
          <div><strong style="color: #94a3b8;">Capteur :</strong> ${escapeHtml(props.satellite)}</div>
          <div><strong style="color: #94a3b8;">Détecté le :</strong> ${escapeHtml(localTime)}</div>
          <div><strong style="color: #94a3b8;">Confiance :</strong> ${props.confidence === 'h' ? 'Haute 🔴' : 'Normale 🟠'}</div>
        </div>
      </div>
    `;

    try {
      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(coords)
        .setHTML(popupHTML)
        .addTo(map);

      popupRef.current = popup;
    } catch (err) {}
  };

  const setupLayers = (map: mapboxgl.Map) => {
    if (!map || !isMapStyleReady(map)) return;

    ensureAirplaneImage(map);

    const mode = layerModeRef.current;
    const showFires = mode === 'all' || mode === 'fires';
    const showQuakes = mode === 'all' || mode === 'earthquakes';
    const showFlights = mode === 'all' || mode === 'flights';

    const currentFires = geoJsonRef.current || { type: 'FeatureCollection', features: [] };
    const currentQuakes = quakesGeoJsonRef.current || { type: 'FeatureCollection', features: [] };
    const currentFlights = flightsGeoJsonRef.current || { type: 'FeatureCollection', features: [] };

    try {
      // 1. Fires Source & Circle Layers
      if (!map.getSource('fires-source')) {
        map.addSource('fires-source', {
          type: 'geojson',
          data: currentFires as any,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 40,
        });

        map.addLayer({
          id: 'fires-heatmap',
          type: 'heatmap',
          source: 'fires-source',
          layout: {
            visibility: showFires ? 'visible' : 'none',
          },
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'frp'], 0], 0, 0.1, 20, 0.5, 100, 1.0],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3.5],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.15, 'rgba(254, 240, 138, 0.65)',
              0.35, 'rgba(251, 146, 60, 0.85)',
              0.65, 'rgba(239, 68, 68, 0.95)',
              0.9, 'rgba(185, 28, 28, 0.98)',
              1.0, 'rgba(255, 255, 255, 1)',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 5, 16, 9, 26],
            'heatmap-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'fires-clusters',
          type: 'circle',
          source: 'fires-source',
          filter: ['has', 'point_count'],
          layout: {
            visibility: showFires ? 'visible' : 'none',
          },
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#ff5500', 30, '#ef4444', 100, '#b91c1c', 500, '#881337'],
            'circle-radius': ['step', ['get', 'point_count'], 14, 30, 20, 100, 26, 500, 34],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fef08a',
            'circle-opacity': 0.95,
          },
        });

        map.addLayer({
          id: 'fires-cluster-count',
          type: 'symbol',
          source: 'fires-source',
          filter: ['has', 'point_count'],
          layout: {
            visibility: showFires ? 'visible' : 'none',
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'fires-unclustered-point',
          type: 'circle',
          source: 'fires-source',
          filter: ['!', ['has', 'point_count']],
          layout: {
            visibility: showFires ? 'visible' : 'none',
          },
          paint: {
            'circle-color': '#ff3300',
            'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'frp'], 0], 0, 4.5, 20, 7.5, 100, 14, 300, 22],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fbbf24',
            'circle-blur': 0.15,
            'circle-opacity': 0.95,
          },
        });

        map.on('click', 'fires-clusters', (e) => {
          if (!isMapStyleReady(map)) return;
          const features = map.queryRenderedFeatures(e.point, { layers: ['fires-clusters'] });
          if (!features.length) return;
          const feat = features[0] as any;
          const clusterId = feat.properties?.cluster_id;
          const source = map.getSource('fires-source') as mapboxgl.GeoJSONSource;
          if (source) {
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom === null || zoom === undefined) return;
              const coordinates = feat.geometry.coordinates.slice();
              map.easeTo({ center: coordinates, zoom: zoom + 1, duration: 1000 });
            });
          }
        });

        map.on('click', 'fires-unclustered-point', (e) => {
          if (!isMapStyleReady(map)) return;
          if (!e.features || !e.features.length) return;
          const feature = e.features[0] as unknown as FireFeature;
          const coords = (feature.geometry as any).coordinates.slice();
          onInspectFire(feature);
          showPopup(map, coords, feature.properties, feature);
        });

        map.on('mouseenter', 'fires-clusters', () => {
          try {
            if (isMapStyleReady(map)) map.getCanvas().style.cursor = 'pointer';
          } catch (err) {}
        });
        map.on('mouseleave', 'fires-clusters', () => {
          try {
            if (map.getCanvas()) map.getCanvas().style.cursor = '';
          } catch (err) {}
        });
        map.on('mouseenter', 'fires-unclustered-point', () => {
          try {
            if (isMapStyleReady(map)) map.getCanvas().style.cursor = 'pointer';
          } catch (err) {}
        });
        map.on('mouseleave', 'fires-unclustered-point', () => {
          try {
            if (map.getCanvas()) map.getCanvas().style.cursor = '';
          } catch (err) {}
        });
      }

      // 2. USGS Earthquakes Source & Circle Layer
      if (!map.getSource('earthquakes-source')) {
        map.addSource('earthquakes-source', {
          type: 'geojson',
          data: currentQuakes as any,
        });

        map.addLayer({
          id: 'earthquakes-point',
          type: 'circle',
          source: 'earthquakes-source',
          layout: {
            visibility: showQuakes ? 'visible' : 'none',
          },
          paint: {
            'circle-color': ['step', ['coalesce', ['get', 'mag'], 0], '#06b6d4', 4.5, '#f59e0b', 6.0, '#ec4899', 7.0, '#ef4444'],
            'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0], 2.5, 6, 5.0, 12, 7.0, 20, 8.5, 32],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
        });

        map.on('click', 'earthquakes-point', (e) => {
          if (!isMapStyleReady(map)) return;
          if (!e.features || !e.features.length) return;
          const feature = e.features[0] as any;
          const coords = feature.geometry.coordinates.slice();
          const props = feature.properties || {};
          const dateStr = new Date(props.time).toUTCString();

          const popupHTML = `
            <div style="font-family: system-ui, sans-serif; color: #f8fafc; font-size: 12px; padding: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 13px; color: #38bdf8; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                <span>🌋 SÉISME USGS</span>
                <span style="background: rgba(56,189,248,0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace;">M ${escapeHtml(props.mag)}</span>
              </div>
              <div style="font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                ${escapeHtml(props.title || props.place)}
              </div>
              <div style="font-size: 10px; color: #94a3b8; font-family: monospace; space-y: 2px;">
                <div>📅 ${escapeHtml(dateStr)}</div>
                <div>🌊 Alerte Tsunami: ${props.tsunami ? 'OUI ⚠️' : 'Non'}</div>
              </div>
            </div>
          `;

          try {
            new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(coords)
              .setHTML(popupHTML)
              .addTo(map);
          } catch (err) {}
        });

        map.on('mouseenter', 'earthquakes-point', () => {
          try {
            if (isMapStyleReady(map)) map.getCanvas().style.cursor = 'pointer';
          } catch (err) {}
        });
        map.on('mouseleave', 'earthquakes-point', () => {
          try {
            if (map.getCanvas()) map.getCanvas().style.cursor = '';
          } catch (err) {}
        });
      }

      // 3. OpenSky REST API Flights Source & Symbol Layer
      if (!map.getSource('flights-source')) {
        map.addSource('flights-source', {
          type: 'geojson',
          data: currentFlights as any,
        });

        ensureAirplaneImage(map);

          // Invisible enlarged hit-target layer to make clicking airplanes 100% easy at ANY zoom level
          if (!map.getLayer('flights-hit-target')) {
            map.addLayer({
              id: 'flights-hit-target',
              type: 'circle',
              source: 'flights-source',
              layout: {
                visibility: showFlights ? 'visible' : 'none',
              },
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 18, 5, 22, 10, 28],
                'circle-color': '#000000',
                'circle-opacity': 0,
              },
            });
          }

          map.addLayer({
            id: 'flights-point',
            type: 'symbol',
            source: 'flights-source',
            layout: {
              visibility: showFlights ? 'visible' : 'none',
              'icon-image': [
                'match',
                ['coalesce', ['get', 'category'], 'commercial'],
                'military', 'airplane-icon-military',
                'private', 'airplane-icon-private',
                'emergency', 'airplane-icon-emergency',
                'airplane-icon-commercial'
              ],
              'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 5, 0.8, 10, 1.1],
              'icon-rotate': ['coalesce', ['get', 'heading'], 0],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
          });

          const handleFlightClick = (e: mapboxgl.MapMouseEvent): boolean => {
            if (!isMapStyleReady(map)) return false;
            
            // 32x32px bounding box query around click point for instant capture even when zoomed out
            const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
              [e.point.x - 16, e.point.y - 16],
              [e.point.x + 16, e.point.y + 16]
            ];

            const layersToQuery = [];
            if (map.getLayer('flights-point')) layersToQuery.push('flights-point');
            if (map.getLayer('flights-hit-target')) layersToQuery.push('flights-hit-target');

            if (!layersToQuery.length) return false;

            const features = map.queryRenderedFeatures(bbox, { layers: layersToQuery });

            if (features && features.length > 0) {
              const feat = features[0];
              const props = (feat as any).properties || {};
              const icao = props.icao24;

              // Match full FlightFeature from flightStateRef by icao24
              let targetFeature: FlightFeature | null = null;
              if (icao && flightStateRef.current.has(icao)) {
                targetFeature = flightStateRef.current.get(icao)?.feature || null;
              }

              if (!targetFeature) {
                targetFeature = feat as unknown as FlightFeature;
              }

              if (onInspectFlight && targetFeature) {
                onInspectFlight(targetFeature);
                if (e.originalEvent) {
                  e.originalEvent.preventDefault();
                }
                return true;
              }
            }
            return false;
          };

          map.on('click', handleFlightClick);
          map.on('contextmenu', (e) => {
            const isPlane = handleFlightClick(e);
            if (isPlane && e.originalEvent) {
              e.originalEvent.preventDefault();
            }
          });

          const handleFlightEnter = () => {
            try {
              if (isMapStyleReady(map)) map.getCanvas().style.cursor = 'pointer';
            } catch (err) {}
          };
          const handleFlightLeave = () => {
            try {
              if (map.getCanvas()) map.getCanvas().style.cursor = '';
            } catch (err) {}
          };

          map.on('mouseenter', 'flights-point', handleFlightEnter);
          map.on('mouseenter', 'flights-hit-target', handleFlightEnter);
          map.on('mouseleave', 'flights-point', handleFlightLeave);
          map.on('mouseleave', 'flights-hit-target', handleFlightLeave);
        }
    } catch (err) {}
  };

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
};
