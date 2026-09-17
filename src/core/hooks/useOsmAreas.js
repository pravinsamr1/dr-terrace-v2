import { useState, useEffect, useRef, useMemo } from 'react';
import { searchAreasOnline, getLocalAreaSuggestions } from '../services/osmAreaService';

const TAMIL_NADU_CITIES = [
  'Chennai',
  'Thiruvallur',
  'Tiruvallur',
  'Chengalpattu',
  'Kanchipuram',
  'Vellore',
  'Ranipet',
  'Tirupattur',
  'Coimbatore',
  'Madurai',
  'Tiruchirappalli (Trichy)',
  'Salem',
  'Tirunelveli',
  'Erode',
  'Tiruppur',
  'Thanjavur',
  'Dindigul',
  'Cuddalore',
  'Karur',
  'Nagercoil',
  'Hosur',
  'Kumbakonam',
  'Thoothukudi',
  'Puducherry',
  'Tiruvannamalai',
  'Villupuram',
  'Nagapattinam',
  'Pudukkottai',
  'Theni',
  'Virudhunagar',
  'Sivakasi',
  'Ramanathapuram',
  'Namakkal',
  'Dharmapuri',
  'Krishnagiri',
];

/**
 * Custom hook to search areas dynamically using live OpenStreetMap (Photon/Nominatim)
 * with instant local preview and offline fallback.
 * Triggered when user types 3 or more letters.
 */
export function useOsmAreas(queryText, selectedCity = 'Chennai') {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const trimmed = (queryText || '').trim();

    // Clear any pending debounce timer and abort previous network call
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setShowSuggestions(false);
      return;
    }

    // Show suggestions dropdown
    setShowSuggestions(true);

    // Provide instant initial matches from local dataset while fetching live results
    const instantMatches = getLocalAreaSuggestions(trimmed, selectedCity);
    if (instantMatches.length > 0) {
      setSuggestions(instantMatches);
    }

    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Debounce live API call by 300ms to avoid spamming the network
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const liveResults = await searchAreasOnline(trimmed, selectedCity, controller.signal);
        if (!controller.signal.aborted) {
          if (liveResults && liveResults.length > 0) {
            setSuggestions(liveResults);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[useOsmAreas] Search error:', err?.message);
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        }
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      controller.abort();
    };
  }, [queryText, selectedCity]);

  return {
    suggestions,
    isLoading,
    showSuggestions,
    setShowSuggestions,
  };
}

/**
 * Custom hook to search cities from the local dataset.
 * Triggered instantly when user types 3 or more letters.
 */
export function useOsmCities(queryText) {
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const citySuggestions = useMemo(() => {
    const trimmed = (queryText || '').trim().toLowerCase();
    if (trimmed.length < 3) return [];

    const matched = TAMIL_NADU_CITIES.filter((city) =>
      city.toLowerCase().includes(trimmed)
    );

    matched.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(trimmed);
      const bStarts = b.toLowerCase().startsWith(trimmed);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });

    return matched;
  }, [queryText]);

  useEffect(() => {
    const trimmed = (queryText || '').trim();
    if (trimmed.length >= 3) {
      setShowCitySuggestions(true);
    } else {
      setShowCitySuggestions(false);
    }
  }, [queryText]);

  return {
    citySuggestions,
    isLoadingCity: false,
    showCitySuggestions,
    setShowCitySuggestions,
  };
}
