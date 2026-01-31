import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import AdminLayout from './AdminLayout';

const mockWebhookLogs = [
  { id: '1', type: 'application_submitted', status: 'delivered', timestamp: '2025-01-31 14:30:00' },
  { id: '2', type: 'application_submitted', status: 'delivered', timestamp: '2025-01-31 13:15:00' },
  { id: '3', type: 'application_submitted', status: 'failed', timestamp: '2025-01-31 12:00:00' },
];

const mockEmailLogs = [
  { id: '1', to: 'student@example.com', subject: 'Application Received', status: 'sent', timestamp: '2025-01-31 14:30:00' },
  { id: '2', to: 'another@example.com', subject: 'Application Received', status: 'sent', timestamp: '2025-01-31 13:15:00' },
];

export default function Logs() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'retrying':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      retrying: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Delivery Logs</h1>
          <p className="text-muted-foreground">Monitor webhook and email deliveries</p>
        </div>

        <Tabs defaultValue="webhooks">
          <TabsList>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Deliveries</CardTitle>
                <CardDescription>
                  All webhook deliveries to portal.findandstudy.com
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mockWebhookLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No webhook deliveries yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {mockWebhookLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`webhook-log-${log.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <p className="font-medium text-sm">{log.type}</p>
                            <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                          </div>
                        </div>
                        {getStatusBadge(log.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Deliveries</CardTitle>
                <CardDescription>All sent email notifications</CardDescription>
              </CardHeader>
              <CardContent>
                {mockEmailLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No emails sent yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {mockEmailLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`email-log-${log.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <p className="font-medium text-sm">{log.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              To: {log.to} • {log.timestamp}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(log.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
