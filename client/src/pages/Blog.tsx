import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { Tenant } from '@shared/schema';
import SEOMetaTags from '@/components/SEOMetaTags';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

interface BlogListItem {
  post: {
    id: string;
    publishAt: string | null;
    createdAt: string;
  };
  translation: {
    title: string;
    slug: string;
    metaDesc: string | null;
  };
}

export default function Blog() {
  const { language } = useI18n();
  const { data: tenant } = useQuery<Tenant>({ queryKey: ['/api/tenant'] });
  const { data: posts = [], isLoading } = useQuery<BlogListItem[]>({
    queryKey: ['/api/blog', language],
    queryFn: () => fetch(`/api/blog?lang=${language}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const langPrefix = language === 'en' ? '' : `/${language}`;
  const universityName = tenant?.universityName || 'University';
  const logoUrl = tenant?.logoUrl || '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOMetaTags lang={language as any} />

      <Header universityName={universityName} logoUrl={logoUrl} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-2">Blog</h1>
        <p className="text-muted-foreground mb-10">
          {universityName} — Articles for international students
        </p>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border bg-card p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No articles published yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(({ post, translation }) => (
              <Link
                key={post.id}
                href={`${langPrefix}/blog/${translation.slug}`}
                data-testid={`blog-card-${post.id}`}
                className="group block rounded-xl border bg-card p-6 hover:shadow-md transition-shadow"
              >
                <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                  {translation.title}
                </h2>
                {translation.metaDesc && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {translation.metaDesc}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDate(post.publishAt || post.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer
        universityName={universityName}
        logoUrl={logoUrl}
        facebookUrl={(tenant as any)?.facebookUrl}
        instagramUrl={(tenant as any)?.instagramUrl}
        linkedinUrl={(tenant as any)?.linkedinUrl}
        youtubeUrl={(tenant as any)?.youtubeUrl}
      />

      {/* ── JSON-LD: Blog + ItemList ── */}
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Blog',
              name: `${universityName} Blog`,
              description: `Articles for international students by ${universityName}`,
              url: `${window.location.origin}${langPrefix}/blog`,
              inLanguage: language,
              publisher: {
                '@type': 'Organization',
                name: universityName,
              },
              blogPost: posts.map(({ post, translation }) => ({
                '@type': 'BlogPosting',
                headline: translation.title,
                description: translation.metaDesc || undefined,
                url: `${window.location.origin}${langPrefix}/blog/${translation.slug}`,
                datePublished: post.publishAt || post.createdAt,
              })),
            }),
          }}
        />
      )}

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
                name: universityName,
                item: `${window.location.origin}${langPrefix}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                item: `${window.location.origin}${langPrefix}/blog`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
