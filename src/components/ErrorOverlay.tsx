import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, WifiOff, Shield, Clock, ChevronDown, ChevronUp, Flame, Radio, ServerCrash, AlertTriangle } from 'lucide-react';

interface ServiceStatus {
  fires: 'ok' | 'error' | 'loading';
  earthquakes: 'ok' | 'error' | 'loading';
  flights: 'ok' | 'error' | 'loading';
}

interface ErrorOverlayProps {
  error: string | null;
  serviceStatus: ServiceStatus;
  onRetry: () => void;
  isRetrying: boolean;
}

const serviceConfig: Record<string, { label: string; icon: string; desc: string }> = {
  fires: { label: 'NASA FIRMS', icon: '🔥', desc: 'Détection incendies par satellite' },
  earthquakes: { label: 'USGS Earthquake', icon: '🌍', desc: 'Séismes mondiaux en temps réel' },
  flights: { label: 'OpenSky Network', icon: '✈️', desc: 'Trafic aérien mondial' },
};

// Floating ember particle component
const Ember: React.FC<{ delay: number; left: number; size: number; duration: number }> = ({ delay, left, size, duration }) => (
  <div
    className="absolute rounded-full pointer-events-none opacity-0"
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      bottom: '-10px',
      background: `radial-gradient(circle, rgba(249,115,22,0.9) 0%, rgba(239,68,68,0.4) 60%, transparent 100%)`,
      boxShadow: `0 0 ${size * 2}px rgba(249,115,22,0.3)`,
      animation: `emberFloat ${duration}s ease-out ${delay}s infinite`,
    }}
  />
);

export const ErrorOverlay: React.FC<ErrorOverlayProps> = ({ error, serviceStatus, onRetry, isRetrying }) => {
  const [countdown, setCountdown] = useState(30);
  const [isExpanded, setIsExpanded] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const hasAnyError = error || Object.values(serviceStatus).some(s => s === 'error');
  const allDown = Object.values(serviceStatus).every(s => s === 'error');
  const partialDown = hasAnyError && !allDown;
  const downCount = Object.values(serviceStatus).filter(s => s === 'error').length;

  // Generate embers once
  const embers = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 8,
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 4 + Math.random() * 6,
    })), []);

  // Auto-retry countdown
  useEffect(() => {
    if (!hasAnyError) return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setRetryCount(c => c + 1);
          onRetry();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasAnyError, onRetry]);

  if (!hasAnyError) return null;

  const handleRetry = () => {
    setRetryCount(c => c + 1);
    setCountdown(30);
    onRetry();
  };

  // ══════════════════════════════════════════════════════════════
  // FULL-SCREEN OVERLAY
  // ══════════════════════════════════════════════════════════════
  if (allDown || error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,10,40,0.98),rgba(5,2,12,0.99)_60%,rgba(0,0,0,1))]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating ember particles */}
        {embers.map(e => (
          <Ember key={e.id} {...e} />
        ))}

        {/* Large background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.06)_0%,transparent_70%)] animate-[glowPulse_4s_ease-in-out_infinite] pointer-events-none" />

        {/* Card */}
        <div className="relative z-10 max-w-[540px] w-[92%] animate-[fadeIn_0.6s_ease-out]">

          {/* Top status indicator bar */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <Radio size={12} className="text-red-400 animate-pulse" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-red-400">
                {downCount}/3 services hors ligne
              </span>
            </div>
          </div>

          {/* Main card */}
          <div className="relative p-8 pb-6 bg-gradient-to-b from-slate-900/90 to-slate-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.95),0_0_80px_-20px_rgba(239,68,68,0.1)]">

            {/* Top red accent line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent rounded-full" />

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 blur-xl animate-pulse" />
                <div className="relative flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/25 ring-1 ring-red-500/10 ring-offset-2 ring-offset-slate-900">
                  <ServerCrash size={36} strokeWidth={1.5} className="text-red-400" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-center text-[1.4rem] font-bold text-white mb-1.5 tracking-[-0.02em]">
              Connexion Interrompue
            </h1>
            <p className="text-center text-sm text-slate-400 leading-relaxed mb-6 max-w-[360px] mx-auto">
              {error || 'Les serveurs de données satellites ne répondent pas. Vérifiez votre connexion réseau.'}
            </p>

            {/* Service Status Cards */}
            <div className="space-y-2 mb-6">
              {Object.entries(serviceStatus).map(([key, status]) => {
                const cfg = serviceConfig[key];
                return (
                  <div
                    key={key}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                      ${status === 'ok'
                        ? 'bg-emerald-500/[0.06] border border-emerald-500/20 hover:border-emerald-500/40'
                        : status === 'error'
                          ? 'bg-red-500/[0.04] border border-red-500/15 hover:border-red-500/30'
                          : 'bg-white/[0.02] border border-white/[0.06]'
                      }`}
                  >
                    {/* Status dot with ring animation */}
                    <div className="relative flex-shrink-0">
                      <span className={`block w-2.5 h-2.5 rounded-full
                        ${status === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : ''}
                        ${status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : ''}
                        ${status === 'loading' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : ''}
                      `} />
                      {status === 'error' && (
                        <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                      )}
                    </div>

                    {/* Icon & label */}
                    <span className="text-lg">{cfg?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8rem] font-medium text-slate-200">{cfg?.label}</p>
                      <p className="text-[0.65rem] text-slate-500 truncate">{cfg?.desc}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`text-[0.6rem] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md
                      ${status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                      ${status === 'error' ? 'bg-red-500/10 text-red-400' : ''}
                      ${status === 'loading' ? 'bg-amber-500/10 text-amber-400' : ''}
                    `}>
                      {status === 'ok' ? 'En ligne' : status === 'error' ? 'Hors ligne' : 'Sync...'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Retry section */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="group relative inline-flex items-center gap-2.5 px-8 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold text-sm rounded-xl border-none cursor-pointer transition-all duration-300 shadow-[0_4px_24px_rgba(239,68,68,0.3)] hover:shadow-[0_8px_40px_rgba(239,68,68,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 overflow-hidden"
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                <span className="relative">{isRetrying ? 'Reconnexion...' : 'Réessayer maintenant'}</span>
              </button>

              {/* Countdown progress bar */}
              <div className="w-full max-w-[280px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1 text-[0.68rem] text-slate-500">
                    <Clock size={11} />
                    Prochaine tentative
                  </span>
                  <span className="text-[0.68rem] font-mono font-bold text-orange-400">{countdown}s</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${((30 - countdown) / 30) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Info footer */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
              <Shield size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[0.7rem] font-medium text-emerald-300/80 mb-0.5">Mode résilience activé</p>
                <p className="text-[0.65rem] text-slate-500 leading-relaxed">
                  Les données en cache restent accessibles. Le service reprendra automatiquement dès que les API seront rétablies.
                  {retryCount > 0 && <span className="text-slate-400"> • {retryCount} tentative{retryCount > 1 ? 's' : ''} effectuée{retryCount > 1 ? 's' : ''}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom branding */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Flame size={12} className="text-orange-500/50" />
            <span className="text-[0.6rem] text-slate-600 uppercase tracking-[0.2em] font-medium">
              FireWatch RealTime — Surveillance continue
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PARTIAL BANNER
  // ══════════════════════════════════════════════════════════════
  if (partialDown) {
    return (
      <div className="fixed top-[70px] left-1/2 -translate-x-1/2 z-[1000] w-[92%] max-w-[560px] bg-slate-950/95 backdrop-blur-2xl border border-orange-500/25 rounded-2xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.9),0_0_40px_-5px_rgba(249,115,22,0.1)] animate-[bannerSlideIn_0.4s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">

        {/* Top accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent rounded-full" />

        {/* Header row */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle size={14} className="text-orange-400" />
            </div>
            <div>
              <p className="text-[0.78rem] font-medium text-slate-200">
                {downCount} service{downCount > 1 ? 's' : ''} indisponible{downCount > 1 ? 's' : ''}
              </p>
              <p className="text-[0.62rem] text-slate-500">
                {Object.entries(serviceStatus)
                  .filter(([, s]) => s === 'error')
                  .map(([k]) => serviceConfig[k]?.label)
                  .join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleRetry(); }}
              disabled={isRetrying}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 cursor-pointer transition-all duration-200 hover:bg-orange-500/20 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isRetrying ? 'animate-spin' : ''} />
            </button>
            <div className="text-slate-500 transition-transform duration-200 group-hover:text-slate-400">
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        {isExpanded && (
          <div className="px-4 pb-3 flex flex-col gap-1.5 border-t border-white/[0.05] pt-3">
            {Object.entries(serviceStatus).map(([key, status]) => (
              <div key={key} className="flex items-center gap-2.5 py-1">
                <span className={`relative w-2 h-2 rounded-full flex-shrink-0
                  ${status === 'ok' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : ''}
                  ${status === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : ''}
                  ${status === 'loading' ? 'bg-amber-400' : ''}
                `}>
                  {status === 'error' && <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />}
                </span>
                <span className="text-[0.72rem] text-slate-400">
                  {serviceConfig[key]?.icon} {serviceConfig[key]?.label}
                </span>
                <span className={`ml-auto text-[0.62rem] font-bold uppercase tracking-wider
                  ${status === 'ok' ? 'text-emerald-400' : ''}
                  ${status === 'error' ? 'text-red-400' : ''}
                  ${status === 'loading' ? 'text-amber-400' : ''}
                `}>
                  {status === 'ok' ? '✓ En ligne' : status === 'error' ? '✗ Hors ligne' : '⟳ Sync...'}
                </span>
              </div>
            ))}

            {/* Mini progress bar */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((30 - countdown) / 30) * 100}%` }}
                />
              </div>
              <span className="text-[0.6rem] font-mono text-slate-500">{countdown}s</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
