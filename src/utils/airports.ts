export interface CleanAirportInfo {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
}

export interface AirlineInfo {
  code: string;
  name: string;
  flag: string;
}

// Algorithmic ICAO Airline Prefixes Mapping
const AIRLINE_DATABASE: Record<string, { name: string; flag: string }> = {
  TOM: { name: 'TUI Airways', flag: '🇬🇧' },
  EZY: { name: 'easyJet', flag: '🇬🇧' },
  EZS: { name: 'easyJet Switzerland', flag: '🇨🇭' },
  RYR: { name: 'Ryanair', flag: '🇮🇪' },
  RYN: { name: 'Ryanair UK', flag: '🇬🇧' },
  AFR: { name: 'Air France', flag: '🇫🇷' },
  BAW: { name: 'British Airways', flag: '🇬🇧' },
  DLH: { name: 'Lufthansa', flag: '🇩🇪' },
  UAE: { name: 'Emirates', flag: '🇦🇪' },
  QTR: { name: 'Qatar Airways', flag: '🇶🇦' },
  TVF: { name: 'Transavia France', flag: '🇫🇷' },
  TRA: { name: 'Transavia Netherlands', flag: '🇳🇱' },
  RAM: { name: 'Royal Air Maroc', flag: '🇲🇦' },
  DAH: { name: 'Air Algérie', flag: '🇩🇿' },
  TAR: { name: 'Tunisair', flag: '🇹🇳' },
  IBE: { name: 'Iberia', flag: '🇪🇸' },
  TAP: { name: 'TAP Air Portugal', flag: '🇵🇹' },
  KLM: { name: 'KLM Royal Dutch Airlines', flag: '🇳🇱' },
  SWR: { name: 'Swiss International Air Lines', flag: '🇨🇭' },
  THY: { name: 'Turkish Airlines', flag: '🇹🇷' },
  VLG: { name: 'Vueling Airlines', flag: '🇪🇸' },
  VOE: { name: 'Volotea', flag: '🇪🇸' },
  WZZ: { name: 'Wizz Air', flag: '🇭🇺' },
  AAL: { name: 'American Airlines', flag: '🇺🇸' },
  DAL: { name: 'Delta Air Lines', flag: '🇺🇸' },
  UAL: { name: 'United Airlines', flag: '🇺🇸' },
  SWA: { name: 'Southwest Airlines', flag: '🇺🇸' },
  JBU: { name: 'JetBlue Airways', flag: '🇺🇸' },
  FFT: { name: 'Frontier Airlines', flag: '🇺🇸' },
  NKS: { name: 'Spirit Airlines', flag: '🇺🇸' }
};

/**
 * Dynamically clean and format airport properties provided by backend 29,300+ global airports dataset
 */
export function getCleanAirportInfo(
  code: string | undefined,
  origCity?: string,
  origName?: string,
  origCountry?: string
): CleanAirportInfo {
  const iataCode = (code || '').trim().toUpperCase();

  if (!iataCode || iataCode === 'DEP' || iataCode === 'ARR') {
    return {
      iata: iataCode || 'N/A',
      icao: iataCode || 'N/A',
      name: origName || (iataCode === 'DEP' ? 'Aéroport de Départ' : 'Aéroport d\'Arrivée'),
      city: origCity || (iataCode === 'DEP' ? 'Départ' : 'Arrivée'),
      country: origCountry || 'International 🌐'
    };
  }

  let city = origCity || iataCode;
  let name = origName || `Aéroport ${iataCode}`;
  let country = origCountry || 'International 🌐';

  // Sanitize fallback values if city equals raw code
  if (city === iataCode) {
    city = `Zone (${iataCode})`;
  }

  if (name === `Aéroport ${iataCode}` || name === `Aéroport (${iataCode})`) {
    name = `Aéroport International de ${city}`;
  }

  return {
    iata: iataCode,
    icao: iataCode,
    name,
    city,
    country
  };
}

/**
 * Infer Airline Name from flight callsign
 */
export function getAirlineFromCallsign(callsign: string | undefined): { name: string; flag: string } | null {
  if (!callsign || callsign.length < 3) return null;
  const prefix = callsign.trim().substring(0, 3).toUpperCase();
  if (AIRLINE_DATABASE[prefix]) {
    return AIRLINE_DATABASE[prefix];
  }
  return null;
}
