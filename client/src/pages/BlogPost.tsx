import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { Tenant } from '@shared/schema';

interface BlogPostDetail {
  post: {
    id: string;
    publishAt: string | null;
    createdAt: string;
    keyword: string | null;
    featuredImageUrl: string | null;
    featuredImageAltByLang: Record<string, string> | null;
  };
  translation: {
    title: string;
    slug: string;
    content: string;
    metaTitle: string | null;
    metaDesc: string | null;
    lang: string;
  };
  alternates?: Record<string, string>;
}

// ── FAQ parser: extracts Q&A pairs from the "## Frequently Asked Questions" section ──
interface FaqPair { q: string; a: string; }

function parseFaqFromMarkdown(md: string): FaqPair[] {
  const faqHeaderMatch = md.match(/##\s*Frequently Asked Questions[\s\S]*/i);
  if (!faqHeaderMatch) return [];
  const faqSection = faqHeaderMatch[0];
  const pairs: FaqPair[] = [];
  // Match pattern: **Q: ...** (newline) A: ...
  const regex = /\*\*Q:\s*(.+?)\*\*\s*\n+A:\s*([\s\S]+?)(?=\n\s*\n\*\*Q:|$)/gi;
  let match;
  while ((match = regex.exec(faqSection)) !== null) {
    const q = match[1].trim().replace(/\?$/, '') + '?';
    const a = match[2].trim().replace(/\n+/g, ' ');
    if (q && a) pairs.push({ q, a });
  }
  return pairs;
}

// Safe, no-external-dep markdown → HTML converter
// Only produces a strict allowlist of tags; no raw HTML pass-through
function safeMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Escape HTML entities first to prevent XSS
    line = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Headings
    if (line.startsWith('### ')) {
      out.push(`<h3 class="text-xl font-semibold mt-6 mb-2">${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(`<h2 class="text-2xl font-bold mt-8 mb-3">${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(`<h1 class="text-3xl font-bold mt-8 mb-4">${line.slice(2)}</h1>`);
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      out.push('');
      continue;
    }

    // Inline: bold, italic, links (only http/https)
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    line = line.replace(/\[([^\]<>]+)\]\((https?:\/\/[^\s)<>"]+)\)/g,
      '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>');

    out.push(`<p class="mb-4">${line}</p>`);
  }

  return out.join('\n');
}

export default function BlogPost() {
  const { language } = useI18n();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const lang = language;

  const { data: tenant } = useQuery<Tenant>({ queryKey: ['/api/tenant'] });
  const { data, isLoading, isError } = useQuery<BlogPostDetail>({
    queryKey: ['/api/blog', lang, slug],
    queryFn: () => fetch(`/api/blog/${slug}?lang=${lang}`).then(async r => {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    }),
    enabled: !!slug,
    retry: false,
  });

  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  // Inject meta tags for blog post (title, description, OG image)
  useEffect(() => {
    if (!data?.translation) return;
    const t = data.translation;
    const p = data.post;

    if (t.metaTitle) document.title = t.metaTitle;

    const desc = document.getElementById('seo-description') as HTMLMetaElement | null;
    if (desc && t.metaDesc) desc.content = t.metaDesc;

    // OG image — inject or update dynamically
    if (p.featuredImageUrl) {
      const absoluteImg = p.featuredImageUrl.startsWith('http')
        ? p.featuredImageUrl
        : `${window.location.origin}${p.featuredImageUrl}`;

      const setMeta = (property: string, content: string) => {
        let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('property', property);
          document.head.appendChild(el);
        }
        el.content = content;
      };

      setMeta('og:image', absoluteImg);
      setMeta('og:image:width', '1200');
      setMeta('og:image:height', '630');

      const altText = p.featuredImageAltByLang?.[lang]
        || p.featuredImageAltByLang?.['en']
        || t.title;
      setMeta('og:image:alt', altText);

      // Twitter card image
      let twImg = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
      if (!twImg) {
        twImg = document.createElement('meta');
        twImg.setAttribute('name', 'twitter:image');
        document.head.appendChild(twImg);
      }
      twImg.content = absoluteImg;
    }
  }, [data, lang]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-xl font-semibold">Article not found.</p>
        <Link href={`${langPrefix}/blog`} className="text-primary underline">← Back to Blog</Link>
      </div>
    );
  }

  const { post, translation, alternates } = data;
  const safeHtml = safeMarkdownToHtml(translation.content);
  const faqPairs = parseFaqFromMarkdown(translation.content);

  const featuredAlt = post.featuredImageAltByLang?.[lang]
    || post.featuredImageAltByLang?.['en']
    || translation.title;

  const absoluteFeaturedImg = post.featuredImageUrl
    ? (post.featuredImageUrl.startsWith('http')
      ? post.featuredImageUrl
      : `${window.location.origin}${post.featuredImageUrl}`)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* hreflang for blog post alternates */}
      {alternates && Object.entries(alternates).map(([l, s]) => {
        const href = `${window.location.origin}${l === 'en' ? '' : `/${l}`}/blog/${s}`;
        return <link key={l} rel="alternate" hrefLang={l} href={href} />;
      })}

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`${langPrefix}/blog`} className="text-primary font-semibold hover:underline">
            ← Blog
          </Link>
          {tenant && (
            <span className="text-muted-foreground text-sm">/ {tenant.universityName}</span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3" data-testid="blog-post-title">
              {translation.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(post.publishAt || post.createdAt)}
              {post.keyword && (
                <span className="ml-3 inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {post.keyword}
                </span>
              )}
            </p>

            {/* Featured image */}
            {post.featuredImageUrl && (
              <div className="mt-6 rounded-xl overflow-hidden shadow-md" data-testid="blog-featured-image">
                <img
                  src={post.featuredImageUrl}
                  alt={featuredAlt}
                  className="w-full aspect-video object-cover"
                  loading="eager"
                />
              </div>
            )}
          </header>

          <div
            className="prose prose-neutral max-w-none text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
            data-testid="blog-post-content"
          />
        </article>

        {/* ── JSON-LD: BlogPosting (Article) ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              '@id': `${window.location.origin}${window.location.pathname}#article`,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': window.location.href,
              },
              url: window.location.href,
              headline: translation.title,
              description: translation.metaDesc || undefined,
              articleSection: post.keyword || 'University',
              keywords: post.keyword || undefined,
              wordCount: translation.content.split(/\s+/).filter(Boolean).length,
              inLanguage: lang,
              ...(absoluteFeaturedImg ? {
                image: {
                  '@type': 'ImageObject',
                  url: absoluteFeaturedImg,
                  width: 1200,
                  height: 630,
                  caption: featuredAlt,
                },
              } : {}),
              datePublished: post.publishAt || post.createdAt,
              dateModified: post.publishAt || post.createdAt,
              author: {
                '@type': 'Organization',
                name: tenant?.universityName || 'University',
                ...(tenant?.logoUrl ? { logo: `${window.location.origin}${tenant.logoUrl}` } : {}),
              },
              publisher: {
                '@type': 'Organization',
                name: tenant?.universityName || 'University',
                ...(tenant?.logoUrl ? {
                  logo: {
                    '@type': 'ImageObject',
                    url: `${window.location.origin}${tenant.logoUrl}`,
                    width: 200,
                    height: 60,
                  },
                } : {}),
              },
            }),
          }}
        />

        {/* ── JSON-LD: BreadcrumbList ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: tenant?.universityName || 'Home',
                  item: `${window.location.origin}${lang === 'en' ? '' : `/${lang}`}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Blog',
                  item: `${window.location.origin}${lang === 'en' ? '' : `/${lang}`}/blog`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: translation.title,
                  item: window.location.href,
                },
              ],
            }),
          }}
        />

        {/* ── JSON-LD: FAQPage (only when FAQ pairs are parsed from content) ── */}
        {faqPairs.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faqPairs.map(({ q, a }) => ({
                  '@type': 'Question',
                  name: q,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: a,
                  },
                })),
              }),
            }}
          />
        )}
      </main>
    </div>
  );
}
