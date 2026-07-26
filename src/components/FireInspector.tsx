import React, { useState, useEffect } from 'react';
import { 
  X, 
  Flame, 
  Satellite, 
  Zap, 
  Clock, 
  MapPin, 
  Copy, 
  Check, 
  Thermometer, 
  ShieldCheck, 
  Compass, 
  Wind,
  Globe,
  AlertOctagon,
  Share2
} from 'lucide-react';
import { FireProperties } from '../types';
import { getReverseGeocode } from '../utils/geocoding';

interface FireInspectorProps {
  fireProps: FireProperties | null;
  coordinates: [number, number] | null;
  onClose: () => void;
  onFlyToFire: (coords: [number, number]) => void;
}

export const FireInspector: React.FC<FireInspectorProps> = ({
  fireProps,
  coordinates,
  onClose,
  onFlyToFire,
}) => {
  const [copied, setCopied] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    if (!coordinates) return;
    let isMounted = true;
    getReverseGeocode(coordinates[0], coordinates[1]).then((res) => {
      if (isMounted) {
        setLocationName(res.fullLocation);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [coordinates]);

  if (!fireProps || !coordinates) return null;

  const handleCopyCoords = () => {
    const text = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const localTimeStr = new Date(fireProps.timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const kelvinToCelsius = (k: number) => (k ? (k - 273.15).toFixed(1) : '--');
  const co2EstTonnes = (fireProps.frp * 0.15).toFixed(1);

  const frpRating = 
    fireProps.frp > 500
      ? { label: 'Danger Extrême (> 500 MW)', color: 'bg-red-500/20 text-red-300 border-red-500/40' }
      : fireProps.frp > 100
      ? { label: 'Intensité Majeure (100-500 MW)', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' }
      : { label: 'Foyer Modéré (< 100 MW)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };

  const confidenceBadge =
    fireProps.confidence === 'h'
      ? { text: 'Confiance Élevée', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
      : fireProps.confidence === 'l'
      ? { text: 'Faible Confiance', color: 'bg-[#14171d] text-slate-400 border-[#21252d]' }
      : { text: 'Confiance Nominale', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };

  return (
    <aside className="fixed top-20 right-4 z-40 w-80 sm:w-96 bg-[#0e1014]/95 backdrop-blur-2xl text-slate-100 rounded-2xl p-4 border border-[#21252d] shadow-2xl animate-in slide-in-from-right-3 duration-200 pointer-events-auto font-sans">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#21252d]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#ff5500] text-white shadow-md shadow-orange-500/30">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5 leading-snug">
              <Globe className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
              <span>{locationName || 'Localisation en cours...'}</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
              <Satellite className="w-3.5 h-3.5 text-cyan-400" />
              Capteur {fireProps.satellite}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl bg-[#14171d] hover:bg-[#1a1e27] text-slate-400 hover:text-white transition-colors border border-[#21252d] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3.5 space-y-3 text-xs">
        {/* Hazard Rating Pill */}
        <div className={`p-2.5 rounded-xl border text-center font-bold text-xs ${frpRating.color} flex items-center justify-center gap-2 shadow-inner`}>
          <AlertOctagon className="w-4 h-4" />
          <span>{frpRating.label}</span>
        </div>

        {/* FRP Thermal Power Gauge */}
        <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Zap className="w-4 h-4 text-[#ff5500]" /> Puissance Radiative (FRP)
            </span>
            <span className="font-mono font-bold text-base text-amber-400">{fireProps.frp} MW</span>
          </div>
          <div className="h-2 w-full bg-[#0e1014] rounded-full overflow-hidden border border-[#21252d]">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 via-[#ff5500] to-red-600 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, (fireProps.frp / 500) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>0 MW</span>
            <span>250 MW</span>
            <span>500+ MW</span>
          </div>
        </div>

        {/* Temperature & CO2 Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#14171d] border border-[#21252d]">
            <div className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-[#ff5500]" /> Temp. Brillance
            </div>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {kelvinToCelsius(fireProps.bright_ti4)} <span className="text-xs font-normal text-slate-400">°C</span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono">{fireProps.bright_ti4} K</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#14171d] border border-[#21252d]">
            <div className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400" /> Émissions CO₂
            </div>
            <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">
              ~{co2EstTonnes} <span className="text-[10px] font-normal text-slate-400">t/h</span>
            </div>
            <div className="text-[9px] text-slate-400">Copernicus CAMS</div>
          </div>
        </div>

        {/* Time & Satellite Passage */}
        <div className="p-2.5 rounded-xl bg-[#14171d] border border-[#21252d] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Passage Satellite
            </span>
            <span className="font-semibold text-white">{localTimeStr}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#21252d] font-mono">
            <span>Horaire UTC:</span>
            <span>{fireProps.acq_date} à {fireProps.acq_time}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Orbite:</span>
            <span>{fireProps.daynight === 'D' ? 'Passage de Jour ☀️' : 'Passage de Nuit 🌙'}</span>
          </div>
        </div>

        {/* Reliability & Coords */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#14171d] border border-[#21252d]">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Fiabilité Détection
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${confidenceBadge.color}`}>
              {confidenceBadge.text}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#14171d] border border-[#21252d]">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-red-400" /> GPS
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-200">
                {coordinates[1].toFixed(4)}°, {coordinates[0].toFixed(4)}°
              </span>
              <button
                onClick={handleCopyCoords}
                className="p-1 rounded bg-[#0e1014] hover:bg-[#1a1e27] text-slate-300 transition-colors border border-[#21252d] cursor-pointer"
                title="Copier les coordonnées GPS"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onFlyToFire(coordinates)}
          className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#e04b00] text-white font-extrabold flex items-center justify-center gap-2 shadow-md shadow-orange-600/30 transition-all active:scale-95 text-xs cursor-pointer"
        >
          <Compass className="w-4 h-4 text-white animate-pulse" /> Zoomer sur ce Foyer d'Incendie
        </button>
      </div>
    </aside>
  );
};
