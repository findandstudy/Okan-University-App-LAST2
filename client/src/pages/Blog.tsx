import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { Tenant } from '@shared/schema';
import SEOMetaTags from '@/components/SEOMetaTags';

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
  });

  const langPrefix = language === 'en' ? '' : `/${language}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOMetaTags lang={language as any} />

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`${langPrefix}/`} className="text-primary font-semibold hover:underline">
            ← {tenant?.universityName || 'Home'}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-2">Blog</h1>
        <p className="text-muted-foreground mb-10">
          {tenant?.universityName} — Articles for international students
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
    </div>
  );
}
