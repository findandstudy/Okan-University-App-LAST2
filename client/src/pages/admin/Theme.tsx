import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';
import type { TenantTheme } from '@shared/schema';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

const FONT_OPTIONS = ['Inter', 'Open Sans', 'Roboto', 'Poppins', 'Montserrat'];
const BUTTON_STYLES = ['rounded', 'pill', 'square'];

export default function Theme({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);
  const [settings, setSettings] = useState({
    primaryColor: '#2563eb',
    secondaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    fontFamily: 'Inter',
    buttonStyle: 'rounded',
  });

  const { data: theme, isLoading } = useQuery<TenantTheme>({
    queryKey: ['/api/theme' + apiSuffix],
  });

  useEffect(() => {
    if (theme) {
      setSettings({
        primaryColor: theme.primaryColor || '#2563eb',
        secondaryColor: theme.secondaryColor || '#3b82f6',
        backgroundColor: theme.backgroundColor || '#ffffff',
        textColor: theme.textColor || '#1f2937',
        fontFamily: theme.fontFamily || 'Inter',
        buttonStyle: theme.buttonStyle || 'rounded',
      });
    }
  }, [theme]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const response = await apiRequest('PATCH', '/api/theme' + apiSuffix, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/theme' + apiSuffix] });
      toast({
        title: 'Theme saved',
        description: 'Theme settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save theme',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <EmbeddableLayout embedded={embedded}>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </EmbeddableLayout>
    );
  }

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Theme Settings</h1>
          <p className="text-muted-foreground">Customize the look and feel of your landing page</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
              <CardDescription>Define your brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, primaryColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, primaryColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-primary-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Secondary Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, secondaryColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, secondaryColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-secondary-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Background Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        setSettings({ ...settings, backgroundColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        setSettings({ ...settings, backgroundColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-background-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Text Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.textColor}
                      onChange={(e) =>
                        setSettings({ ...settings, textColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.textColor}
                      onChange={(e) =>
                        setSettings({ ...settings, textColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-text-color"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography & Buttons</CardTitle>
              <CardDescription>Font and button styling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Font Family</Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) =>
                    setSettings({ ...settings, fontFamily: value })
                  }
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-font-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Button Style</Label>
                <Select
                  value={settings.buttonStyle}
                  onValueChange={(value) =>
                    setSettings({ ...settings, buttonStyle: value })
                  }
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-button-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Label className="text-muted-foreground">Preview</Label>
                <div className="mt-2 p-4 border rounded-lg">
                  <Button style={{ backgroundColor: settings.primaryColor }}>
                    Primary Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-theme"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </EmbeddableLayout>
  );
}
