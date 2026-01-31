import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Tenant } from '@shared/schema';

export default function TrackingScripts() {
  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });
  
  const lastGaId = useRef<string | null>(null);
  const lastGscCode = useRef<string | null>(null);

  useEffect(() => {
    if (!tenant) return;

    const gaId = tenant.googleAnalyticsId || null;
    
    if (gaId && gaId !== lastGaId.current) {
      const existingScript = document.getElementById('ga-script');
      const existingInit = document.getElementById('ga-init');
      if (existingScript) existingScript.remove();
      if (existingInit) existingInit.remove();

      const gaScript = document.createElement('script');
      gaScript.id = 'ga-script';
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(gaScript);

      const gaInit = document.createElement('script');
      gaInit.id = 'ga-init';
      gaInit.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}');
      `;
      document.head.appendChild(gaInit);
      lastGaId.current = gaId;
    } else if (!gaId && lastGaId.current) {
      const existingScript = document.getElementById('ga-script');
      const existingInit = document.getElementById('ga-init');
      if (existingScript) existingScript.remove();
      if (existingInit) existingInit.remove();
      lastGaId.current = null;
    }

    const gscCode = tenant.googleSearchConsoleCode || null;
    
    if (gscCode && gscCode !== lastGscCode.current) {
      const existingMeta = document.getElementById('gsc-meta');
      if (existingMeta) existingMeta.remove();

      const parser = new DOMParser();
      const doc = parser.parseFromString(gscCode, 'text/html');
      const metaTag = doc.querySelector('meta[name="google-site-verification"]');
      if (metaTag) {
        const content = metaTag.getAttribute('content');
        if (content) {
          const safeMeta = document.createElement('meta');
          safeMeta.id = 'gsc-meta';
          safeMeta.name = 'google-site-verification';
          safeMeta.content = content;
          document.head.appendChild(safeMeta);
        }
      }
      lastGscCode.current = gscCode;
    } else if (!gscCode && lastGscCode.current) {
      const existingMeta = document.getElementById('gsc-meta');
      if (existingMeta) existingMeta.remove();
      lastGscCode.current = null;
    }

    return () => {};
  }, [tenant?.googleAnalyticsId, tenant?.googleSearchConsoleCode]);

  return null;
}
