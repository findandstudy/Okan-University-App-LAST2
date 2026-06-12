import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

const mockGetTenantByHostDomain = vi.fn();
const mockGetTenant = vi.fn();
const mockGetTenantDomains = vi.fn().mockResolvedValue([]);
const mockGetSeoSettings = vi.fn().mockResolvedValue(null);
const mockGetBlogPostTranslationBySlug = vi.fn().mockResolvedValue(undefined);
const mockGetBlogPostTranslations = vi.fn().mockResolvedValue([]);
const mockGetBlogPostImages = vi.fn().mockResolvedValue([]);

vi.mock('../server/storage', () => ({
  storage: {
    getTenantByHostDomain: (...args: any[]) => mockGetTenantByHostDomain(...args),
    getTenant: (...args: any[]) => mockGetTenant(...args),
    getTenantDomains: (...args: any[]) => mockGetTenantDomains(...args),
    getSeoSettings: (...args: any[]) => mockGetSeoSettings(...args),
    getBlogPostTranslationBySlug: (...args: any[]) => mockGetBlogPostTranslationBySlug(...args),
    getBlogPostTranslations: (...args: any[]) => mockGetBlogPostTranslations(...args),
    getBlogPostImages: (...args: any[]) => mockGetBlogPostImages(...args),
  },
}));

import { injectSeoMeta } from '../server/seoRenderer';

const BASE_HTML = `<!DOCTYPE html>
<html>
<head>
<title>App</title>
<!-- SSR_META_START -->
<!-- SSR_META_END -->
</head>
<body></body>
</html>`;

function makeReq(originalUrl: string, host = 'okan.edu.tr'): any {
  return {
    headers: { host, 'x-forwarded-proto': 'https' },
    originalUrl,
    protocol: 'https',
    query: {},
    session: {},
  };
}

const TENANT = {
  id: 'okan-1',
  domain: 'okan.edu.tr',
  universityName: 'Okan University',
  status: 'yayinda',
  logoUrl: null,
  faviconUrl: null,
  googleAnalyticsId: null,
  googleSearchConsoleCode: null,
  googleTagManagerId: null,
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  youtubeUrl: null,
  contactFormEmbed: null,
  heroVideoUrl: null,
  supportedLanguages: ['en'],
  nameByLang: null,
  isActive: true,
  createdAt: new Date(),
};

describe('OG / SSR meta injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantByHostDomain.mockResolvedValue(TENANT);
    mockGetTenantDomains.mockResolvedValue([]);
    mockGetSeoSettings.mockResolvedValue(null);
    mockGetBlogPostTranslations.mockResolvedValue([]);
    mockGetBlogPostImages.mockResolvedValue([]);
  });

  it('landing page: injects og:title and <title> with university name', async () => {
    const result = await injectSeoMeta(BASE_HTML, makeReq('/'));

    expect(result).toContain(`<title>Okan University</title>`);
    expect(result).toContain(`og:title" content="Okan University"`);
  });

  it('blog post page: injects og:title with the post title (not university name)', async () => {
    const post = {
      id: 'post-1',
      tenantId: 'okan-1',
      status: 'yayinda',
      keyword: null,
      backlinkSites: [],
      isAiGenerated: false,
      featuredImageUrl: null,
      featuredImageAltByLang: null,
      publishAt: null,
      createdAt: new Date(),
    };
    const translation = {
      id: 'tr-1',
      postId: 'post-1',
      tenantId: 'okan-1',
      lang: 'en',
      title: 'How to Apply to Turkish Universities',
      slug: 'how-to-apply-turkish-universities',
      content: 'Full article content.',
      metaTitle: 'Apply to Turkish Universities | Okan',
      metaDesc: 'Learn how to apply.',
    };

    mockGetBlogPostTranslationBySlug.mockResolvedValue({ post, translation });

    const result = await injectSeoMeta(
      BASE_HTML,
      makeReq('/en/blog/how-to-apply-turkish-universities'),
    );

    expect(result).toContain('Apply to Turkish Universities | Okan');
    expect(result).toContain(`og:title" content="Apply to Turkish Universities | Okan"`);
    expect(result).toContain(`og:type" content="article"`);
  });

  it('blog post with unknown slug falls back to tenant meta (no crash, no 404)', async () => {
    mockGetBlogPostTranslationBySlug.mockResolvedValue(undefined);

    const result = await injectSeoMeta(
      BASE_HTML,
      makeReq('/en/blog/nonexistent-slug'),
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('Okan University');
    expect(result).toContain('og:type" content="article"');
  });

  it('never crashes on error — always returns html string', async () => {
    mockGetTenantByHostDomain.mockRejectedValue(new Error('DB connection lost'));

    const result = await injectSeoMeta(BASE_HTML, makeReq('/'));

    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html>');
  });
});
