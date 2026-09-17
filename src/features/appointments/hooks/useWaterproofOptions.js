import { useState, useEffect } from 'react';
import { appointmentRepository } from '../api/appointmentRepository';

export function useWaterproofOptions() {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await appointmentRepository.getWaterproofOptions();
        if (isMounted) {
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setOptions(res.data);
          } else {
            setOptions([
              { id: 4, name: 'Terrace' },
              { id: 8, name: 'Outer Wall Proofing' },
              { id: 12, name: 'Bathroom Proofing' },
              { id: 16, name: 'Sump Proofing' },
            ]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch options');
          setOptions([
            { id: 4, name: 'Terrace' },
            { id: 8, name: 'Outer Wall Proofing' },
            { id: 12, name: 'Bathroom Proofing' },
            { id: 16, name: 'Sump Proofing' },
          ]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  return { options, isLoading, error };
}

export default useWaterproofOptions;
