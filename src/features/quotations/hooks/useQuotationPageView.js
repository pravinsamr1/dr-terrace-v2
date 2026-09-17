import { useState, useEffect } from 'react';
import { quotationRepository } from '../api/quotationRepository';

export function useQuotationPageView() {
  const [properties, setProperties] = useState([]);
  const [packages, setPackages] = useState([]);
  const [servicesMap, setServicesMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadPageView = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await quotationRepository.getPageView();
        if (isMounted && res.success) {
          if (Array.isArray(res.properties)) setProperties(res.properties);
          if (Array.isArray(res.packages)) {
            const normalizedPkgs = [];
            res.packages.forEach((entry) => {
              if (!entry) return;
              if (Array.isArray(entry.data)) {
                const tierName = entry.package || 'None';
                entry.data.forEach((item) => {
                  if (!item) return;
                  normalizedPkgs.push({
                    ...item,
                    id: item.id || item.packageId,
                    packageId: item.packageId != null ? item.packageId : item.id,
                    packageName: item.packageName || item.name || '',
                    packages: tierName,
                    tier: tierName.toLowerCase(),
                    warranty: item.warranty || null,
                    services: Array.isArray(item.services) ? item.services : [],
                  });
                });
              } else {
                normalizedPkgs.push(entry);
              }
            });

            setPackages(normalizedPkgs);

            const sMap = {};
            normalizedPkgs.forEach((pkg) => {
              (pkg.services || []).forEach((srv) => {
                const sName = srv.serviceName;
                if (!sName) return;
                if (!sMap[sName]) {
                  sMap[sName] = {
                    serviceId: srv.serviceId,
                    serviceName: sName,
                    tierType: srv.tierType,
                    descriptions: {},
                    rates: {},
                  };
                }
                const defaultSub = Array.isArray(srv.subtitles) && srv.subtitles.length > 0
                  ? (srv.subtitles.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || srv.subtitles[0])
                  : null;
                const desc = defaultSub?.description ?? srv.description;
                const rate = defaultSub?.rate ?? srv.rate;
                if (pkg.packageName) {
                  sMap[sName].descriptions[pkg.packageName] = desc;
                  sMap[sName].rates[pkg.packageName] = rate;
                }
                if (pkg.packages) {
                  sMap[sName].descriptions[pkg.packages] = desc;
                  sMap[sName].rates[pkg.packages] = rate;
                }
              });
            });
            setServicesMap(sMap);
          }
        }
      } catch (err) {
        if (isMounted) setError(err?.message || 'Failed to load quotation config');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPageView();
    return () => {
      isMounted = false;
    };
  }, []);

  return { properties, packages, servicesMap, isLoading, error };
}

export default useQuotationPageView;
