import React from 'react';
import { 
  Plane, 
  Gauge, 
  Compass, 
  MapPin, 
  Radio, 
  Globe, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink, 
  X,
  Wind,
  PlaneTakeoff,
  PlaneLanding,
  ArrowRight
} from 'lucide-react';
import { FlightProperties } from '../types';

interface FlightInspectorProps {
  flightProps: FlightProperties;
  coordinates: [number, number, number];
  onClose: () => void;
  onFlyToFlight: (coords: [number, number]) => void;
}

export const FlightInspector: React.FC<FlightInspectorProps> = ({
  flightProps,
  coordinates,
  onClose,
  onFlyToFlight,
}) => {
  // Early safety guard against missing or malformed props
  if (!flightProps || !coordinates || !Array.isArray(coordinates)) {
    return null;
  }

  const lon = Number(coordinates[0] ?? 0);
  const lat = Number(coordinates[1] ?? 0);
  const rawAltM = Number(coordinates[2] ?? 0);

  // Safe Fallback Numbers
  const altM = Math.round(flightProps.altitude_m ?? rawAltM ?? 0);
  const altFt = Math.round(flightProps.altitude_ft ?? (altM * 3.28084));
  const velocityKmh = Math.round(flightProps.velocity_kmh ?? 0);
  const knots = Math.round(velocityKmh / 1.852);
  const heading = Math.round(flightProps.heading ?? 0);

  // Dynamic ISA (International Standard Atmosphere) Speed of Sound & Mach calculation
  // At Sea Level (0m): ~1225.0 km/h | At Tropopause (11000m+): ~1062.2 km/h
  const tempK = altM >= 11000 ? 216.65 : Math.max(216.65, 288.15 - 0.0065 * altM);
  const speedOfSoundKmh = 3.6 * Math.sqrt(1.4 * 287.05 * tempK);
  const mach = velocityKmh > 0 ? (velocityKmh / speedOfSoundKmh).toFixed(2) : '0.00';

  // Vertical status
  const vertRate = flightProps.vertical_rate || 0;
  let vertStatus = 'Croisière Stable';
  let VertIcon = Minus;
  let vertColor = 'text-emerald-400';

  if (vertRate > 0.5) {
    vertStatus = `Montée (+${vertRate.toFixed(1)} m/s)`;
    VertIcon = TrendingUp;
    vertColor = 'text-cyan-400';
  } else if (vertRate < -0.5) {
    vertStatus = `Descente (${vertRate.toFixed(1)} m/s)`;
    VertIcon = TrendingDown;
    vertColor = 'text-amber-400';
  }

  // Normalized Squawk checking (supports both String and Number types)
  const squawkStr = String(flightProps.squawk ?? '').trim();
  let isEmergency = false;
  let emergencyLabel = 'Normal';
  if (squawkStr === '7700') {
    isEmergency = true;
    emergencyLabel = 'URGENCE GÉNÉRALE ⚠️';
  } else if (squawkStr === '7600') {
    isEmergency = true;
    emergencyLabel = 'PERTE RADIO 📻';
  } else if (squawkStr === '7500') {
    isEmergency = true;
    emergencyLabel = 'DETOURNEMENT 🚨';
  }

  const getCompassDirection = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round((deg || 0) / 22.5) % 16;
    return directions[idx] || 'N';
  };

  const depIata = flightProps.dep_iata || 'DEP';
  const depCity = flightProps.dep_city || flightProps.origin_country || 'Départ';
  const depName = flightProps.dep_name || `Aéroport de Départ (${flightProps.origin_country || 'Intl'})`;
  const depCountry = flightProps.dep_country || '';

  const arrIata = flightProps.arr_iata || 'ARR';
  const arrCity = flightProps.arr_city || 'Arrivée';
  const arrName = flightProps.arr_name || 'En cours de vol';
  const arrCountry = flightProps.arr_country || '';

  const rawColor = flightProps.color || '#38bdf8';
  const badgeColor = typeof rawColor === 'string' && rawColor.startsWith('#') && rawColor.length === 7 ? rawColor : '#38bdf8';

  return (
    <div className="fixed top-20 right-2 sm:right-6 z-30 pointer-events-auto w-88 sm:w-96 max-w-[92vw] animate-in fade-in slide-in-from-right-3 duration-200 font-sans">
      <div className="bg-slate-950/90 backdrop-blur-3xl rounded-3xl border border-slate-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 text-slate-100 space-y-3.5 max-h-[82vh] overflow-y-auto custom-scrollbar min-w-0">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 min-w-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md shadow-emerald-500/20 shrink-0">
              <Plane className="w-5 h-5 rotate-45 text-emerald-400" />
            </div>
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-extrabold text-base text-white font-mono tracking-tight leading-none truncate max-w-[180px]" title={flightProps.callsign || 'VOL SANS INDICATIF'}>
                  {flightProps.callsign || 'VOL SANS INDICATIF'}
                </h3>
                {flightProps.flight_type && (
                  <span 
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono tracking-wider border shadow-sm shrink-0"
                    style={{
                      backgroundColor: `${badgeColor}20`,
                      borderColor: `${badgeColor}50`,
                      color: badgeColor
                    }}
                  >
                    {flightProps.flight_type}
                  </span>
                )}
                {isEmergency && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse shrink-0">
                    {emergencyLabel}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1.5 flex-wrap min-w-0">
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[110px]" title={flightProps.origin_country}>{flightProps.origin_country}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-400 uppercase text-[10px] shrink-0">ICAO: {flightProps.icao24}</span>
                {flightProps.model_type && flightProps.model_type !== 'N/A' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-cyan-300 text-[10px] truncate max-w-[90px]" title={`Modèle: ${flightProps.model_type}`}>Modèle: {flightProps.model_type}</span>
                  </>
                )}
                {flightProps.registration && flightProps.registration !== 'N/A' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-amber-300 text-[10px] truncate max-w-[90px]" title={`Immat: ${flightProps.registration}`}>Immat: {flightProps.registration}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PROMINENT FLIGHT ROUTE CARD (DÉPART ➔ ARRIVÉE) */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 space-y-2 overflow-hidden min-w-0">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1 text-emerald-400 font-bold min-w-0 truncate">
              <Plane className="w-3 h-3 text-emerald-400 shrink-0" /> Plan de Vol & Itinéraire
            </span>
            <span className="font-mono bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300 shrink-0">
              DIRECT
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 min-w-0">
            {/* Departure Airport */}
            <div className="flex-1 min-w-0 space-y-0.5 overflow-hidden">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                <PlaneTakeoff className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> DÉPART
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-cyan-300 tracking-tight truncate" title={depIata}>
                {depIata}
              </div>
              <div className="text-[11px] font-bold text-white truncate" title={depCity}>
                {depCity}
              </div>
              <div className="text-[9.5px] text-slate-300 truncate" title={depName}>
                {depName}
              </div>
              {depCountry && (
                <div className="text-[9px] text-slate-400 font-mono truncate" title={depCountry}>
                  {depCountry}
                </div>
              )}
            </div>

            {/* Flight Direction Arrow */}
            <div className="flex flex-col items-center justify-center shrink-0 px-1">
              <ArrowRight className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-[8px] font-mono text-slate-400 font-bold">VOL</span>
            </div>

            {/* Arrival Airport */}
            <div className="flex-1 min-w-0 space-y-0.5 text-right overflow-hidden">
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-bold uppercase">
                ARRIVÉE <PlaneLanding className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 tracking-tight truncate" title={arrIata}>
                {arrIata}
              </div>
              <div className="text-[11px] font-bold text-white truncate" title={arrCity}>
                {arrCity}
              </div>
              <div className="text-[9.5px] text-slate-300 truncate" title={arrName}>
                {arrName}
              </div>
              {arrCountry && (
                <div className="text-[9px] text-slate-400 font-mono truncate" title={arrCountry}>
                  {arrCountry}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry Grid Widgets */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          {/* Altitude */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-0.5">
            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Wind className="w-3 h-3 text-cyan-400" /> Altitude
            </div>
            <div className="text-sm font-bold text-cyan-300">
              {altM.toLocaleString()} <span className="text-xs font-normal text-slate-400">m</span>
            </div>
            <div className="text-[9px] text-slate-400">
              ({altFt.toLocaleString()} ft)
            </div>
          </div>

          {/* Airspeed */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-0.5">
            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-400" /> Vitesse Sol
            </div>
            <div className="text-sm font-bold text-emerald-300">
              {velocityKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div className="text-[9px] text-slate-400">
              {knots} kts • Mach {mach}
            </div>
          </div>

          {/* Heading / Compass */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-0.5">
            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" /> Cap / Bearing
            </div>
            <div className="text-sm font-bold text-amber-300 flex items-center gap-1">
              {heading}° <span className="text-xs font-bold text-amber-400/80">({getCompassDirection(heading)})</span>
            </div>
            <div className="text-[9px] text-slate-400">
              Orientation Réelle
            </div>
          </div>

          {/* Transponder Squawk */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-0.5">
            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-purple-400" /> Transpondeur
            </div>
            <div className="text-sm font-bold text-purple-300">
              {squawkStr || '1000'}
            </div>
            <div className="text-[9px] text-slate-400">
              Mode-S / ADS-B
            </div>
          </div>
        </div>

        {/* Vertical Status Bar */}
        <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VertIcon className={`w-4 h-4 ${vertColor}`} />
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Profil de Vol</div>
              <div className={`text-xs font-bold ${vertColor}`}>{vertStatus}</div>
            </div>
          </div>
          <div className="text-[10px] font-mono font-bold text-slate-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            {flightProps.on_ground ? 'AU SOL 🛬' : 'EN VOL 🛫'}
          </div>
        </div>

        {/* GPS Location Coordinates */}
        <div className="p-2 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="font-bold">{lat.toFixed(4)}°, {lon.toFixed(4)}°</span>
          </div>
          <span className="text-[10px] text-slate-400">GPS ADS-B</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onFlyToFlight([lon, lat])}
            className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 hover:from-emerald-500 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/30 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Suivre l'Avion</span>
          </button>

          <a
            href={`https://opensky-network.org/aircraft-profile?icao24=${flightProps.icao24}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fiche Avion</span>
          </a>
        </div>
      </div>
    </div>
  );
};
