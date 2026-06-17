import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { Tenant } from '@shared/schema';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

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

// Safe, no-external-dep markdown → HTML converter
// Only produces a strict allowlist of tags; no raw HTML pass-through
function safeMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const tag = listType;
    const cls = tag === 'ul'
      ? 'list-disc pl-6 mb-4 space-y-1'
      : 'list-decimal pl-6 mb-4 space-y-1';
    out.push(`<${tag} class="${cls}">`);
    for (const item of listItems) {
      out.push(`  <li>${item}</li>`);
    }
    out.push(`</${tag}>`);
    listType = null;
    listItems = [];
  };

  const applyInline = (text: string): string => {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(
      /\[([^\]<>]+)\]\((https?:\/\/[^\s)<>"]+)\)/g,
      '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    return text;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Escape HTML entities first to prevent XSS
    line = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Headings — flush any open list first
    if (line.startsWith('### ')) {
      flushList();
      out.push(`<h3 class="text-xl font-semibold mt-6 mb-2">${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2 class="text-2xl font-bold mt-8 mb-3">${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      out.push(`<h1 class="text-3xl font-bold mt-8 mb-4">${line.slice(2)}</h1>`);
      continue;
    }

    // Unordered list items: - item  or  * item
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(applyInline(ulMatch[1]));
      continue;
    }

    // Ordered list items: 1. item  2. item  etc.
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(applyInline(olMatch[1]));
      continue;
    }

    // Empty line = paragraph break — flush list if open
    if (line.trim() === '') {
      flushList();
      out.push('');
      continue;
    }

    // Non-list line — flush any open list, then emit paragraph
    flushList();
    line = applyInline(line);
    out.push(`<p class="mb-4">${line}</p>`);
  }

  // Flush any list still open at end of content
  flushList();

  return out.join('\n');
}

export default function BlogPost() {
  const { language } = useI18n();
  const params = useParams<{ lang?: string; slug: string }>();
  const slug = params.slug;
  // Prefer the lang embedded in the URL (/:lang/blog/:slug) so cross-language
  // slugs like /ar/blog/arapca-slug are fetched with the correct lang even when
  // the user's localStorage language differs.
  const lang = params.lang || language;

  const { data: tenant } = useQuery<Tenant>({ queryKey: ['/api/tenant'] });
  const { data, isLoading, isError } = useQuery<BlogPostDetail>({
    queryKey: ['/api/blog', lang, slug],
    queryFn: () => fetch(`/api/blog/${slug}?lang=${lang}`, { credentials: 'include' }).then(async r => {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    }),
    enabled: !!slug,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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

  const featuredAlt = post.featuredImageAltByLang?.[lang]
    || post.featuredImageAltByLang?.['en']
    || translation.title;

  const universityName = tenant?.universityName || 'University';
  const logoUrl = tenant?.logoUrl || '';

  // Inject hreflang <link> elements into <head> (not body) for valid HTML + bots
  useEffect(() => {
    if (!alternates) return;
    const inserted: HTMLLinkElement[] = [];
    for (const [l, s] of Object.entries(alternates)) {
      const href = `${window.location.origin}${l === 'en' ? '' : `/${l}`}/blog/${s}`;
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = l;
      link.href = href;
      document.head.appendChild(link);
      inserted.push(link);
    }
    // x-default → English or first available
    const xHref = alternates['en']
      ? `${window.location.origin}/blog/${alternates['en']}`
      : Object.entries(alternates)[0]
        ? `${window.location.origin}/${Object.entries(alternates)[0][0]}/blog/${Object.entries(alternates)[0][1]}`
        : null;
    if (xHref) {
      const xLink = document.createElement('link');
      xLink.rel = 'alternate';
      xLink.hreflang = 'x-default';
      xLink.href = xHref;
      document.head.appendChild(xLink);
      inserted.push(xLink);
    }
    return () => { inserted.forEach(el => el.parentNode?.removeChild(el)); };
  }, [alternates]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header universityName={universityName} logoUrl={logoUrl} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
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

      </main>

      <Footer
        universityName={universityName}
        logoUrl={logoUrl}
        facebookUrl={(tenant as any)?.facebookUrl}
        instagramUrl={(tenant as any)?.instagramUrl}
        linkedinUrl={(tenant as any)?.linkedinUrl}
        youtubeUrl={(tenant as any)?.youtubeUrl}
      />
    </div>
  );
}
