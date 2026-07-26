const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const geocodeCache = new Map<string, { country: string; region: string; fullLocation: string }>();

export async function getReverseGeocode(lon: number, lat: number): Promise<{ country: string; region: string; fullLocation: string }> {
  const cacheKey = `${lon.toFixed(2)},${lat.toFixed(2)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=place,locality,region,country&language=fr&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');

    const data = await res.json();
    let country = '';
    let region = '';
    let place = '';

    if (data.features && data.features.length > 0) {
      for (const feat of data.features) {
        if (feat.place_type.includes('place') || feat.place_type.includes('locality')) {
          if (!place) place = feat.text;
        } else if (feat.place_type.includes('region')) {
          if (!region) region = feat.text;
        } else if (feat.place_type.includes('country')) {
          if (!country) country = feat.text;
        }
      }
    }

    const cityOrRegion = place || region;
    let fullLocation = '';
    if (cityOrRegion && country) {
      fullLocation = `${cityOrRegion}, ${country}`;
    } else if (country) {
      fullLocation = country;
    } else if (cityOrRegion) {
      fullLocation = cityOrRegion;
    } else {
      fullLocation = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    }

    const result = { country, region: cityOrRegion || region, fullLocation };
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (e) {
    const fallback = { country: '', region: '', fullLocation: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°` };
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}
