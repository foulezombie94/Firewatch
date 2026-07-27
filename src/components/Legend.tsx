import React, { useState } from 'react';
import { Flame, Layers, ChevronUp, ChevronDown, Activity, Plane, Radio, Compass, ShieldAlert, Cpu } from 'lucide-react';

export const Legend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'fires' | 'quakes' | 'flights'>('all');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOpen(window.innerWidth >= 768);
    }
  }, []);

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-2 sm:right-6 z-20 md:z-30 pointer-events-auto max-w-[92vw] w-76 sm:w-88 transition-all duration-300 font-sans">
      <div className="bg-[#0e1014]/95 backdrop-blur-2xl rounded-2xl p-4 border border-[#21252d] shadow-2xl text-slate-100 transition-all duration-300">
        
        {/* Top Command Center Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 text-xs font-bold text-white cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center p-2 rounded-xl bg-[#14171d] border border-[#21252d] text-white shadow-sm">
              <Radio className="w-4 h-4 text-[#ff5500] animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <div className="text-left">
              <div className="font-extrabold tracking-tight text-[12px] text-white flex items-center gap-1.5">
                Télédétection Spatiale
              </div>
              <div className="text-[10px] font-mono text-slate-400 font-bold flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" /> 3 FLUX DIRECTS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            {!isOpen && (
              <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] uppercase tracking-wider">
                LIVE DOCK
              </span>
            )}
            <div className="p-1 rounded-xl bg-[#14171d] border border-[#21252d] text-slate-400 group-hover:text-white group-hover:bg-[#1a1e27]">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Expanded Panel */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t border-[#21252d] space-y-3.5 text-[11px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            
            {/* Quick Filter Sub-Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#14171d] border border-[#21252d] font-mono text-[9px]">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#ff5500] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TOUS
              </button>
              <button
                onClick={() => setActiveTab('fires')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'fires'
                    ? 'bg-[#ff5500] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔥 FEUX
              </button>
              <button
                onClick={() => setActiveTab('quakes')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'quakes'
                    ? 'bg-[#1e2738] border border-cyan-500/60 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌋 SÉISMES
              </button>
              <button
                onClick={() => setActiveTab('flights')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'flights'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ✈️ VOLS
              </button>
            </div>

            {/* SECTION 1: Thermal Radiative Power */}
            {(activeTab === 'all' || activeTab === 'fires') && (
              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2">
                <div className="text-[10px] font-bold text-slate-300 flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-white font-bold">
                    <Flame className="w-3.5 h-3.5 text-[#ff5500] fill-[#ff5500] animate-pulse" /> Incendies Thermiques
                  </span>
                  <span className="text-[#ff5500] font-mono font-bold bg-[#ff5500]/15 border border-[#ff5500]/30 px-2 py-0.5 rounded text-[9px]">
                    FRP (MW)
                  </span>
                </div>

                {/* Thermal Gradient Bar */}
                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-amber-400 via-[#ff5500] via-red-500 to-purple-600 border border-[#21252d] overflow-hidden shadow-inner">
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
                </div>

                {/* Scale Markers */}
                <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                  <span>Modéré (&lt;20 MW)</span>
                  <span>Élevé (50 MW)</span>
                  <span className="text-red-400 font-bold">Critique (&gt;100 MW)</span>
                </div>
              </div>
            )}

            {/* SECTION 2: Seismology Richter */}
            {(activeTab === 'all' || activeTab === 'quakes') && (
              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2">
                <div className="text-[10px] font-bold text-slate-300 flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-white font-bold">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 animate-bounce" /> Séismes
                  </span>
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded text-[9px]">
                    RICHTER M
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm mb-0.5" />
                    <span className="font-bold">&lt; 4.5</span>
                    <span className="text-[8px] text-slate-400 font-sans">Mineur</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm mb-0.5" />
                    <span className="font-bold">4.5 - 6.0</span>
                    <span className="text-[8px] text-slate-400 font-sans">Modéré</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-sm mb-0.5" />
                    <span className="font-bold">&gt; 6.0</span>
                    <span className="text-[8px] text-red-400 font-bold font-sans">Majeur</span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: Flight Radar ADS-B */}
            {(activeTab === 'all' || activeTab === 'flights') && (
              <div className="p-3 rounded-xl bg-[#14171d] border border-[#21252d] space-y-2">
                <div className="text-[10px] font-bold text-slate-300 flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-white font-bold">
                    <Plane className="w-3.5 h-3.5 text-emerald-400" /> Trafic Aérien
                  </span>
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px]">
                    ADS-B LIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shadow-sm shrink-0" />
                    <span className="font-bold truncate text-cyan-300">✈️ Vol Commercial</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-sm shrink-0" />
                    <span className="font-bold truncate text-red-400">🎖️ Vol Militaire</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc] shadow-sm shrink-0" />
                    <span className="font-bold truncate text-purple-300">🛩️ Jet Privé</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#0e1014] border border-[#21252d] text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shadow-sm shrink-0" />
                    <span className="font-bold truncate text-amber-300">🚁 Hélico / Secours</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Telemetry Footer */}
            <div className="pt-1 flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-[#21252d]">
              <span className="flex items-center gap-1 text-slate-400">
                <ShieldAlert className="w-3 h-3 text-slate-500" /> SYNC AUTOMATIQUE
              </span>
              <span className="text-slate-400 font-bold">v1.0.5 PRO</span>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};


