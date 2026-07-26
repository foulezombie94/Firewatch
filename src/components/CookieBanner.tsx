import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Check, X, Info } from 'lucide-react';

interface CookieBannerProps {
  onOpenPrivacy: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenPrivacy }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('firewatch_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('firewatch_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('firewatch_cookie_consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300 font-sans">
      <div className="bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-slate-100 space-y-3">
        
        {/* Banner Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <Cookie className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
              Consentement RGPD & Cookies <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Respect de votre vie privée et personnalisation Google AdSense</p>
          </div>
        </div>

        {/* Banner Description */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Nous utilisons des cookies essentiels ainsi que les services publicitaires <strong>Google AdSense</strong> pour financer le réseau de télédétection et assurer la gratuité de la cartographie temps réel.
        </p>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
          <button
            onClick={handleAccept}
            className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" /> Tout Accepter
          </button>

          <button
            onClick={handleDecline}
            className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" /> Refuser
          </button>
        </div>

        {/* Privacy Link */}
        <div className="text-center pt-1">
          <button
            onClick={onOpenPrivacy}
            className="text-[10px] text-slate-400 hover:text-cyan-300 underline font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <Info className="w-3 h-3" /> En savoir plus et lire la Politique de Confidentialité
          </button>
        </div>

      </div>
    </div>
  );
};
