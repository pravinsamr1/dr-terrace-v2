import { CHENNAI_AREAS, getPincodeForArea } from '../../shared/constants/chennai-areas.js';

// Coordinates for major Tamil Nadu cities to bias Photon search
const CITY_COORDINATES = {
  chennai: { lat: 13.0827, lon: 80.2707 },
  thiruvallur: { lat: 13.1439, lon: 79.9083 },
  tiruvallur: { lat: 13.1439, lon: 79.9083 },
  chengalpattu: { lat: 12.6841, lon: 79.9836 },
  kanchipuram: { lat: 12.8342, lon: 79.7036 },
  vellore: { lat: 12.9165, lon: 79.1325 },
  ranipet: { lat: 12.9272, lon: 79.3332 },
  coimbatore: { lat: 11.0168, lon: 76.9558 },
  madurai: { lat: 9.9252, lon: 78.1198 },
  salem: { lat: 11.6643, lon: 78.1460 },
  trichy: { lat: 10.7905, lon: 78.7047 },
  'tiruchirappalli (trichy)': { lat: 10.7905, lon: 78.7047 },
  erode: { lat: 11.3410, lon: 77.7172 },
  tirunelveli: { lat: 8.7139, lon: 77.7567 },
  default: { lat: 13.0827, lon: 80.2707 },
};

// In-memory cache for recent search queries to provide instant responses on repeated typing
const searchCache = new Map();
const MAX_CACHE_SIZE = 100;

function getCacheKey(query, city) {
  return `${(query || '').trim().toLowerCase()}__${(city || '').trim().toLowerCase()}`;
}

function addToCache(key, data) {
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(key, data);
}

/**
 * Clean up administrative prefixes like "Zone 7 Ambattur" -> "Ambattur"
 */
function sanitizeAreaName(rawName) {
  if (!rawName) return '';
  return rawName
    .replace(/^(Zone\s+\d+|Ward\s+\d+)\s+[-–]?\s*/i, '')
    .trim();
}

/**
 * Filter out non-residential/irrelevant geographical points unless user explicitly asked
 */
function isRelevantFeature(feat, queryLower) {
  const p = feat.properties || {};
  const osmKey = p.osm_key;
  const osmValue = p.osm_value;

  // If it's a water body / lake and user didn't type lake/kulam/eri
  if (osmKey === 'water' || osmValue === 'reservoir' || osmValue === 'water') {
    if (!queryLower.includes('lake') && !queryLower.includes('kulam') && !queryLower.includes('eri')) {
      return false;
    }
  }

  return true;
}

/**
 * Build a concise and readable display name for suggestions
 */
function buildDisplayName(name, properties, fallbackCity) {
  const parts = [];
  if (properties.district && !name.toLowerCase().includes(properties.district.toLowerCase())) {
    parts.push(properties.district);
  }
  const cityOrCounty = properties.city || properties.county;
  if (cityOrCounty && !name.toLowerCase().includes(cityOrCounty.toLowerCase()) && !parts.includes(cityOrCounty)) {
    parts.push(cityOrCounty);
  }
  if (properties.state && !parts.includes(properties.state)) {
    parts.push(properties.state);
  }

  if (parts.length === 0) {
    return `${name}, ${fallbackCity || 'Tamil Nadu'}`;
  }
  return `${name}, ${parts.join(', ')}`;
}

/**
 * Query the free Photon Komoot API (Elasticsearch over OpenStreetMap)
 */
async function fetchFromPhoton(query, city, signal) {
  const cleanCity = (city || '').trim().toLowerCase();
  const coords = CITY_COORDINATES[cleanCity] || CITY_COORDINATES.default;
  const cityName = city && city !== 'Other' ? city : 'Chennai';

  const searchUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${coords.lat}&lon=${coords.lon}&limit=12`;

  const response = await fetch(searchUrl, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Photon API responded with status ${response.status}`);
  }

  const data = await response.json();
  const queryLower = query.toLowerCase();
  const results = [];
  const seenNames = new Set();

  for (const feat of data.features || []) {
    if (!isRelevantFeature(feat, queryLower)) continue;

    const p = feat.properties || {};
    const rawName = p.name;
    if (!rawName) continue;

    const name = sanitizeAreaName(rawName);
    if (!name || name.length < 2) continue;

    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);

    // Resolve pincode from API postcode or fallback to local mapping
    const pincode = p.postcode || getPincodeForArea(name) || undefined;
    const displayName = buildDisplayName(name, p, cityName);

    results.push({
      name,
      displayName,
      pincode,
      isOsm: true,
    });
  }

  return results;
}

/**
 * Query OpenStreetMap Nominatim as secondary fallback
 */
async function fetchFromNominatim(query, city, signal) {
  const cityName = city && city !== 'Other' ? city : 'Chennai';
  const queryStr = `${query}, ${cityName}, Tamil Nadu, India`;
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=jsonv2&addressdetails=1&limit=8&countrycodes=in&accept-language=en`;

  const response = await fetch(nominatimUrl, {
    signal,
    headers: {
      'User-Agent': 'DrTerraceApp/1.0 (contact@drterrace.com)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API responded with status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  const results = [];
  const seenNames = new Set();

  for (const item of data) {
    const rawName = item.name || item.address?.suburb || item.address?.town || item.address?.neighbourhood;
    if (!rawName) continue;

    const name = sanitizeAreaName(rawName);
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);

    const pincode = item.address?.postcode || getPincodeForArea(name) || undefined;
    const displayName = item.display_name || `${name}, ${cityName}`;

    results.push({
      name,
      displayName,
      pincode,
      isOsm: true,
    });
  }

  return results;
}

/**
 * Synchronous local area search fallback
 */
export function getLocalAreaSuggestions(queryText, selectedCity = 'Chennai') {
  const trimmed = (queryText || '').trim().toLowerCase();
  if (trimmed.length < 3) return [];

  const matched = CHENNAI_AREAS.filter((area) =>
    area.toLowerCase().includes(trimmed)
  );

  matched.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(trimmed);
    const bStarts = b.toLowerCase().startsWith(trimmed);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.localeCompare(b);
  });

  const activeCityName = selectedCity && selectedCity !== 'Other' ? selectedCity : 'Tamil Nadu';

  return matched.slice(0, 20).map((area) => ({
    name: area,
    pincode: getPincodeForArea(area),
    displayName: `${area}, ${activeCityName}`,
    isOsm: false,
  }));
}

/**
 * Primary area search function:
 * 1. Checks in-memory cache.
 * 2. Tries Photon API (fast, OSM autocomplete, location-biased).
 * 3. Falls back to OSM Nominatim.
 * 4. Falls back to local CHENNAI_AREAS if offline / all network calls fail.
 */
export async function searchAreasOnline(queryText, selectedCity = 'Chennai', signal) {
  const trimmed = (queryText || '').trim();
  if (trimmed.length < 3) return [];

  const cacheKey = getCacheKey(trimmed, selectedCity);
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  try {
    // 1. Try Photon API
    const photonResults = await fetchFromPhoton(trimmed, selectedCity, signal);
    if (photonResults && photonResults.length > 0) {
      addToCache(cacheKey, photonResults);
      return photonResults;
    }

    // 2. Fallback to Nominatim if Photon returned empty
    const nominatimResults = await fetchFromNominatim(trimmed, selectedCity, signal);
    if (nominatimResults && nominatimResults.length > 0) {
      addToCache(cacheKey, nominatimResults);
      return nominatimResults;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error; // Re-throw aborts so hook knows request was cancelled
    }
    console.warn('[OSM Area Service] Online search failed, falling back to local dataset:', error?.message);
  }

  // 3. Fallback to local dataset
  const localResults = getLocalAreaSuggestions(trimmed, selectedCity);
  if (localResults.length > 0) {
    addToCache(cacheKey, localResults);
  }
  return localResults;
}
