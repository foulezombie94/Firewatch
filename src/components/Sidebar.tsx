import React, { useState } from 'react';
import { 
  Sliders, 
  Clock, 
  Zap, 
  Map as MapIcon, 
  Search, 
  Globe, 
  Moon,
  Trophy,
  BarChart3,
  ArrowUpRight,
  MapPin,
  Wind,
  Layers,
  X,
  CheckCircle2,
  Gauge,
  Compass,
  Radio,
  Plane,
  Sparkles,
  Flame,
  Activity,
  ChevronDown,
  ChevronRight,
  Bell,
  Settings,
  HelpCircle,
  Target
} from 'lucide-react';
import { FilterState, MapStyleKey, MapProjectionKey, LayerModeKey, FireFeature } from '../types';

interface SidebarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  mapStyle: MapStyleKey;
  onStyleChange: (style: MapStyleKey) => void;
  mapProjection: MapProjectionKey;
  onProjectionChange: (projection: MapProjectionKey) => void;
  onSearchLocation: (query: string) => void;
  filteredCount: number;
  totalCount: number;
  topHotspots: FireFeature[];
  onSelectFire: (fire: FireFeature) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filters,
  onFilterChange,
  mapStyle,
  onStyleChange,
  mapProjection,
  onProjectionChange,
  onSearchLocation,
  filteredCount,
  totalCount,
  topHotspots,
  onSelectFire,
}) => {
  const [activeWidget, setActiveWidget] = useState<'filters' | 'top' | 'analytics' | null>('filters');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLayersExpanded, setIsLayersExpanded] = useState(true);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchLocation(searchQuery.trim());
    }
  };

  const mapStyles = [
    { key: 'dark' as MapStyleKey, name: 'Sombre 3D', icon: Moon },
    { key: 'satellite' as MapStyleKey, name: 'Satellite HD', icon: Globe },
    { key: 'terrain' as MapStyleKey, name: 'Relief Terrain', icon: MapIcon },
  ];

  const timeOptions = [
    { label: '6h', value: 6 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
  ];

  const projections = [
    { key: 'globe' as MapProjectionKey, label: 'Globe 3D' },
    { key: 'mercator' as MapProjectionKey, label: 'Plate 2D' },
    { key: 'naturalEarth' as MapProjectionKey, label: 'NatGeo' },
  ];

  const layerModes = [
    { id: 'all' as LayerModeKey, label: 'Tous les calques', icon: Sparkles, badge: 'Direct' },
    { id: 'fires' as LayerModeKey, label: 'Incendies', icon: Flame, badge: `${filteredCount}` },
    { id: 'earthquakes' as LayerModeKey, label: 'Séismes', icon: Activity, badge: 'Live' },
    { id: 'flights' as LayerModeKey, label: 'Trafic Aérien', icon: Plane, badge: 'ADS-B' },
  ];

  const frpPresets = [0, 20, 50, 100];
  const highestFrpInTop = topHotspots[0]?.properties.frp || 3500;
  const totalCo2Estimate = topHotspots.reduce((sum, f) => sum + (f.properties.frp * 0.15), 0).toFixed(0);

  return (
    <div className="fixed top-1/2 -translate-y-1/2 left-4 z-20 pointer-events-none flex items-start gap-3 font-sans">
      
      {/* Left Dock Rail + Map Controls */}
      <div className="flex flex-col items-center gap-3">
        {/* Tactical Vertical Icon Dock Rail */}
        <div className="pointer-events-auto bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-1.5 flex flex-col gap-1.5 text-slate-300">
          <button
            onClick={() => setActiveWidget(activeWidget === 'filters' ? null : 'filters')}
            className={`p-2.5 rounded-xl transition-all relative group cursor-pointer border ${
              activeWidget === 'filters'
                ? 'bg-[#ff5500] text-white border-orange-400/50 shadow-lg shadow-orange-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#181c24] border-transparent'
            }`}
            title="Filtres & Calques"
          >
            <Sliders className="w-4 h-4" />
            <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#0e1014] border border-[#21252d] text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
              Filtres & Calques
            </span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'top' ? null : 'top')}
            className={`p-2.5 rounded-xl transition-all relative group cursor-pointer border ${
              activeWidget === 'top'
                ? 'bg-[#ff5500] text-white border-orange-400/50 shadow-lg shadow-orange-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#181c24] border-transparent'
            }`}
            title="Top Incendies"
          >
            <Trophy className="w-4 h-4" />
            <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#0e1014] border border-[#21252d] text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
              Top Incendies
            </span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'analytics' ? null : 'analytics')}
            className={`p-2.5 rounded-xl transition-all relative group cursor-pointer border ${
              activeWidget === 'analytics'
                ? 'bg-[#ff5500] text-white border-orange-400/50 shadow-lg shadow-orange-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#181c24] border-transparent'
            }`}
            title="Analytique"
          >
            <Activity className="w-4 h-4" />
            <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#0e1014] border border-[#21252d] text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
              Analytique & CO₂
            </span>
          </button>

          <div className="w-full border-t border-[#21252d] my-0.5" />

          <div className="relative group cursor-pointer p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-[#181c24] transition-all">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ff5500] ring-2 ring-[#0e1014]" />
          </div>

          <div className="relative group cursor-pointer p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-[#181c24] transition-all">
            <Settings className="w-4 h-4" />
          </div>

          <div className="relative group cursor-pointer p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-[#181c24] transition-all">
            <HelpCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Stacked Modular Tactical Cards Panel (Exact Layout from User Screenshot) */}
      {activeWidget && (
        <div className="pointer-events-auto w-84 sm:w-[350px] space-y-2.5 text-slate-100 animate-in fade-in slide-in-from-left-3 duration-200">
          
          {/* WIDGET 1: FILTERS & NAVIGATION TREE */}
          {activeWidget === 'filters' && (
            <>
              {/* Modular Card 1: Search & Layers Dropdown */}
              <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3 space-y-2.5">
                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search location..."
                    className="w-full bg-[#161920] border border-[#242832] focus:border-[#ff5500]/80 rounded-xl py-2 pl-9 pr-9 text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <div className="absolute right-3 top-2 flex items-center">
                    {searchQuery ? (
                      <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-200">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] font-bold text-slate-400 bg-[#1e232d] border border-[#2d3342] px-1.5 py-0.5 rounded">
                        K
                      </span>
                    )}
                  </div>
                </form>

                {/* Header Collapsible Layer Pill */}
                <div 
                  onClick={() => setIsLayersExpanded(!isLayersExpanded)}
                  className="bg-[#1a1715] border border-[#ff5500]/60 text-[#ff5500] font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-[#ff5500] animate-pulse" />
                    <span>Calques & Filtres Carte</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-[#ff5500] bg-[#ff5500]/15 px-1.5 py-0.5 rounded border border-[#ff5500]/30 uppercase">
                      {filters.layerMode}
                    </span>
                    {isLayersExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#ff5500]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#ff5500]" />}
                  </div>
                </div>

                {/* Expanded Layers Tree List */}
                {isLayersExpanded && (
                  <div className="border-l border-[#242832] ml-4 pl-3 space-y-1 pt-1">
                    {layerModes.map((l) => {
                      const isSelected = filters.layerMode === l.id;
                      const IconComp = l.icon;
                      return (
                        <div
                          key={l.id}
                          onClick={() => onFilterChange({ ...filters, layerMode: l.id })}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#1c1815] text-[#ff5500] border border-[#ff5500]/60 font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161920]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-[#ff5500]' : 'text-slate-500'}`} />
                            <span>{l.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-[#ff5500]/20 text-[#ff5500] border border-[#ff5500]/40' : 'bg-[#161920] text-slate-400 border border-[#242832]'
                          }`}>
                            {l.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modular Card 2: MODE DE PROJECTION */}
              <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3 space-y-2">
                <div className="text-[10px] font-mono font-extrabold tracking-widest text-slate-400 uppercase px-0.5">
                  MODE DE PROJECTION
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#14171d] rounded-xl border border-[#21252d]">
                  {projections.map((p) => {
                    const isSelected = mapProjection === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => onProjectionChange(p.key)}
                        className={`py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1e2738] border border-cyan-500/60 text-cyan-400 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modular Card 3: STYLE VISUEL */}
              <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3 space-y-2">
                <div className="text-[10px] font-mono font-extrabold tracking-widest text-slate-400 uppercase px-0.5">
                  STYLE VISUEL
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {mapStyles.map((st) => {
                    const IconComp = st.icon;
                    const isSelected = mapStyle === st.key;
                    return (
                      <button
                        key={st.key}
                        onClick={() => onStyleChange(st.key)}
                        className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1.5 border transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#1c1815] border-[#ff5500]/80 text-[#ff5500] font-extrabold shadow-md shadow-orange-500/10'
                            : 'bg-[#14171d] border-[#21252d] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <IconComp className={`w-4 h-4 ${isSelected ? 'text-[#ff5500]' : 'text-slate-500'}`} />
                        <span className="text-[11px] font-bold tracking-tight">{st.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modular Card 4: PÉRIODE FEUX & SEUIL FRP MINIMUM */}
              <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono font-extrabold tracking-widest text-slate-400 uppercase px-0.5">
                  <span>PÉRIODE FEUX</span>
                  <span className="text-[#ff5500] font-mono bg-[#ff5500]/15 border border-[#ff5500]/30 px-1.5 py-0.5 rounded text-[10px]">
                    {filters.hours}h
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#14171d] rounded-xl border border-[#21252d]">
                  {timeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onFilterChange({ ...filters, hours: opt.value })}
                      className={`py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        filters.hours === opt.value
                          ? 'bg-[#ff5500] text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-[#21252d] my-1" />

                {/* FRP Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#ff5500]" /> Seuil FRP Minimum
                    </span>
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                      {filters.minFrp > 0 ? `>= ${filters.minFrp} MW` : 'Tous (0 MW)'}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="5"
                    value={filters.minFrp}
                    onChange={(e) => onFilterChange({ ...filters, minFrp: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-[#14171d] rounded-lg appearance-none cursor-pointer accent-[#ff5500] border border-[#21252d]"
                  />

                  <div className="flex items-center justify-between gap-1 pt-0.5 font-mono text-[10px]">
                    {frpPresets.map((val) => (
                      <button
                        key={val}
                        onClick={() => onFilterChange({ ...filters, minFrp: val })}
                        className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          filters.minFrp === val
                            ? 'bg-[#ff5500]/20 text-[#ff5500] border border-[#ff5500]/50 shadow-sm'
                            : 'bg-[#14171d] text-slate-400 border border-[#21252d] hover:text-slate-200'
                        }`}
                      >
                        {val === 0 ? 'Tous' : `${val}MW`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* WIDGET 2: TOP HOTSPOTS LEADERBOARD */}
          {activeWidget === 'top' && (
            <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#21252d]">
                <span className="font-mono font-extrabold tracking-widest text-slate-400 uppercase text-[10px]">TOP INCENDIES FRP</span>
                <span className="font-mono text-[10px] font-bold text-[#ff5500] bg-[#ff5500]/15 border border-[#ff5500]/30 px-2 py-0.5 rounded">
                  {topHotspots.length} SITES
                </span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 font-sans">
                {topHotspots.map((spot, idx) => {
                  const rawName = spot.properties.locationName?.trim();
                  const isValidLoc = rawName && rawName !== ',' && rawName !== ', ' && !rawName.startsWith(',') && !rawName.endsWith(',');
                  const locName = isValidLoc ? rawName : `${spot.geometry.coordinates[1].toFixed(2)}°, ${spot.geometry.coordinates[0].toFixed(2)}°`;
                  const percent = Math.min(100, (spot.properties.frp / highestFrpInTop) * 100);

                  return (
                    <div
                      key={spot.properties.id || idx}
                      onClick={() => onSelectFire(spot)}
                      className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] hover:border-[#ff5500]/60 hover:bg-[#1a1e27] transition-all cursor-pointer space-y-2 group shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                            idx === 0 ? 'bg-[#ff5500] text-white font-extrabold' : 'bg-[#21252d] text-slate-300'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white group-hover:text-[#ff5500] transition-colors truncate flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="truncate">{locName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Capteur {spot.properties.satellite}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono font-bold text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          {spot.properties.frp} MW
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#ff5500] transition-colors" />
                        </div>
                      </div>

                      <div className="h-1.5 w-full bg-[#0e1014] rounded-full overflow-hidden border border-[#21252d]">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 via-[#ff5500] to-red-600 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WIDGET 3: ANALYTICS & CO2 */}
          {activeWidget === 'analytics' && (
            <div className="bg-[#0e1014]/95 backdrop-blur-2xl border border-[#21252d] shadow-2xl rounded-2xl p-3.5 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2.5">
                <div className="font-bold text-white flex items-center gap-2 text-xs">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Flux & Télédétection
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2.5 rounded-lg bg-[#0e1014] border border-[#21252d]">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Feux Captés</div>
                    <div className="text-sm font-bold text-[#ff5500] mt-0.5">{totalCount.toLocaleString()}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0e1014] border border-[#21252d]">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">APIs Live</div>
                    <div className="text-sm font-bold text-cyan-400 mt-0.5">3 APIs</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2">
                <div className="font-bold text-white flex items-center gap-2 text-xs">
                  <Wind className="w-4 h-4 text-cyan-400" /> Estimation Carbone CO₂
                </div>
                <div className="p-2.5 rounded-lg bg-[#0e1014] border border-[#21252d] flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Émissions Top Feux</div>
                    <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">
                      ~{totalCo2Estimate} <span className="text-xs font-normal text-slate-400">tonnes/h CO₂</span>
                    </div>
                  </div>
                  <Gauge className="w-5 h-5 text-cyan-400" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white text-xs">Systèmes Opérationnels</div>
                  <div className="text-[10px] text-slate-400 font-mono">Feux Thermiques • Télédétection • Trafic Aérien</div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
