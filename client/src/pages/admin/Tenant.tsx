import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Building, Globe, Upload, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import type { Tenant } from '@shared/schema';

export default function TenantPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    universityName: '',
    domain: '',
    logoUrl: '',
    faviconUrl: '',
  });

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant) {
      setSettings({
        universityName: tenant.universityName || '',
        domain: tenant.domain || '',
        logoUrl: tenant.logoUrl || '',
        faviconUrl: tenant.faviconUrl || '',
      });
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const response = await apiRequest('PATCH', '/api/tenant', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      toast({
        title: 'Settings saved',
        description: 'Tenant settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
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
          <h1 className="text-2xl font-bold">Tenant Settings</h1>
          <p className="text-muted-foreground">Configure your university identity</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>University Identity</CardTitle>
            <CardDescription>Basic information about your institution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>University Name</Label>
              <Input
                value={settings.universityName}
                onChange={(e) =>
                  setSettings({ ...settings, universityName: e.target.value })
                }
                placeholder="e.g., Okan University"
                className="mt-1.5"
                data-testid="input-university-name"
              />
            </div>

            <div>
              <Label>Domain</Label>
              <div className="relative mt-1.5">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={settings.domain}
                  onChange={(e) =>
                    setSettings({ ...settings, domain: e.target.value })
                  }
                  placeholder="okanuniversity.app"
                  className="pl-10"
                  data-testid="input-domain"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Logo URL</Label>
                <Input
                  value={settings.logoUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, logoUrl: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                  className="mt-1.5"
                  data-testid="input-logo-url"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter a URL to your logo image</p>
              </div>

              <div>
                <Label>Favicon URL</Label>
                <Input
                  value={settings.faviconUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, faviconUrl: e.target.value })
                  }
                  placeholder="https://example.com/favicon.ico"
                  className="mt-1.5"
                  data-testid="input-favicon-url"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter a URL to your favicon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-tenant"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
