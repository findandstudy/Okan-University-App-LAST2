import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SeoSettings, SupportedLanguage, Tenant } from '@shared/schema';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

interface SEOMetaTagsProps {
  lang?: SupportedLanguage;
  primaryDomain?: string;
}

export default function SEOMetaTags({ lang = 'en', primaryDomain }: SEOMetaTagsProps) {
  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ['/api/seo-settings'],
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  const lastSettingsRef = useRef<string | null>(null);

  useEffect(() => {
    const fallbackTitle = tenant?.universityName || 'University';

    const settingsKey = JSON.stringify({ seoSettings, tenant, lang, primaryDomain });
    if (settingsKey === lastSettingsRef.current) return;
    lastSettingsRef.current = settingsKey;

    const metaTitleByLang = seoSettings?.metaTitleByLang as Record<SupportedLanguage, string> | null | undefined;
    const metaDescriptionByLang = seoSettings?.metaDescriptionByLang as Record<SupportedLanguage, string> | null | undefined;
    const metaKeywordsByLang = seoSettings?.metaKeywordsByLang as Record<SupportedLanguage, string> | null | undefined;

    const title = metaTitleByLang?.[lang] || metaTitleByLang?.en || fallbackTitle;
    const description = metaDescriptionByLang?.[lang] || metaDescriptionByLang?.en;
    const keywords = metaKeywordsByLang?.[lang] || metaKeywordsByLang?.en;

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

    // ── Canonical ──────────────────────────────────────────────────────────────
    const baseDomain = primaryDomain || tenant?.domain;
    const baseUrl = seoSettings?.canonicalUrl
      ? seoSettings.canonicalUrl.replace(/\/$/, '')
      : baseDomain
        ? `https://${baseDomain}`
        : null;

    const canonicalHref = baseUrl ? (lang === 'en' ? `${baseUrl}/` : `${baseUrl}/${lang}`) : null;
    if (canonicalHref) {
      updateOrCreateLink('seo-canonical', 'canonical', canonicalHref);
    } else {
      removeLink('seo-canonical');
    }

    // ── hreflang alternate links ───────────────────────────────────────────────
    if (baseUrl) {
      // x-default → root
      updateOrCreateLink('hreflang-x-default', 'alternate', `${baseUrl}/`, 'x-default');

      SUPPORTED_LANGUAGES.forEach((l) => {
        const href = l === 'en' ? `${baseUrl}/` : `${baseUrl}/${l}`;
        updateOrCreateLink(`hreflang-${l}`, 'alternate', href, l);
      });
    } else {
      removeLink('hreflang-x-default');
      SUPPORTED_LANGUAGES.forEach((l) => removeLink(`hreflang-${l}`));
    }

    return () => {};
  }, [seoSettings, tenant, lang, primaryDomain]);

  return null;
}
