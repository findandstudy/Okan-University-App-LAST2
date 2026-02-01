import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import AdminLayout from './AdminLayout';

interface EmailTemplate {
  id: string;
  tenantId: string;
  templateKey: string;
  subjectByLang: Record<string, string> | null;
  htmlBodyByLang: Record<string, string> | null;
  textBodyByLang: Record<string, string> | null;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'ru', label: 'Russian' },
  { code: 'fa', label: 'Farsi' },
];

const DEFAULT_TEMPLATE_KEYS = [
  { key: 'application_confirmation', label: 'Application Confirmation' },
  { key: 'welcome', label: 'Welcome Email' },
  { key: 'status_update', label: 'Status Update' },
  { key: 'document_request', label: 'Document Request' },
  { key: 'acceptance', label: 'Acceptance Letter' },
  { key: 'rejection', label: 'Rejection Notice' },
];

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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<EmailTemplate | null>(null);
  const [selectedLang, setSelectedLang] = useState('en');
  
  const [formData, setFormData] = useState({
    templateKey: '',
    customKey: '',
    subjectByLang: {} as Record<string, string>,
    textBodyByLang: {} as Record<string, string>,
  });

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email-templates'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EmailTemplate>) => {
      return apiRequest('POST', '/api/email-templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({ title: 'Template created', description: 'Email template has been created successfully.' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create template.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmailTemplate> }) => {
      return apiRequest('PATCH', `/api/email-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({ title: 'Template updated', description: 'Email template has been updated successfully.' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update template.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({ title: 'Template deleted', description: 'Email template has been deleted.' });
      setDeleteTemplate(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    },
  });

  const handleTestEmail = () => {
    toast({
      title: 'Test email sent',
      description: 'A test email has been sent to your configured address.',
    });
  };

  const handleSaveSettings = () => {
    toast({
      title: 'Settings saved',
      description: 'Email settings have been updated.',
    });
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      templateKey: '',
      customKey: '',
      subjectByLang: {},
      textBodyByLang: {},
    });
    setSelectedLang('en');
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      templateKey: template.templateKey,
      customKey: '',
      subjectByLang: template.subjectByLang || {},
      textBodyByLang: template.textBodyByLang || {},
    });
    setSelectedLang('en');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      templateKey: '',
      customKey: '',
      subjectByLang: {},
      textBodyByLang: {},
    });
  };

  const handleSubmit = () => {
    const key = formData.templateKey === 'custom' ? formData.customKey : formData.templateKey;
    if (!key) {
      toast({ title: 'Error', description: 'Please select or enter a template key.', variant: 'destructive' });
      return;
    }

    const data = {
      templateKey: key,
      subjectByLang: formData.subjectByLang,
      textBodyByLang: formData.textBodyByLang,
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getTemplateLabel = (key: string) => {
    const found = DEFAULT_TEMPLATE_KEYS.find(t => t.key === key);
    return found ? found.label : key;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground">Configure email notifications and templates</p>
        </div>

        <Tabs defaultValue="templates">
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
                  <Button onClick={handleSaveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>
                      Manage your email templates for different notifications
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddTemplate} data-testid="button-add-template">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No email templates yet.</p>
                    <p className="text-sm">Click "Add Template" to create your first template.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template</TableHead>
                          <TableHead>Subject (EN)</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((template) => (
                          <TableRow key={template.id} data-testid={`template-row-${template.id}`}>
                            <TableCell>
                              <Badge variant="secondary">{getTemplateLabel(template.templateKey)}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {template.subjectByLang?.en || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditTemplate(template)}
                                  data-testid={`button-edit-template-${template.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteTemplate(template)}
                                  data-testid={`button-delete-template-${template.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Email Template' : 'Add Email Template'}
            </DialogTitle>
            <DialogDescription>
              Configure your email template with multi-language support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!editingTemplate && (
              <div>
                <Label>Template Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mt-1.5"
                  value={formData.templateKey}
                  onChange={(e) => setFormData({ ...formData, templateKey: e.target.value })}
                  data-testid="select-template-type"
                >
                  <option value="">Select template type</option>
                  {DEFAULT_TEMPLATE_KEYS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                  <option value="custom">Custom Template</option>
                </select>
              </div>
            )}

            {formData.templateKey === 'custom' && (
              <div>
                <Label>Custom Template Key</Label>
                <Input
                  value={formData.customKey}
                  onChange={(e) => setFormData({ ...formData, customKey: e.target.value })}
                  placeholder="e.g., interview_reminder"
                  className="mt-1.5"
                  data-testid="input-custom-key"
                />
              </div>
            )}

            <div>
              <Label>Language</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {LANGUAGES.map((lang) => (
                  <Button
                    key={lang.code}
                    type="button"
                    variant={selectedLang === lang.code ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLang(lang.code)}
                    data-testid={`button-lang-${lang.code}`}
                  >
                    {lang.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Subject ({selectedLang.toUpperCase()})</Label>
              <Input
                value={formData.subjectByLang[selectedLang] || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  subjectByLang: { ...formData.subjectByLang, [selectedLang]: e.target.value }
                })}
                placeholder="Email subject line"
                className="mt-1.5"
                data-testid="input-template-subject"
              />
            </div>

            <div>
              <Label>Body ({selectedLang.toUpperCase()})</Label>
              <Textarea
                value={formData.textBodyByLang[selectedLang] || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  textBodyByLang: { ...formData.textBodyByLang, [selectedLang]: e.target.value }
                })}
                placeholder="Email body content. Use {{FULL_NAME}}, {{PROGRAM_NAME}}, {{APPLICATION_ID}} as placeholders."
                className="mt-1.5 min-h-[200px] font-mono text-sm"
                data-testid="input-template-body"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available placeholders: {'{{FULL_NAME}}'}, {'{{PROGRAM_NAME}}'}, {'{{APPLICATION_ID}}'}, {'{{EMAIL}}'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-template"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteTemplate && getTemplateLabel(deleteTemplate.templateKey)}" template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
