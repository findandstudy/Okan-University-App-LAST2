import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Globe, Upload } from 'lucide-react';
import AdminLayout from './AdminLayout';

export default function Tenant() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    universityName: 'Okan University',
    domain: 'okanuniversity.app',
    logoUrl: '',
    faviconUrl: '',
  });

  const handleSave = () => {
    toast({
      title: 'Settings saved',
      description: 'Tenant settings have been updated.',
    });
  };

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
                <Label>Logo</Label>
                <div className="mt-1.5 border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload logo</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                </div>
              </div>

              <div>
                <Label>Favicon</Label>
                <div className="mt-1.5 border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload favicon</p>
                  <p className="text-xs text-muted-foreground">ICO, PNG up to 500KB</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-tenant">
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
