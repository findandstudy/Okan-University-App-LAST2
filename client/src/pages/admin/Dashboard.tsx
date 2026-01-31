import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, GraduationCap, Users, TrendingUp, ChevronRight } from 'lucide-react';
import type { Program, Application } from '@shared/schema';
import AdminLayout from './AdminLayout';

export default function Dashboard() {
  const { data: programs = [], isLoading: programsLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: applications = [], isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
  });

  const stats = [
    {
      title: 'Total Programs',
      value: programs.length,
      icon: GraduationCap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Applications',
      value: applications.length,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Pending Review',
      value: applications.filter((a) => a.status === 'submitted').length,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      title: 'Conversion Rate',
      value: '78%',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  const recentApplications = applications.slice(0, 5);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to your admin panel</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    {programsLoading || applicationsLoading ? (
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

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentApplications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No applications yet</p>
              ) : (
                <div className="space-y-3">
                  {recentApplications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/admin/applications?view=${app.id}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer"
                      data-testid={`link-application-${app.id.slice(0, 8)}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Application #{app.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(app.createdAt!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            app.status === 'submitted'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {app.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="/admin/programs"
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate"
              >
                <GraduationCap className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Manage Programs</p>
                  <p className="text-sm text-muted-foreground">Add, edit, or remove programs</p>
                </div>
              </a>

              <a
                href="/admin/applications"
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate"
              >
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Review Applications</p>
                  <p className="text-sm text-muted-foreground">Process pending applications</p>
                </div>
              </a>

              <a
                href="/admin/integrations"
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate"
              >
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Configure Integrations</p>
                  <p className="text-sm text-muted-foreground">Set up webhooks and APIs</p>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
