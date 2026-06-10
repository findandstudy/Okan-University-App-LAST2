import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { Tenant } from '@shared/schema';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

interface BlogPostDetail {
  post: {
    id: string;
    publishAt: string | null;
    createdAt: string;
    keyword: string | null;
  };
  translation: {
    title: string;
    slug: string;
    content: string;
    metaTitle: string | null;
    metaDesc: string | null;
    lang: string;
  };
  alternates?: Record<string, string>; // lang -> slug
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith('<')) return line;
      return line;
    });
}

export default function BlogPost() {
  const { language } = useI18n();
  const params = useParams<{ slug: string; lang?: string }>();
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

  // Inject meta tags for blog post
  if (data?.translation) {
    const t = data.translation;
    if (t.metaTitle) document.title = t.metaTitle;
    const desc = document.querySelector('meta#seo-description') as HTMLMetaElement | null;
    if (desc && t.metaDesc) desc.content = t.metaDesc;
  }

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

  return (
    <div className="min-h-screen bg-background">
      {/* hreflang for blog post alternates */}
      {alternates && Object.entries(alternates).map(([l, s]) => {
        const href = `${window.location.origin}${l === 'en' ? '' : `/${l}`}/blog/${s}`;
        return (
          <link key={l} rel="alternate" hrefLang={l} href={href} />
        );
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
          </header>

          <div
            className="prose prose-neutral max-w-none text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: `<p class="mb-4">${renderMarkdown(translation.content)}</p>`,
            }}
            data-testid="blog-post-content"
          />
        </article>

        {/* JSON-LD Article schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: translation.title,
              description: translation.metaDesc || undefined,
              datePublished: post.publishAt || post.createdAt,
              dateModified: post.publishAt || post.createdAt,
              author: {
                '@type': 'Organization',
                name: tenant?.universityName || 'University',
              },
              publisher: {
                '@type': 'Organization',
                name: tenant?.universityName || 'University',
              },
              inLanguage: lang,
              keywords: post.keyword || undefined,
            }),
          }}
        />
      </main>
    </div>
  );
}
