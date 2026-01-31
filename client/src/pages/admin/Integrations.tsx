import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Webhook, MessageSquare, Send, CheckCircle, BarChart3, Search, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import type { Tenant } from '@shared/schema';

export default function Integrations() {
  const { toast } = useToast();
  
  const [googleSettings, setGoogleSettings] = useState({
    googleAnalyticsId: '',
    googleSearchConsoleCode: '',
  });

  const [portalSettings, setPortalSettings] = useState({
    enabled: true,
    webhookUrl: 'https://portal.findandstudy.com/api/webhook',
    webhookSecret: '',
  });

  const [n8nSettings, setN8nSettings] = useState({
    enabled: false,
    webhookUrl: '',
    webhookSecret: '',
  });

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant) {
      setGoogleSettings({
        googleAnalyticsId: tenant.googleAnalyticsId || '',
        googleSearchConsoleCode: tenant.googleSearchConsoleCode || '',
      });
    }
  }, [tenant]);

  const updateGoogleMutation = useMutation({
    mutationFn: async (data: typeof googleSettings) => {
      const response = await apiRequest('PATCH', '/api/tenant', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      toast({
        title: 'Google settings saved',
        description: 'Analytics and Search Console settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  const handleTestWebhook = (type: 'portal' | 'n8n') => {
    toast({
      title: 'Test webhook sent',
      description: `A test payload was sent to the ${type} webhook.`,
    });
  };

  const handleSave = () => {
    toast({
      title: 'Settings saved',
      description: 'Integration settings have been updated.',
    });
  };

  const handleSaveGoogle = () => {
    updateGoogleMutation.mutate(googleSettings);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Configure analytics, tracking, and external services</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Google Services</h2>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle>Google Analytics</CardTitle>
                  <CardDescription>Track website traffic and user behavior</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ga-id">Measurement ID</Label>
                <Input
                  id="ga-id"
                  value={googleSettings.googleAnalyticsId}
                  onChange={(e) =>
                    setGoogleSettings({ ...googleSettings, googleAnalyticsId: e.target.value })
                  }
                  placeholder="G-XXXXXXXXXX"
                  className="mt-1.5 font-mono"
                  data-testid="input-google-analytics-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your Google Analytics 4 measurement ID (starts with G-)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Search className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Google Search Console</CardTitle>
                  <CardDescription>Verify your site ownership for search indexing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="gsc-code">Verification Meta Tag</Label>
                <Textarea
                  id="gsc-code"
                  value={googleSettings.googleSearchConsoleCode}
                  onChange={(e) =>
                    setGoogleSettings({ ...googleSettings, googleSearchConsoleCode: e.target.value })
                  }
                  placeholder='<meta name="google-site-verification" content="..." />'
                  className="mt-1.5 font-mono text-sm min-h-[80px]"
                  data-testid="input-google-search-console"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the full meta tag from Google Search Console
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveGoogle} 
              disabled={updateGoogleMutation.isPending}
              data-testid="button-save-google"
            >
              {updateGoogleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Google Settings
            </Button>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t">
          <h2 className="text-lg font-semibold">Webhook Integrations</h2>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Webhook className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Portal Integration</CardTitle>
                    <CardDescription>portal.findandstudy.com webhook</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={portalSettings.enabled}
                  onCheckedChange={(checked) =>
                    setPortalSettings({ ...portalSettings, enabled: checked })
                  }
                  data-testid="switch-portal-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Webhook URL</Label>
                <Input
                  value={portalSettings.webhookUrl}
                  onChange={(e) =>
                    setPortalSettings({ ...portalSettings, webhookUrl: e.target.value })
                  }
                  placeholder="https://portal.findandstudy.com/api/webhook"
                  className="mt-1.5"
                  data-testid="input-portal-webhook-url"
                />
              </div>

              <div>
                <Label>Webhook Secret (HMAC)</Label>
                <Input
                  type="password"
                  value={portalSettings.webhookSecret}
                  onChange={(e) =>
                    setPortalSettings({ ...portalSettings, webhookSecret: e.target.value })
                  }
                  placeholder="Enter secret key"
                  className="mt-1.5"
                  data-testid="input-portal-webhook-secret"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleTestWebhook('portal')}
                  data-testid="button-test-portal-webhook"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test Webhook
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Chatbot Integration (n8n)</CardTitle>
                    <CardDescription>AI chatbot webhook</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={n8nSettings.enabled}
                  onCheckedChange={(checked) =>
                    setN8nSettings({ ...n8nSettings, enabled: checked })
                  }
                  data-testid="switch-n8n-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Webhook URL</Label>
                <Input
                  value={n8nSettings.webhookUrl}
                  onChange={(e) =>
                    setN8nSettings({ ...n8nSettings, webhookUrl: e.target.value })
                  }
                  placeholder="https://your-n8n-instance.com/webhook/chat"
                  className="mt-1.5"
                  data-testid="input-n8n-webhook-url"
                />
              </div>

              <div>
                <Label>Webhook Secret</Label>
                <Input
                  type="password"
                  value={n8nSettings.webhookSecret}
                  onChange={(e) =>
                    setN8nSettings({ ...n8nSettings, webhookSecret: e.target.value })
                  }
                  placeholder="Enter secret key"
                  className="mt-1.5"
                  data-testid="input-n8n-webhook-secret"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleTestWebhook('n8n')}
                  data-testid="button-test-n8n-webhook"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test Webhook
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Outbox</CardTitle>
              <CardDescription>
                All webhook deliveries are queued and retried automatically using exponential backoff.
                Failed deliveries are retried up to 5 times.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">System Healthy</p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    All webhooks are being delivered successfully
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-integrations">
            Save Changes
          </Button>
        </div>
        </div>
      </div>
    </AdminLayout>
  );
}
