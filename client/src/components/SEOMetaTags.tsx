import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SeoSettings, SupportedLanguage, Tenant } from '@shared/schema';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

interface SEOMetaTagsProps {
  lang?: SupportedLanguage;
  primaryDomain?: string;
}

function getLangFromPath(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
  return SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)
    ? (firstSegment as SupportedLanguage)
    : 'en';
}

export default function SEOMetaTags({ lang: _lang, primaryDomain }: SEOMetaTagsProps) {
  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ['/api/seo-settings'],
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  // Track URL path changes so meta tags update on client-side navigation
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const onNav = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onNav);
    // wouter uses history.pushState which doesn't fire popstate — patch it
    const origPush = history.pushState.bind(history);
    history.pushState = (...args) => {
      origPush(...args);
      onNav();
    };
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      origReplace(...args);
      onNav();
    };
    return () => {
      window.removeEventListener('popstate', onNav);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  const lastSettingsRef = useRef<string | null>(null);

  useEffect(() => {
    const fallbackTitle = tenant?.universityName || 'University';

    // URL path is the canonical source of truth for SEO language
    // (crawlers don't have localStorage, so URL always wins)
    const effectiveLang: SupportedLanguage = getLangFromPath();

    const settingsKey = JSON.stringify({ seoSettings, tenant, effectiveLang, primaryDomain });
    if (settingsKey === lastSettingsRef.current) return;
    lastSettingsRef.current = settingsKey;

    const metaTitleByLang = seoSettings?.metaTitleByLang as Record<SupportedLanguage, string> | null | undefined;
    const metaDescriptionByLang = seoSettings?.metaDescriptionByLang as Record<SupportedLanguage, string> | null | undefined;
    const metaKeywordsByLang = seoSettings?.metaKeywordsByLang as Record<SupportedLanguage, string> | null | undefined;

    const title = metaTitleByLang?.[effectiveLang] || metaTitleByLang?.en || fallbackTitle;
    const description = metaDescriptionByLang?.[effectiveLang] || metaDescriptionByLang?.en;
    const keywords = metaKeywordsByLang?.[effectiveLang] || metaKeywordsByLang?.en;

    document.title = title;

    const updateOrCreateMeta = (id: string, name: string, content: string | undefined, property?: boolean) => {
      if (!content) {
        const existing = document.getElementById(id);
        if (existing) existing.remove();
        return;
      }
      let meta = document.getElementById(id) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.id = id;
        if (property) meta.setAttribute('property', name);
        else meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const updateOrCreateLink = (id: string, rel: string, href: string, hreflang?: string) => {
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
      if (hreflang) link.hreflang = hreflang;
    };

    const removeLink = (id: string) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };

    updateOrCreateMeta('seo-description', 'description', description);
    updateOrCreateMeta('seo-keywords', 'keywords', keywords);

    if (seoSettings?.robotsDirective) {
      updateOrCreateMeta('seo-robots', 'robots', seoSettings.robotsDirective);
    }

    updateOrCreateMeta('og-title', 'og:title', seoSettings?.ogTitle || title, true);
    updateOrCreateMeta('og-description', 'og:description', seoSettings?.ogDescription || description, true);
    updateOrCreateMeta('og-image', 'og:image', seoSettings?.ogImage || undefined, true);
    updateOrCreateMeta('og-type', 'og:type', seoSettings?.ogType || 'website', true);

    updateOrCreateMeta('twitter-card', 'twitter:card', seoSettings?.twitterCard || 'summary_large_image');
    updateOrCreateMeta('twitter-site', 'twitter:site', seoSettings?.twitterSite || undefined);
    updateOrCreateMeta('twitter-title', 'twitter:title', seoSettings?.ogTitle || title);
    updateOrCreateMeta('twitter-description', 'twitter:description', seoSettings?.ogDescription || description);
    updateOrCreateMeta('twitter-image', 'twitter:image', seoSettings?.ogImage || undefined);

    // ── Canonical & hreflang ───────────────────────────────────────────────────
    // hreflang ALWAYS uses the primary domain (spec: stable canonical domain)
    const hreflangBaseDomain = primaryDomain || tenant?.domain;
    const hreflangBase = hreflangBaseDomain ? `https://${hreflangBaseDomain}` : null;

    // Canonical: explicit editor override OR derived from primary domain + current lang path
    const derivedCanonical = hreflangBase
      ? (effectiveLang === 'en' ? `${hreflangBase}/` : `${hreflangBase}/${effectiveLang}`)
      : null;
    const canonicalHref = seoSettings?.canonicalUrl || derivedCanonical;

    if (canonicalHref) {
      updateOrCreateLink('seo-canonical', 'canonical', canonicalHref);
    } else {
      removeLink('seo-canonical');
    }

    // hreflang links use primaryDomain exclusively (not canonicalUrl which is page-specific)
    if (hreflangBase) {
      updateOrCreateLink('hreflang-x-default', 'alternate', `${hreflangBase}/`, 'x-default');
      SUPPORTED_LANGUAGES.forEach((l) => {
        const href = l === 'en' ? `${hreflangBase}/` : `${hreflangBase}/${l}`;
        updateOrCreateLink(`hreflang-${l}`, 'alternate', href, l);
      });
    } else {
      removeLink('hreflang-x-default');
      SUPPORTED_LANGUAGES.forEach((l) => removeLink(`hreflang-${l}`));
    }

    return () => {};
  }, [seoSettings, tenant, primaryDomain, pathname]);

  return null;
}
