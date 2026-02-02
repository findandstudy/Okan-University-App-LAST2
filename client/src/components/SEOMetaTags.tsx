import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SeoSettings, SupportedLanguage, Tenant } from '@shared/schema';

interface SEOMetaTagsProps {
  lang?: SupportedLanguage;
}

export default function SEOMetaTags({ lang = 'en' }: SEOMetaTagsProps) {
  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ['/api/seo-settings'],
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });
  
  const lastSettingsRef = useRef<string | null>(null);

  useEffect(() => {
    const fallbackTitle = tenant?.universityName || 'University';

    const settingsKey = JSON.stringify({ seoSettings, tenant });
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
        if (property) {
          meta.setAttribute('property', name);
        } else {
          meta.name = name;
        }
        document.head.appendChild(meta);
      }
      meta.content = content;
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

    if (seoSettings?.canonicalUrl) {
      let canonical = document.getElementById('seo-canonical') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.id = 'seo-canonical';
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = seoSettings.canonicalUrl;
    } else {
      const existing = document.getElementById('seo-canonical');
      if (existing) existing.remove();
    }

    return () => {};
  }, [seoSettings, tenant, lang]);

  return null;
}
