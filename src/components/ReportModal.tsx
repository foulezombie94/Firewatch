import React, { useState } from 'react';
import { X, FileText, Copy, Check, Printer, Flame, ShieldAlert, Globe, Wind } from 'lucide-react';
import { FireFeature } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  topHotspots: FireFeature[];
  totalFires: number;
  lastUpdated: string | null;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  topHotspots,
  totalFires,
  lastUpdated,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const dateStr = new Date().toUTCString();
  const maxFire = topHotspots[0];
  const totalCo2 = topHotspots.reduce((sum, f) => sum + (f.properties.frp * 0.15), 0).toFixed(0);

  const reportText = `
====================================================
🔥 FIREWATCH REALTIME - RAPPORT D'URGENCE SATELLITE (SITREP)
====================================================
Émis le : ${dateStr}
Source : Télémesures Satellites Orbitaux (VIIRS NOAA & MODIS)
Statut Globale : ${totalFires.toLocaleString()} anomalies thermiques actives

----------------------------------------------------
1. FEU #1 MONDIAL LE PLUS INTENSE :
----------------------------------------------------
- Localisation : ${maxFire?.properties.locationName || 'Lualaba, Congo'}
- Puissance Radiative (FRP) : ${maxFire?.properties.frp || 0} MW
- Coordonnées GPS : ${maxFire?.geometry.coordinates[1]}°, ${maxFire?.geometry.coordinates[0]}°
- Capteur Satellite : ${maxFire?.properties.satellite}

----------------------------------------------------
2. TOP 10 DES INCENDIES MAJEURS SUR LA PLANÈTE :
----------------------------------------------------
${topHotspots.map((f, i) => `#${i + 1} | ${f.properties.locationName || 'Inconnu'} | ${f.properties.frp} MW | GPS: ${f.geometry.coordinates[1].toFixed(2)}°, ${f.geometry.coordinates[0].toFixed(2)}° | ${f.properties.satellite}`).join('\n')}

----------------------------------------------------
3. IMPACT CARBO_ÉMISSION ESTIMÉ :
----------------------------------------------------
- Débit d'Émissions CO2 (Top 10) : ~${totalCo2} tonnes/heure
- Méthodologie : Conversion Copernicus CAMS FRP -> CO2
====================================================
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-950/95 backdrop-blur-3xl border border-slate-800/90 shadow-[0_25px_60px_rgba(0,0,0,0.9)] rounded-3xl w-full max-w-3xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md shadow-orange-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white tracking-tight">
                Rapport de Situation Incendies (SITREP)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Télémesures satellites synthétisées en temps réel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto font-sans text-xs">
          {/* Key Situation Cards */}
          <div className="grid grid-cols-3 gap-3 font-mono">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Total Détections</div>
              <div className="text-lg font-bold text-white mt-0.5">{totalFires.toLocaleString()}</div>
              <div className="text-[9px] text-slate-400 font-sans">Satellites Orbitaux</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/30">
              <div className="text-[10px] text-red-400 uppercase font-bold">#1 Foyer Mondial</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">{maxFire?.properties.frp} MW</div>
              <div className="text-[9px] text-slate-300 truncate font-sans">{maxFire?.properties.locationName}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-cyan-400 uppercase font-bold">Débit CO₂ Est.</div>
              <div className="text-lg font-bold text-cyan-300 mt-0.5">~{totalCo2} t/h</div>
              <div className="text-[9px] text-slate-400 font-sans">Copernicus CAMS</div>
            </div>
          </div>

          {/* Top 10 Table */}
          <div className="space-y-2">
            <h3 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> Synthèse des 10 Feux les plus Intenses sur Terre
            </h3>
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Localisation</th>
                    <th className="py-2.5 px-3 font-mono text-right">FRP (MW)</th>
                    <th className="py-2.5 px-3">Capteur</th>
                    <th className="py-2.5 px-3 font-mono text-right">GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {topHotspots.map((spot, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 font-bold text-amber-400">#{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-bold text-white truncate max-w-[200px]">
                        {spot.properties.locationName || 'Inconnu'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-400">
                        {spot.properties.frp} MW
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[11px] font-sans">
                        {spot.properties.satellite}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400 text-[10px]">
                        {spot.geometry.coordinates[1].toFixed(2)}°, {spot.geometry.coordinates[0].toFixed(2)}°
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400 font-mono">
            Télédétection Spatiale & Mapbox GL JS
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-slate-800"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Copié !' : 'Copier Texte'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
