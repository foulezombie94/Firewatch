import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Radio, 
  Zap, 
  Search,
  ArrowUpRight,
  Play,
  Pause,
  FileText,
  Clock,
  Timer,
  Heart,
  ShieldCheck
} from 'lucide-react';
import { CameraPreset, FireFeature } from '../types';

interface HeaderProps {
  totalFires: number;
  lastUpdated: string | null;
  nextUpdateInSeconds: number;
  isLoading: boolean;
  maxFrpFire: number;
  topHotspots: FireFeature[];
  onFlyTo: (preset: CameraPreset) => void;
  onSearchLocation: (query: string) => void;
  onSelectFire: (fire: FireFeature) => void;
  isAutoTourActive: boolean;
  onToggleAutoTour: () => void;
  onGenerateReport: () => void;
  onOpenPrivacy?: () => void;
}

// Vector SVG French Flag
const FlagFranceSVG: React.FC = () => (
  <svg className="w-4 h-3 rounded-[2px] shadow-sm shrink-0 border border-slate-700/50" viewBox="0 0 3 2">
    <rect width="1" height="2" x="0" fill="#002654" />
    <rect width="1" height="2" x="1" fill="#FFFFFF" />
    <rect width="1" height="2" x="2" fill="#CE1126" />
  </svg>
);

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'congo_top', name: '🔥 #1 Congo (Lualaba - 3 599 MW)', center: [22.81, -9.23], zoom: 9, pitch: 45 },
  { id: 'france_var', name: 'France (Var & Sud)', center: [6.02, 43.52], zoom: 8, pitch: 45 },
  { id: 'world', name: 'Globe Mondial 3D', center: [15, 20], zoom: 2.2, pitch: 0 },
  { id: 'namerica', name: 'Amérique du Nord', center: [-100, 40], zoom: 3.8, pitch: 35 },
  { id: 'samerica', name: 'Amérique du Sud', center: [-60, -15], zoom: 3.8, pitch: 30 },
  { id: 'europe', name: 'Europe / Méditerranée', center: [15, 45], zoom: 4.2, pitch: 30 },
  { id: 'africa', name: 'Afrique Centrale', center: [20, 2], zoom: 3.8, pitch: 25 },
  { id: 'asia_aus', name: 'Asie & Australie', center: [135, -20], zoom: 3.8, pitch: 30 },
];

export const Header: React.FC<HeaderProps> = ({
  totalFires,
  lastUpdated,
  nextUpdateInSeconds,
  isLoading,
  maxFrpFire,
  topHotspots,
  onFlyTo,
  onSearchLocation,
  onSelectFire,
  isAutoTourActive,
  onToggleAutoTour,
  onGenerateReport,
  onOpenPrivacy,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Live Clock (Local/UTC Time)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchLocation(searchQuery.trim());
    }
  };

  // Format seconds into synchronized Hours and Minutes
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="fixed top-3 left-3 right-3 z-30 pointer-events-none font-sans">
      {/* Top Floating Tactical Command Bar */}
      <div className="max-w-[1700px] mx-auto pointer-events-auto bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl h-14 px-3 sm:px-4 flex items-center justify-between gap-2.5 relative overflow-x-auto no-scrollbar text-slate-100">
        
        {/* Brand Logo & Live Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-[#ff5500] shadow-md shadow-orange-500/20 text-white">
            <Flame className="w-4.5 h-4.5 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-xs sm:text-sm tracking-tight text-white font-sans whitespace-nowrap">
              FIREWATCH <span className="text-[#ff5500] font-mono">REALTIME</span>
            </h1>
          </div>
        </div>

        {/* PROMINENT LIVE CLOCK & SYNC TIMER */}
        <div className="flex items-center gap-2 shrink-0 bg-[#14171d] px-2.5 py-1.5 rounded-xl border border-[#21252d]">
          {/* Real Live Time Clock */}
          <div className="flex items-center gap-1.5 pr-2.5 border-r border-[#21252d]">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-mono font-bold text-xs text-white">
              {currentTimeStr || '20:30:51'}
            </span>
          </div>

          {/* Sync Countdown Timer */}
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[8px] uppercase font-mono font-extrabold text-slate-400 tracking-wider leading-none">Prochaine Sync</span>
              <span className="font-mono font-bold text-[#ff5500] text-xs leading-none mt-0.5">
                {formatTime(nextUpdateInSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Integrated Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-36 lg:w-48 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher ville..."
            className="w-full bg-[#161920] border border-[#242832] focus:border-[#ff5500]/80 rounded-xl py-1.5 pl-8 pr-3 text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </form>

        {/* Dynamic Top #1 Fire Shortcut */}
        {topHotspots.length > 0 && (
          <button
            onClick={() => onSelectFire(topHotspots[0])}
            className="hidden lg:flex items-center gap-1.5 bg-[#1c1815] border border-[#ff5500]/60 hover:border-[#ff5500] rounded-xl px-2.5 py-1 text-xs font-mono shrink-0 transition-all active:scale-95 shadow-md cursor-pointer group whitespace-nowrap"
            title={`Cliquer pour voler directement vers l'incendie #${topHotspots[0]?.properties?.locationName || 'Mondial'}`}
          >
            <span className="text-[#ff5500] font-bold shrink-0 animate-pulse">🔥 #1:</span>
            <span className="text-slate-100 font-semibold group-hover:text-amber-300 transition-colors text-[11px]">
              {topHotspots[0]?.properties?.locationName || 'Incendie Majeur'} <span className="text-amber-400 font-mono">({topHotspots[0]?.properties?.frp || 0} MW)</span>
            </span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-white shrink-0" />
          </button>
        )}

        {/* Action Controls & Donate Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Donate / Soutenir le Site Button */}
          <a
            href="https://ko-fi.com/flzearth"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-xs transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-rose-600/20 border border-rose-400/30 cursor-pointer"
            title="Faire un don pour soutenir le serveur et le site Firewatch"
          >
            <Heart className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
            <span>Soutenir le site</span>
          </a>

          {/* Export Situation Report SITREP Button */}
          <button
            onClick={onGenerateReport}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14171d] hover:bg-[#1a1e27] text-slate-200 border border-[#21252d] text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Générer un Rapport d'Urgence Incendies (SITREP)"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rapport SITREP</span>
          </button>

          {/* Privacy Policy & RGPD Modal Button */}
          {onOpenPrivacy && (
            <button
              onClick={onOpenPrivacy}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14171d] hover:bg-[#1a1e27] text-slate-300 border border-[#21252d] text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Politique de Confidentialité & RGPD"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RGPD</span>
            </button>
          )}

          {/* Quick France Focus Shortcut */}
          <button
            onClick={() => onFlyTo(CAMERA_PRESETS[1])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff5500]/15 hover:bg-[#ff5500]/30 text-[#ff5500] border border-[#ff5500]/40 text-xs font-extrabold transition-all active:scale-95 whitespace-nowrap shadow-sm cursor-pointer"
            title="Centrer la carte sur la France (Var & Sud)"
          >
            <FlagFranceSVG />
            <span className="hidden sm:inline">France (Var)</span>
          </button>

          {/* Active Fires Counter Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14171d] border border-[#21252d] text-xs whitespace-nowrap">
            <Flame className="w-3.5 h-3.5 text-[#ff5500]" />
            <span className="font-mono font-bold text-white">{totalFires.toLocaleString()}</span>
          </div>

          {/* Max FRP Rating */}
          {maxFrpFire > 0 && (
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-mono font-bold text-yellow-300">{maxFrpFire} MW</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
