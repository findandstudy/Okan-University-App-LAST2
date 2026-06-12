import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TenantWithTracking {
  googleAnalyticsId?: string | null;
  googleSearchConsoleCode?: string | null;
  googleTagManagerId?: string | null;
}

export default function TrackingScripts() {
  const { data: tenant } = useQuery<TenantWithTracking>({
    queryKey: ['/api/tenant'],
  });
  
  const lastGaId = useRef<string | null>(null);
  const lastGscCode = useRef<string | null>(null);
  const lastGtmId = useRef<string | null>(null);

  useEffect(() => {
    if (!tenant) return;

    // ── Google Analytics 4 ──
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
      document.getElementById('ga-script')?.remove();
      document.getElementById('ga-init')?.remove();
      lastGaId.current = null;
    }

    // ── Google Search Console verification ──
    const gscCode = tenant.googleSearchConsoleCode || null;
    if (gscCode && gscCode !== lastGscCode.current) {
      document.getElementById('gsc-meta')?.remove();
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
      document.getElementById('gsc-meta')?.remove();
      lastGscCode.current = null;
    }

    // ── Google Tag Manager ──
    const gtmId = (tenant as any).googleTagManagerId || null;
    if (gtmId && gtmId !== lastGtmId.current) {
      document.getElementById('gtm-script')?.remove();
      document.getElementById('gtm-noscript')?.remove();

      const gtmScript = document.createElement('script');
      gtmScript.id = 'gtm-script';
      gtmScript.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmId}');
      `;
      document.head.appendChild(gtmScript);

      // noscript fallback in body
      const existing = document.getElementById('gtm-noscript');
      if (!existing) {
        const ns = document.createElement('noscript');
        ns.id = 'gtm-noscript';
        ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.insertBefore(ns, document.body.firstChild);
      }

      lastGtmId.current = gtmId;
    } else if (!gtmId && lastGtmId.current) {
      document.getElementById('gtm-script')?.remove();
      document.getElementById('gtm-noscript')?.remove();
      lastGtmId.current = null;
    }

    return () => {};
  }, [tenant?.googleAnalyticsId, tenant?.googleSearchConsoleCode, tenant?.googleTagManagerId]);

  return null;
}
