/**
 * SSR Meta Tag Injector
 * Runs on the server BEFORE index.html is sent to the client.
 * Bots (Facebook, Twitter, LinkedIn, WhatsApp, Google) see page-specific
 * og:title, og:description, og:image, canonical, hreflang and JSON-LD
 * without executing any JavaScript.
 */
import { storage } from './storage';
import type { Request } from 'express';
import type { Tenant } from '../shared/schema';

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function trunc(s: string, len: number): string {
  if (!s) return '';
  return s.length <= len ? s : s.slice(0, len - 1) + '\u2026';
}

const LANG_CODES = ['en', 'ar', 'tr', 'fr', 'ru', 'fa', 'zh', 'hi', 'es', 'id'];

// Matches  /blog/:slug  or  /:lang/blog/:slug
const BLOG_POST_RE = /^(?:\/(en|ar|tr|fr|ru|fa|zh|hi|es|id))?\/?blog\/([^/?#]+)\/?$/;
// Matches  /blog  or  /:lang/blog
const BLOG_INDEX_RE = /^(?:\/(en|ar|tr|fr|ru|fa|zh|hi|es|id))?\/?blog\/?$/;

// ── Meta data shape ────────────────────────────────────────────────────────────

interface MetaData {
  title: string;
  description: string;
  ogType: 'website' | 'article';
  ogImage?: string;
  ogUrl?: string;
  siteName: string;
  twitterCard: string;
  canonical?: string;
  hreflang?: Array<{ lang: string; href: string }>;
  jsonLd?: object | object[];
  robots?: string;
}

// ── Build the full <head> meta block from a MetaData object ───────────────────

function buildMetaBlock(m: MetaData): string {
  const parts: string[] = [];

  parts.push(`<meta name="description" content="${esc(m.description)}">`);

  // Open Graph
  parts.push(`<meta property="og:type" content="${esc(m.ogType)}">`);
  parts.push(`<meta property="og:title" content="${esc(m.title)}">`);
  parts.push(`<meta property="og:description" content="${esc(m.description)}">`);
  parts.push(`<meta property="og:site_name" content="${esc(m.siteName)}">`);
  if (m.ogImage) {
    parts.push(`<meta property="og:image" content="${esc(m.ogImage)}">`);
    parts.push(`<meta property="og:image:width" content="1200">`);
    parts.push(`<meta property="og:image:height" content="630">`);
  }
  if (m.ogUrl) {
    parts.push(`<meta property="og:url" content="${esc(m.ogUrl)}">`);
  }

  // Twitter Card
  parts.push(`<meta name="twitter:card" content="${esc(m.twitterCard)}">`);
  parts.push(`<meta name="twitter:title" content="${esc(m.title)}">`);
  parts.push(`<meta name="twitter:description" content="${esc(m.description)}">`);
  if (m.ogImage) {
    parts.push(`<meta name="twitter:image" content="${esc(m.ogImage)}">`);
  }

  // Canonical
  if (m.canonical) {
    parts.push(`<link rel="canonical" href="${esc(m.canonical)}">`);
  }

  // hreflang alternates
  if (m.hreflang && m.hreflang.length > 1) {
    for (const h of m.hreflang) {
      parts.push(`<link rel="alternate" hreflang="${esc(h.lang)}" href="${esc(h.href)}">`);
    }
    // x-default points to the English variant (or first available)
    const xDefault = m.hreflang.find(h => h.lang === 'en') ?? m.hreflang[0];
    parts.push(`<link rel="alternate" hreflang="x-default" href="${esc(xDefault.href)}">`);
  }

  // Robots directive
  if (m.robots) {
    parts.push(`<meta name="robots" content="${esc(m.robots)}">`);
  }

  // JSON-LD structured data
  const schemas = Array.isArray(m.jsonLd) ? m.jsonLd : m.jsonLd ? [m.jsonLd] : [];
  for (const schema of schemas) {
    // JSON.stringify is safe here — not inserted into JS context, just a script block
    parts.push(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
  }

  return parts.join('\n    ');
}

// ── Tenant/landing page meta ───────────────────────────────────────────────────

async function buildTenantMeta(
  tenant: Tenant,
  baseUrl: string,
  lang = 'en',
): Promise<MetaData> {
  const seo = await storage.getSeoSettings(tenant.id);

  const title =
    seo?.ogTitle ||
    (seo?.metaTitleByLang as Record<string, string> | null)?.[lang] ||
    tenant.universityName;

  const rawDesc =
    seo?.ogDescription ||
    (seo?.metaDescriptionByLang as Record<string, string> | null)?.[lang] ||
    `Apply to ${tenant.universityName}`;

  const description = trunc(rawDesc, 160);

  const sameAs: string[] = (
    [tenant.facebookUrl, tenant.instagramUrl, tenant.linkedinUrl, tenant.youtubeUrl] as (string | null | undefined)[]
  ).filter((u): u is string => Boolean(u));

  const jsonLd: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: tenant.universityName,
      url: baseUrl,
      ...(tenant.logoUrl ? { logo: tenant.logoUrl } : {}),
      description: trunc(rawDesc, 200),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: tenant.universityName,
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/blog?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return {
    title,
    description,
    ogType: 'website',
    ogImage: seo?.ogImage || tenant.logoUrl || undefined,
    ogUrl: seo?.canonicalUrl || baseUrl,
    siteName: tenant.universityName,
    twitterCard: seo?.twitterCard || 'summary_large_image',
    canonical: seo?.canonicalUrl || baseUrl,
    robots: seo?.robotsDirective || undefined,
    jsonLd,
  };
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function injectSeoMeta(html: string, req: Request): Promise<string> {
  // In Express 5 app.use("/{*path}") handlers, req.path is always "/"
  // Use req.originalUrl (strip query string) to get the actual path
  const reqPath = (req.originalUrl || '/').split('?')[0].split('#')[0] || '/';

  // Skip routes that never need SSR meta
  if (
    reqPath.startsWith('/api/') ||
    reqPath.startsWith('/admin') ||
    reqPath.startsWith('/objects/') ||
    reqPath.startsWith('/uploads/') ||
    reqPath.startsWith('/vite-hmr')
  ) {
    return html;
  }

  try {
    // ── 1. Resolve tenant ────────────────────────────────────────────────────
    const rawHost = (req.headers.host || '').replace(/^www\./, '').replace(/:\d+$/, '').toLowerCase();
    let tenant = await storage.getTenantByHostDomain(rawHost);

    // Admin preview _tid override
    const tidOverride = (req.query?._tid as string | undefined);
    if (tidOverride && (req as any).session?.adminId) {
      const t = await storage.getTenant(tidOverride);
      if (t) tenant = t;
    }

    // Unknown host (e.g. localhost in dev, unlisted domain) — fallback to default tenant
    if (!tenant) {
      tenant = await storage.getTenant('default') ?? undefined;
    }
    if (!tenant) return html;

    // ── 2. Determine base URL (prefer primary domain) ────────────────────────
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol || 'https';
    const domains = await storage.getTenantDomains(tenant.id);
    const primaryDomain = domains.find(d => d.isPrimary)?.domain || tenant.domain;
    const baseUrl = `${proto}://${primaryDomain}`;

    // ── 3. Route detection ───────────────────────────────────────────────────
    const blogPostMatch = BLOG_POST_RE.exec(reqPath);
    const blogIndexMatch = BLOG_INDEX_RE.exec(reqPath);

    let meta: MetaData;

    // ────────────────────────────────────────────────────────
    // BLOG POST  /blog/:slug  or  /:lang/blog/:slug
    // ────────────────────────────────────────────────────────
    if (blogPostMatch) {
      const langParam = blogPostMatch[1];
      const slug = decodeURIComponent(blogPostMatch[2]);
      const lang = langParam && LANG_CODES.includes(langParam) ? langParam : 'en';

      const result = await storage.getBlogPostTranslationBySlug(tenant.id, lang, slug);

      if (result) {
        const { post, translation } = result;
        const [allTranslations, images] = await Promise.all([
          storage.getBlogPostTranslations(post.id),
          storage.getBlogPostImages(post.id),
        ]);

        const heroImage =
          post.featuredImageUrl ||
          images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url ||
          undefined;

        const rawDesc = translation.metaDesc || stripHtml(translation.content);
        const description = trunc(rawDesc, 160);
        const title = translation.metaTitle || translation.title;

        // hreflang for every available language
        const hreflang = allTranslations.map(t => ({
          lang: t.lang,
          href: `${baseUrl}/${t.lang}/blog/${t.slug}`,
        }));

        const jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: translation.title,
          description: trunc(rawDesc, 220),
          ...(heroImage ? { image: heroImage } : {}),
          ...(post.createdAt ? { datePublished: (post.createdAt as Date).toISOString() } : {}),
          url: `${baseUrl}/${lang}/blog/${translation.slug}`,
          inLanguage: lang,
          author: {
            '@type': 'Organization',
            name: tenant.universityName,
          },
          publisher: {
            '@type': 'Organization',
            name: tenant.universityName,
            ...(tenant.logoUrl ? { logo: { '@type': 'ImageObject', url: tenant.logoUrl } } : {}),
          },
          isPartOf: {
            '@type': 'Blog',
            name: `${tenant.universityName} Blog`,
            url: `${baseUrl}/blog`,
          },
        };

        meta = {
          title,
          description,
          ogType: 'article',
          ogImage: heroImage,
          ogUrl: `${baseUrl}/${lang}/blog/${translation.slug}`,
          siteName: tenant.universityName,
          twitterCard: 'summary_large_image',
          canonical: `${baseUrl}/${lang}/blog/${translation.slug}`,
          hreflang,
          jsonLd,
        };
      } else {
        // Blog post not found in this lang — fall back to tenant defaults
        meta = await buildTenantMeta(tenant, baseUrl, lang);
      }
    }

    // ────────────────────────────────────────────────────────
    // BLOG INDEX  /blog  or  /:lang/blog
    // ────────────────────────────────────────────────────────
    else if (blogIndexMatch) {
      const langParam = blogIndexMatch[1];
      const lang = langParam && LANG_CODES.includes(langParam) ? langParam : 'en';

      const seo = await storage.getSeoSettings(tenant.id);
      const siteTitle =
        (seo?.metaTitleByLang as Record<string, string> | null)?.[lang] ||
        tenant.universityName;

      const description = trunc(
        (seo?.metaDescriptionByLang as Record<string, string> | null)?.[lang] ||
          `Read the latest articles and news from ${tenant.universityName}.`,
        160,
      );

      meta = {
        title: `Blog — ${siteTitle}`,
        description,
        ogType: 'website',
        ogImage: seo?.ogImage || tenant.logoUrl || undefined,
        ogUrl: `${baseUrl}/${lang}/blog`,
        siteName: tenant.universityName,
        twitterCard: seo?.twitterCard || 'summary_large_image',
        canonical: `${baseUrl}/${lang}/blog`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: `${siteTitle} Blog`,
          url: `${baseUrl}/blog`,
          publisher: {
            '@type': 'Organization',
            name: tenant.universityName,
            url: baseUrl,
            ...(tenant.logoUrl ? { logo: tenant.logoUrl } : {}),
          },
        },
      };
    }

    // ────────────────────────────────────────────────────────
    // LANDING PAGE (and all other SPA routes)
    // ────────────────────────────────────────────────────────
    else {
      // Detect language from URL prefix for lang-specific meta title/desc
      const langPrefixMatch = /^\/(en|ar|tr|fr|ru|fa|zh|hi|es|id)(?:\/|$)/.exec(reqPath);
      const lang = langPrefixMatch ? langPrefixMatch[1] : 'en';
      meta = await buildTenantMeta(tenant, baseUrl, lang);
    }

    // ── 4. Inject into HTML ──────────────────────────────────────────────────
    const titleTag = `<title>${esc(meta.title)}</title>`;
    const metaBlock = buildMetaBlock(meta);
    const ssrBlock = `<!-- SSR_META_START -->\n    ${metaBlock}\n    <!-- SSR_META_END -->`;

    let result = html;

    // Replace the SSR placeholder block
    if (html.includes('<!-- SSR_META_START -->')) {
      result = result.replace(
        /<!-- SSR_META_START -->[\s\S]*?<!-- SSR_META_END -->/,
        ssrBlock,
      );
    } else {
      // Fallback: inject just before </head> if no placeholder found
      result = result.replace('</head>', `    ${metaBlock}\n  </head>`);
    }

    // Replace <title>
    result = result.replace(/<title>[^<]*<\/title>/, titleTag);

    // Replace favicon if tenant has one (production path)
    if (tenant.faviconUrl) {
      result = result.replace(
        /<link rel="icon" type="image\/png" href="[^"]*">/,
        `<link rel="icon" type="image/png" href="${esc(tenant.faviconUrl)}">`,
      );
    }

    return result;
  } catch (err) {
    console.error('[seoRenderer] SSR meta injection failed:', err);
    return html; // never crash — always serve the page
  }
}
