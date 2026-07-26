import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { FireGeoJSON, EarthquakeGeoJSON, FlightGeoJSON, MapStyleKey, MapProjectionKey, LayerModeKey, FireProperties, FireFeature, FlightFeature, CameraPreset } from '../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

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

const STYLE_URLS: Record<MapStyleKey, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

// Synchronously generate high-resolution category-colored airplane vector icons for Mapbox
const createAirplaneImageData = (fillColor: string = '#38bdf8', glowColor: string = '#0284c7'): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 48, 48);

  ctx.save();
  ctx.translate(24, 24);
  
  // Neon glow background
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  const path = new Path2D('M 0 -18 L 4 -4 L 18 2 L 18 6 L 4 2 L 2 14 L 6 18 L 6 21 L 0 19 L -6 21 L -6 18 L -2 14 L -4 2 L -18 6 L -18 2 L -4 -4 Z');
  ctx.fill(path);
  ctx.stroke(path);

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
      { id: 'airplane-icon', fill: '#38bdf8', glow: '#0284c7' },           // Default Cyan
      { id: 'airplane-icon-commercial', fill: '#38bdf8', glow: '#0284c7' },// Cyan Blue ✈️
      { id: 'airplane-icon-military', fill: '#ef4444', glow: '#dc2626' },  // Neon Red 🎖️
      { id: 'airplane-icon-private', fill: '#c084fc', glow: '#a855f7' },   // Purple 🛩️
      { id: 'airplane-icon-emergency', fill: '#fbbf24', glow: '#f59e0b' }  // Amber Orange 🚁
    ];

    for (const ico of icons) {
      if (!map.hasImage(ico.id)) {
        const imgData = createAirplaneImageData(ico.fill, ico.glow);
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

  // Synchronize flight dataset into dead-reckoning animation state
  useEffect(() => {
    if (!flightsGeoJson || !flightsGeoJson.features) return;
    const now = Date.now();
    const newMap = new globalThis.Map();

    for (const f of flightsGeoJson.features) {
      const icao = f.properties?.icao24 || Math.random().toString();
      const coords = f.geometry.coordinates;
      const speed = f.properties?.velocity_kmh || 500;
      const heading = f.properties?.heading || 0;

      newMap.set(icao, {
        startLon: coords[0],
        startLat: coords[1],
        heading,
        velocityKmh: speed,
        updateTime: now,
        feature: f
      });
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

          for (const state of flightStateRef.current.values()) {
            const elapsedSec = (now - state.updateTime) / 1000;
            // Cap extrapolation to max 25 seconds to prevent overshooting
            const clampedSec = Math.min(elapsedSec, 25);

            // Distance in km = (speed in km/h / 3600) * seconds
            const distKm = (state.velocityKmh / 3600) * clampedSec;
            const headingRad = (state.heading * Math.PI) / 180;

            // Dead reckoning GPS coordinates calculation
            const dLat = (distKm * Math.cos(headingRad)) / 111.12;
            const cosLat = Math.cos((state.startLat * Math.PI) / 180);
            const dLon = (distKm * Math.sin(headingRad)) / (111.12 * (Math.abs(cosLat) < 0.01 ? 1 : cosLat));

            const curLon = state.startLon + dLon;
            const curLat = state.startLat + dLat;

            animatedFeatures.push({
              ...state.feature,
              geometry: {
                type: 'Point',
                coordinates: [curLon, curLat]
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
      if (fireSrc) fireSrc.setData(firesData as any);

      const quakeSrc = map.getSource('earthquakes-source') as mapboxgl.GeoJSONSource;
      if (quakeSrc) quakeSrc.setData(quakesData as any);
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
          <div><strong style="color: #94a3b8;">Lieu :</strong> ${props.locationName || 'Anomalie thermiques'}</div>
          <div><strong style="color: #94a3b8;">Capteur :</strong> ${props.satellite}</div>
          <div><strong style="color: #94a3b8;">Détecté le :</strong> ${localTime}</div>
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
                <span style="background: rgba(56,189,248,0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace;">M ${props.mag}</span>
              </div>
              <div style="font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                ${props.title || props.place}
              </div>
              <div style="font-size: 10px; color: #94a3b8; font-family: monospace; space-y: 2px;">
                <div>📅 ${dateStr}</div>
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

        if (map.hasImage('airplane-icon')) {
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
              'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 0.7, 10, 1.0],
              'icon-rotate': ['coalesce', ['get', 'heading'], 0],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
          });

          map.on('click', 'flights-point', (e) => {
            if (!isMapStyleReady(map)) return;
            if (!e.features || !e.features.length) return;
            const feature = e.features[0] as unknown as FlightFeature;
            if (onInspectFlight) {
              onInspectFlight(feature);
            }
          });

          map.on('mouseenter', 'flights-point', () => {
            try {
              if (isMapStyleReady(map)) map.getCanvas().style.cursor = 'pointer';
            } catch (err) {}
          });
          map.on('mouseleave', 'flights-point', () => {
            try {
              if (map.getCanvas()) map.getCanvas().style.cursor = '';
            } catch (err) {}
          });
        }
      }
    } catch (err) {}
  };

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
};
