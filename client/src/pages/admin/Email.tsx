import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send } from 'lucide-react';
import AdminLayout from './AdminLayout';

export default function Email() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: true,
    provider: 'smtp',
    smtpHost: 'smtp.example.com',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: 'apply@okanuniversity.app',
    fromName: 'Okan University Admissions',
  });

  const handleTestEmail = () => {
    toast({
      title: 'Test email sent',
      description: 'A test email has been sent to your configured address.',
    });
  };

  const handleSave = () => {
    toast({
      title: 'Settings saved',
      description: 'Email settings have been updated.',
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground">Configure email notifications and templates</p>
        </div>

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>SMTP Configuration</CardTitle>
                    <CardDescription>Configure your email delivery settings</CardDescription>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enabled: checked })
                    }
                    data-testid="switch-email-enabled"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>SMTP Host</Label>
                    <Input
                      value={settings.smtpHost}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpHost: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-smtp-host"
                    />
                  </div>
                  <div>
                    <Label>SMTP Port</Label>
                    <Input
                      value={settings.smtpPort}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpPort: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-smtp-port"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>SMTP Username</Label>
                    <Input
                      value={settings.smtpUser}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpUser: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-smtp-user"
                    />
                  </div>
                  <div>
                    <Label>SMTP Password</Label>
                    <Input
                      type="password"
                      value={settings.smtpPassword}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpPassword: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-smtp-password"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>From Email</Label>
                    <Input
                      value={settings.fromEmail}
                      onChange={(e) =>
                        setSettings({ ...settings, fromEmail: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-from-email"
                    />
                  </div>
                  <div>
                    <Label>From Name</Label>
                    <Input
                      value={settings.fromName}
                      onChange={(e) =>
                        setSettings({ ...settings, fromName: e.target.value })
                      }
                      className="mt-1.5"
                      data-testid="input-from-name"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={handleTestEmail}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Confirmation Email</CardTitle>
                <CardDescription>
                  Sent to students when they submit an application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Subject (English)</Label>
                  <Input
                    defaultValue="Your Application Has Been Received - Okan University"
                    className="mt-1.5"
                    data-testid="input-email-subject"
                  />
                </div>
                <div>
                  <Label>Body (English)</Label>
                  <Textarea
                    defaultValue={`Dear {{FULL_NAME}},

Thank you for your application to {{PROGRAM_NAME}} at Okan University.

Your application has been received and is being reviewed by our admissions team. We will contact you within 48 hours with an update.

Application ID: {{APPLICATION_ID}}

Best regards,
Okan University Admissions Team`}
                    className="mt-1.5 min-h-[200px] font-mono text-sm"
                    data-testid="input-email-body"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-email">
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
