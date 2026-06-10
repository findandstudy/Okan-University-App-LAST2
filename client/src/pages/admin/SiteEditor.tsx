import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { SiteProvider } from '@/lib/siteContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Globe, Power, PowerOff, Plus, Trash2, Pencil, Loader2, Code, Link as LinkIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Sections from './Sections';
import FAQ from './FAQ';
import Testimonials from './Testimonials';
import Theme from './Theme';
import SEOSettings from './SEOSettings';
import HeroContent from './HeroContent';
import WhyChooseUs from './WhyChooseUs';
import ContactInfo from './ContactInfo';
import FooterContent from './FooterContent';
import { Construction, Upload } from 'lucide-react';
import type { Tenant, Widget } from '@shared/schema';

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Construction className="h-10 w-10 text-muted-foreground opacity-50" />
        <div>
          <p className="font-semibold text-lg">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <p className="text-xs text-muted-foreground">Coming soon</p>
      </CardContent>
    </Card>
  );
}

function TenantSettingsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/admin/tenants', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tenant');
      return res.json();
    },
  });
  const [form, setForm] = useState({ universityName: '', domain: '', facebookUrl: '', instagramUrl: '', linkedinUrl: '', youtubeUrl: '' });
  useEffect(() => {
    if (tenant) setForm({
      universityName: tenant.universityName ?? '',
      domain: tenant.domain ?? '',
      facebookUrl: (tenant as any).facebookUrl ?? '',
      instagramUrl: (tenant as any).instagramUrl ?? '',
      linkedinUrl: (tenant as any).linkedinUrl ?? '',
      youtubeUrl: (tenant as any).youtubeUrl ?? '',
    });
  }, [tenant]);
  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('PATCH', `/api/admin/tenants/${tenantId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site settings saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' }),
  });
  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return (
    <Card>
      <CardHeader><CardTitle>Site Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="universityName">University Name</Label>
            <Input id="universityName" value={form.universityName} onChange={e => setForm(p => ({ ...p, universityName: e.target.value }))} data-testid="input-university-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} data-testid="input-domain" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook">Facebook URL</Label>
            <Input id="facebook" value={form.facebookUrl} onChange={e => setForm(p => ({ ...p, facebookUrl: e.target.value }))} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram URL</Label>
            <Input id="instagram" value={form.instagramUrl} onChange={e => setForm(p => ({ ...p, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn URL</Label>
            <Input id="linkedin" value={form.linkedinUrl} onChange={e => setForm(p => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube URL</Label>
            <Input id="youtube" value={form.youtubeUrl} onChange={e => setForm(p => ({ ...p, youtubeUrl: e.target.value }))} placeholder="https://youtube.com/..." />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-settings">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TenantMediaTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaItems = [], isLoading, refetch } = useQuery<Array<{ id: string; url: string; filename: string; mimeType: string }>>({
    queryKey: ['/api/media', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/media?_tid=${tenantId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/media/${id}?_tid=${tenantId}`);
    },
    onSuccess: () => { refetch(); toast({ title: 'File deleted' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to delete file', variant: 'destructive' }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/upload?_tid=${tenantId}`, { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      refetch();
      toast({ title: 'File uploaded' });
    } catch {
      toast({ title: 'Error', description: 'Failed to upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Media Library</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="button-upload-media">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,application/pdf" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : mediaItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No media files yet. Upload your first file.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {mediaItems.map(item => (
              <div key={item.id} className="relative group border rounded overflow-hidden" data-testid={`media-item-${item.id}`}>
                {item.mimeType?.startsWith('image/') ? (
                  <img src={item.url} alt={item.filename} className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center bg-muted text-xs text-muted-foreground">{item.filename}</div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  yayinda: 'default',
  taslak: 'secondary',
  askiya_alindi: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  yayinda: 'Published',
  taslak: 'Draft',
  askiya_alindi: 'Suspended',
};

interface WidgetForm {
  name: string;
  sectionKey: string;
  embedCode: string;
  iframeUrl: string;
  isEnabled: boolean;
  displayOrder: number;
}

const emptyWidget: WidgetForm = {
  name: '',
  sectionKey: 'widget',
  embedCode: '',
  iframeUrl: '',
  isEnabled: true,
  displayOrder: 0,
};

function WidgetManager({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [form, setForm] = useState<WidgetForm>(emptyWidget);

  const { data: widgets = [], isLoading } = useQuery<Widget[]>({
    queryKey: ['/api/admin/widgets', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/widgets?_tid=${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch widgets');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WidgetForm) => {
      const res = await apiRequest('POST', `/api/admin/widgets?_tid=${tenantId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/widgets', tenantId] });
      toast({ title: 'Widget created' });
      setDialogOpen(false);
      setForm(emptyWidget);
    },
    onError: () => toast({ title: 'Failed to create widget', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WidgetForm> }) => {
      const res = await apiRequest('PATCH', `/api/admin/widgets/${id}?_tid=${tenantId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/widgets', tenantId] });
      toast({ title: 'Widget updated' });
      setDialogOpen(false);
      setEditingWidget(null);
      setForm(emptyWidget);
    },
    onError: () => toast({ title: 'Failed to update widget', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/widgets/${id}?_tid=${tenantId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/widgets', tenantId] });
      toast({ title: 'Widget deleted' });
    },
    onError: () => toast({ title: 'Failed to delete widget', variant: 'destructive' }),
  });

  const handleOpenEdit = (w: Widget) => {
    setEditingWidget(w);
    setForm({
      name: w.name,
      sectionKey: w.sectionKey,
      embedCode: w.embedCode || '',
      iframeUrl: w.iframeUrl || '',
      isEnabled: w.isEnabled ?? true,
      displayOrder: w.displayOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingWidget) {
      updateMutation.mutate({ id: editingWidget.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Widgets</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={open => {
          setDialogOpen(open);
          if (!open) { setEditingWidget(null); setForm(emptyWidget); }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" data-testid="button-add-widget">
              <Plus className="h-4 w-4" />
              Add Widget
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingWidget ? 'Edit Widget' : 'Add Widget'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  data-testid="input-widget-name"
                  placeholder="e.g. Live Chat, Calendar Booking"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Code className="h-3 w-3" /> Embed Code</Label>
                <Textarea
                  data-testid="input-widget-embed"
                  placeholder="<script>...</script> or <div>...</div>"
                  className="font-mono text-xs"
                  rows={5}
                  value={form.embedCode}
                  onChange={e => setForm(p => ({ ...p, embedCode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> iFrame URL (alternative)</Label>
                <Input
                  data-testid="input-widget-iframe"
                  placeholder="https://..."
                  value={form.iframeUrl}
                  onChange={e => setForm(p => ({ ...p, iframeUrl: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  data-testid="button-save-widget"
                  onClick={handleSubmit}
                  disabled={isPending || !form.name}
                >
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingWidget ? 'Save' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : widgets.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-6">
            No widgets yet. Add an embed code or iframe to display on the landing page.
          </div>
        ) : (
          <div className="space-y-2">
            {widgets.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`widget-${w.id}`}>
                <div>
                  <p className="font-medium text-sm">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.iframeUrl ? `iframe: ${w.iframeUrl}` : w.embedCode ? 'Custom embed code' : 'No content'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(w)} data-testid={`button-edit-widget-${w.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid={`button-delete-widget-${w.id}`}
                    onClick={() => {
                      if (confirm(`Delete widget "${w.name}"?`)) deleteMutation.mutate(w.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SiteEditor() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { toast } = useToast();

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/admin/tenants', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tenant');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', `/api/admin/tenants/${tenantId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Status updated' });
    },
  });

  const isPublished = tenant?.status === 'yayinda';

  if (!tenantId) return null;

  return (
    <AdminLayout>
      <SiteProvider tenantId={tenantId}>
        <div className="p-6 space-y-4" data-testid="page-site-editor">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin/sites">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back-sites">
                  <ArrowLeft className="h-4 w-4" />
                  Sites
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{isLoading ? '...' : (tenant?.universityName || 'Site Editor')}</h1>
                <p className="text-xs text-muted-foreground">{tenant?.domain}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[(tenant?.status as string) ?? 'taslak'] ?? 'secondary'}>
                {STATUS_LABELS[(tenant?.status as string) ?? 'taslak'] ?? tenant?.status}
              </Badge>
              <Button
                variant={isPublished ? 'outline' : 'default'}
                size="sm"
                className="gap-1"
                onClick={() => statusMutation.mutate(isPublished ? 'taslak' : 'yayinda')}
                disabled={statusMutation.isPending || isLoading}
                data-testid="button-toggle-status"
              >
                {isPublished ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                {isPublished ? 'Unpublish' : 'Publish'}
              </Button>
              {tenant?.domain && (
                <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="button-visit-site">
                    <Globe className="h-3 w-3" />
                    Visit
                  </Button>
                </a>
              )}
            </div>
          </div>

          <Tabs defaultValue="sections">
            <TabsList className="flex-wrap h-auto gap-0.5">
              <TabsTrigger value="sections" data-testid="tab-sections">Sections</TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
              <TabsTrigger value="faq" data-testid="tab-faq">FAQ</TabsTrigger>
              <TabsTrigger value="testimonials" data-testid="tab-testimonials">Testimonials</TabsTrigger>
              <TabsTrigger value="theme" data-testid="tab-theme">Theme</TabsTrigger>
              <TabsTrigger value="widget" data-testid="tab-widget">Widget</TabsTrigger>
              <TabsTrigger value="seo" data-testid="tab-seo">SEO</TabsTrigger>
              <TabsTrigger value="media" data-testid="tab-media">Media</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              <TabsTrigger value="blog" data-testid="tab-blog">Blog</TabsTrigger>
              <TabsTrigger value="versions" data-testid="tab-versions">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="sections" className="mt-4">
              <Sections embedded />
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              <Tabs defaultValue="hero">
                <TabsList>
                  <TabsTrigger value="hero">Hero</TabsTrigger>
                  <TabsTrigger value="trust">Why Choose Us</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="footer">Footer</TabsTrigger>
                </TabsList>
                <TabsContent value="hero" className="mt-4">
                  <HeroContent embedded />
                </TabsContent>
                <TabsContent value="trust" className="mt-4">
                  <WhyChooseUs embedded />
                </TabsContent>
                <TabsContent value="contact" className="mt-4">
                  <ContactInfo embedded />
                </TabsContent>
                <TabsContent value="footer" className="mt-4">
                  <FooterContent embedded />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <FAQ embedded />
            </TabsContent>

            <TabsContent value="testimonials" className="mt-4">
              <Testimonials embedded />
            </TabsContent>

            <TabsContent value="theme" className="mt-4">
              <Theme embedded />
            </TabsContent>

            <TabsContent value="widget" className="mt-4">
              <WidgetManager tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="seo" className="mt-4">
              <SEOSettings embedded />
            </TabsContent>

            <TabsContent value="media" className="mt-4">
              <TenantMediaTab tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <TenantSettingsTab tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="blog" className="mt-4">
              <PlaceholderTab title="Blog" description="Create and publish blog posts and articles for this site." />
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              <PlaceholderTab title="Version History" description="View and restore previous versions of this site's content." />
            </TabsContent>
          </Tabs>
        </div>
      </SiteProvider>
    </AdminLayout>
  );
}
