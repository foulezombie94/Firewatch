import React from 'react';
import { ShieldCheck, X, Cookie, Eye, Lock, FileText, ExternalLink } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Politique de Confidentialité & RGPD
              </h2>
              <p className="text-xs text-slate-400">Conformité aux règles Google AdSense & Protection des données</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          
          <section className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
              <Eye className="w-4 h-4" /> 1. Présentation du Service
            </h3>
            <p>
              Le site <strong>FireWatch RealTime</strong> est une plateforme de visualisation en temps réel des télémesures environnementales (incendies satellites NASA FIRMS, séismes USGS, et radar aérien ADS-B). Nous attachons une importance capitale au respect de la vie privée de nos utilisateurs et à la transparence quant à la collecte des données.
            </p>
          </section>

          <section className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
              <Cookie className="w-4 h-4" /> 2. Google AdSense & Cookies Tiers
            </h3>
            <p>
              Nous utilisons le service publicitaire <strong>Google AdSense</strong> pour financer l'infrastructure et les serveurs de la plateforme. Conformément aux politiques officielles de Google :
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>Des fournisseurs tiers, y compris Google, utilisent des cookies pour diffuser des annonces pertinentes en fonction des visites antérieures des utilisateurs sur ce site ou sur d'autres sites Web.</li>
              <li>Grâce aux cookies publicitaires, Google et ses partenaires peuvent diffuser des annonces adaptées à votre navigation.</li>
              <li>
                Vous pouvez choisir de désactiver la publicité personnalisée dans les paramètres des annonces Google en visitant :{' '}
                <a 
                  href="https://adssettings.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 underline font-mono inline-flex items-center gap-1 hover:text-cyan-300"
                >
                  adssettings.google.com <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Vous pouvez également refuser les cookies de fournisseurs tiers relatifs à la publicité personnalisée sur le site :{' '}
                <a 
                  href="http://www.aboutads.info/choices/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 underline font-mono inline-flex items-center gap-1 hover:text-cyan-300"
                >
                  aboutads.info/choices <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
              <Lock className="w-4 h-4" /> 3. Droits RGPD (Espace Économique Européen)
            </h3>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et aux réglementations locales ePrivacy :
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>Vous disposez du droit d'accéder, de rectifier ou de demander la suppression de vos préférences de consentement à tout moment.</li>
              <li>Aucune donnée personnelle directement identifiable (nom, adresse email, téléphone) n'est vendue ni cédée à des tiers.</li>
              <li>Le consentement aux cookies peut être modifié ou révoqué à tout moment en cliquant sur le bouton de réinitialisation du bandeau RGPD.</li>
            </ul>
          </section>

          <section className="space-y-1.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="font-bold text-sm text-purple-400 flex items-center gap-2">
              <FileText className="w-4 h-4" /> 4. Contact & Éditeur
            </h3>
            <p>
              Pour toute question concernant cette politique de confidentialité ou l'exercice de vos droits, vous pouvez contacter l'équipe d'administration à l'adresse suivante : <span className="font-mono text-cyan-300">contact@firewatch-realtime.app</span>.
            </p>
          </section>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end shrink-0 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Fermer et Accepter
          </button>
        </div>

      </div>
    </div>
  );
};
