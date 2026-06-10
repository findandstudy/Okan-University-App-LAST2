import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutList, Image, MessageSquareQuote, HelpCircle, Globe, ChevronRight, Palette } from 'lucide-react';
import AdminLayout from './AdminLayout';

interface Stats {
  sections: number;
  enabledSections: number;
  testimonials: number;
  faqItems: number;
  mediaAssets: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['/api/admin/stats'],
  });

  const statCards = [
    {
      title: 'Active Sections',
      value: stats ? `${stats.enabledSections}/${stats.sections}` : '—',
      icon: LayoutList,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Testimonials',
      value: stats?.testimonials ?? '—',
      icon: MessageSquareQuote,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'FAQ Items',
      value: stats?.faqItems ?? '—',
      icon: HelpCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      title: 'Media Assets',
      value: stats?.mediaAssets ?? '—',
      icon: Image,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  const quickActions = [
    {
      href: '/admin/hero',
      icon: Globe,
      title: 'Edit Landing Page',
      description: 'Update hero content and sections',
    },
    {
      href: '/admin/sections',
      icon: LayoutList,
      title: 'Manage Sections',
      description: 'Enable, disable, or reorder sections',
    },
    {
      href: '/admin/theme',
      icon: Palette,
      title: 'Customize Theme',
      description: 'Colors, fonts, and branding',
    },
    {
      href: '/admin/seo',
      icon: Globe,
      title: 'SEO Settings',
      description: 'Meta tags, Open Graph, sitemap',
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to your admin panel</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                data-testid={`link-quick-action-${action.href.split('/').pop()}`}
              >
                <action.icon className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
