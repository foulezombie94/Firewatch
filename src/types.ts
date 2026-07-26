export interface FireProperties {
  id: string;
  acq_date: string;
  acq_time: string;
  timestamp: number;
  confidence: 'h' | 'n' | 'l';
  frp: number;
  satellite: string;
  bright_ti4: number;
  daynight: string;
  source: string;
  locationName?: string;
  country?: string;
  region?: string;
}

export interface FireFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: FireProperties;
}

export interface FireGeoJSON {
  type: 'FeatureCollection';
  metadata: {
    last_updated: string;
    next_update_in_seconds: number;
    total_in_cache: number;
    filtered_count: number;
    filters: {
      hours: number;
      minFrp: number;
      sensor: string;
    };
  };
  features: FireFeature[];
}

export interface EarthquakeProperties {
  mag: number;
  place: string;
  time: number;
  updated: number;
  url: string;
  detail: string;
  tsunami: number;
  sig: number;
  net: string;
  code: string;
  magType: string;
  title: string;
}

export interface EarthquakeFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lon, lat, depth_km]
  };
  properties: EarthquakeProperties;
}

export interface EarthquakeGeoJSON {
  type: 'FeatureCollection';
  metadata: {
    generated: number;
    title: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

export interface FlightProperties {
  icao24: string;
  callsign: string;
  origin_country: string;
  altitude_m: number;
  altitude_ft: number;
  velocity_kmh: number;
  heading: number;
  vertical_rate: number;
  on_ground: boolean;
  squawk: string;
  dep_iata?: string;
  dep_name?: string;
  dep_city?: string;
  dep_country?: string;
  arr_iata?: string;
  arr_name?: string;
  arr_city?: string;
  arr_country?: string;
}

export interface FlightFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lon, lat, altitude_m]
  };
  properties: FlightProperties;
}

export interface FlightGeoJSON {
  type: 'FeatureCollection';
  metadata: {
    generated_at: string;
    count: number;
  };
  features: FlightFeature[];
}

export type MapStyleKey = 'dark' | 'satellite' | 'outdoors';
export type MapProjectionKey = 'globe' | 'mercator' | 'winkelTripel';
export type LayerModeKey = 'all' | 'fires' | 'earthquakes' | 'flights';

export interface FilterState {
  hours: number; // 6, 12, 24, 48
  minFrp: number; // 0..150
  sensor: 'all' | 'viirs' | 'modis';
  confidence: 'all' | 'high';
  layerMode: LayerModeKey;
}

export interface CameraPreset {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}
