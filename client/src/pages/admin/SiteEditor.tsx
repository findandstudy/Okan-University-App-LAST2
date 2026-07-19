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
import { ArrowLeft, Globe, Power, PowerOff, Plus, Trash2, Pencil, Loader2, Code, Link as LinkIcon, Download, History, RotateCcw, Monitor, Tablet, Smartphone, RefreshCw, ExternalLink } from 'lucide-react';
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
import AISettings from './AISettings';
import ContentGenerator from './ContentGenerator';
import Blog from './Blog';
import { Construction, Upload } from 'lucide-react';
import type { Tenant, Widget } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Site Preview Tab ──────────────────────────────────────────────────────────
const PREVIEW_LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'fa', label: '🇮🇷 Farsi' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'id', label: '🇮🇩 Indonesian' },
];

const DEVICE_SIZES = [
  { id: 'desktop', icon: Monitor, label: 'Desktop', width: '100%' },
  { id: 'tablet',  icon: Tablet,  label: 'Tablet',  width: '768px' },
  { id: 'mobile',  icon: Smartphone, label: 'Mobile', width: '390px' },
] as const;

function SitePreviewTab({ tenantId }: { tenantId: string }) {
  const [lang, setLang] = useState('en');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const tidParam = tenantId && tenantId !== 'default' ? `?_tid=${tenantId}` : '';
  const previewUrl = `/${lang}${tidParam}`;
  const fullPreviewUrl = `/admin/preview/${tenantId}/${lang}`;
  const deviceWidth = DEVICE_SIZES.find(d => d.id === device)?.width ?? '100%';

  const handleRefresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Device switcher */}
        <div className="flex items-center rounded-md border bg-background overflow-hidden">
          {DEVICE_SIZES.map(d => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              title={d.label}
              data-testid={`button-preview-device-${d.id}`}
              className={`px-3 py-2 flex items-center gap-1.5 text-xs transition-colors ${
                device === d.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <d.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{d.label}</span>
            </button>
          ))}
        </div>

        {/* Language picker */}
        <Select value={lang} onValueChange={v => { setLang(v); setRefreshKey(k => k + 1); }}>
          <SelectTrigger className="w-36 h-9" data-testid="select-preview-lang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PREVIEW_LANGUAGES.map(l => (
              <SelectItem key={l.code} value={l.code} data-testid={`option-preview-lang-${l.code}`}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-1.5"
          data-testid="button-preview-refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Yenile
        </Button>

        {/* Full-page preview */}
        <a href={fullPreviewUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="default" size="sm" className="gap-1.5" data-testid="button-fullpage-preview">
            <ExternalLink className="h-3.5 w-3.5" />
            Tam Sayfa Önizle
          </Button>
        </a>

        <span className="ml-auto text-xs text-muted-foreground hidden md:block">
          {deviceWidth === '100%' ? 'Tam genişlik' : deviceWidth}
        </span>
      </div>

      {/* iframe container */}
      <div className="rounded-lg border bg-muted/40 flex justify-center overflow-hidden" style={{ minHeight: '75vh' }}>
        <div
          style={{
            width: deviceWidth,
            transition: 'width 0.3s ease',
            position: 'relative',
            background: 'white',
            boxShadow: device !== 'desktop' ? '0 0 0 1px hsl(var(--border)), 0 4px 24px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          <iframe
            key={`${lang}-${refreshKey}`}
            ref={iframeRef}
            src={previewUrl}
            title="Site Preview"
            data-testid="iframe-site-preview"
            style={{
              width: '100%',
              height: '80vh',
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Versions Tab ─────────────────────────────────────────────────────────────
interface VersionEntry {
  id: string;
  label: string;
  createdAt: string;
}

interface VersionPreview {
  id: string;
  label: string;
  createdAt: string;
  summary: {
    universityName: string;
    domain: string;
    sections: string[];
    faqCount: number;
    testimonialCount: number;
    capturedAt: string;
  };
}

function VersionsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [savingVersion, setSavingVersion] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [previewVersion, setPreviewVersion] = useState<VersionPreview | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: versions = [], isLoading, refetch } = useQuery<VersionEntry[]>({
    queryKey: ['/api/admin/sites', tenantId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/sites/${tenantId}/versions?_tid=${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.json();
    },
  });

  const handleSave = async () => {
    setSavingVersion(true);
    try {
      const res = await apiRequest('POST', `/api/admin/sites/${tenantId}/versions?_tid=${tenantId}`, { label: labelInput || undefined });
      if (!res.ok) throw new Error('Failed to save');
      setLabelInput('');
      refetch();
      toast({ title: 'Version saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this version? Current content will be overwritten.')) return;
    setRestoringId(id);
    try {
      await apiRequest('POST', `/api/admin/sites/${tenantId}/versions/${id}/restore?_tid=${tenantId}`, {});
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants', tenantId] });
      toast({ title: 'Version restored! Refresh the page to see changes.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this version?')) return;
    setDeletingId(id);
    try {
      await apiRequest('DELETE', `/api/admin/sites/${tenantId}/versions/${id}?_tid=${tenantId}`);
      refetch();
      toast({ title: 'Version deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreview = async (id: string) => {
    setLoadingPreviewId(id);
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/versions/${id}/preview?_tid=${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setPreviewVersion(data);
      setPreviewOpen(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingPreviewId(null);
    }
  };

  return (
    <>
      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Version Preview</DialogTitle>
          </DialogHeader>
          {previewVersion && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-base">{previewVersion.label}</p>
                <p className="text-xs text-muted-foreground">
                  Saved {new Date(previewVersion.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/30">
                <div><span className="text-muted-foreground">University</span><p className="font-medium">{previewVersion.summary.universityName}</p></div>
                <div><span className="text-muted-foreground">Domain</span><p className="font-medium">{previewVersion.summary.domain}</p></div>
                <div><span className="text-muted-foreground">FAQ items</span><p className="font-medium">{previewVersion.summary.faqCount}</p></div>
                <div><span className="text-muted-foreground">Testimonials</span><p className="font-medium">{previewVersion.summary.testimonialCount}</p></div>
              </div>
              {previewVersion.summary.sections.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Active sections ({previewVersion.summary.sections.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {previewVersion.summary.sections.map(s => (
                      <span key={s} className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>Close</Button>
                <Button
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  variant="outline"
                  onClick={() => { setPreviewOpen(false); handleRestore(previewVersion.id); }}
                  data-testid="button-preview-restore"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Bu Sürüme Dön
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Save New Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Version label (optional)"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                data-testid="input-version-label"
                className="max-w-sm"
              />
              <Button onClick={handleSave} disabled={savingVersion} data-testid="button-save-version">
                {savingVersion ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Save Snapshot
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Saves the current state of all site content (sections, FAQ, testimonials, theme, SEO). Last 10 versions are kept.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : versions.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                No saved versions yet. Click "Save Snapshot" to create the first one.
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((v, idx) => (
                  <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`version-${v.id}`}>
                    <div>
                      <p className="font-medium text-sm">{v.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                        {idx === 0 && <span className="ml-2 inline-block bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">Latest</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handlePreview(v.id)}
                        disabled={loadingPreviewId === v.id}
                        data-testid={`button-preview-${v.id}`}
                      >
                        {loadingPreviewId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Önizle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleRestore(v.id)}
                        disabled={restoringId === v.id}
                        data-testid={`button-restore-${v.id}`}
                      >
                        {restoringId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Bu Sürüme Dön
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(v.id)}
                        disabled={deletingId === v.id}
                        data-testid={`button-delete-version-${v.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

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
      const uploadRes = await fetch(`/api/upload?_tid=${tenantId}`, { method: 'POST', body: formData, credentials: 'include' });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { objectPath } = await uploadRes.json();
      await apiRequest('POST', `/api/media?_tid=${tenantId}`, {
        fileName: file.name,
        fileUrl: objectPath,
        fileType: file.type.startsWith('image/') ? 'image' : 'video',
        fileSize: file.size,
        altText: file.name,
      });
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

  const [exportingZip, setExportingZip] = useState(false);

  interface RecentExport {
    id: string;
    status: string;
    filename: string | null;
    downloadUrl: string | null;
    createdAt: string;
    completedAt: string | null;
  }
  const { data: recentExports = [] } = useQuery<RecentExport[]>({
    queryKey: ['/api/admin/sites', tenantId, 'exports'],
    queryFn: () => fetch(`/api/admin/sites/${tenantId}/exports?_tid=${tenantId}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', `/api/admin/tenants/${tenantId}`, { status });
      return res.json();
    },
    onSuccess: async (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Status updated' });
      // Auto-snapshot when publishing
      if (status === 'yayinda') {
        try {
          await apiRequest('POST', `/api/admin/sites/${tenantId}/versions?_tid=${tenantId}`, {
            label: `Auto — Published ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/sites', tenantId, 'versions'] });
        } catch { /* non-critical — don't surface */ }
      }
    },
  });

  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      const startRes = await fetch(`/api/admin/sites/${tenantId}/export-zip?_tid=${tenantId}`, {
        method: 'POST', credentials: 'include',
      });
      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed to start (HTTP ${startRes.status})`);
      }
      const { jobId } = await startRes.json();

      // Poll with exponential backoff (2 → 4 → 8 → 16 → 30 s), max 10 min total
      let downloadUrl: string | null = null;
      let delayMs = 2000;
      const maxDelayMs = 30_000;
      const deadline = Date.now() + 10 * 60 * 1000;
      let attempt = 0;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, delayMs));

        const poll = await fetch(`/api/admin/sites/${tenantId}/export-zip/${jobId}?_tid=${tenantId}`, { credentials: 'include' });
        if (!poll.ok) {
          const errData = await poll.json().catch(() => ({}));
          if (poll.status === 404) throw new Error('İş kaydı bulunamadı — sunucu yeniden başlamış olabilir. Lütfen tekrar deneyin.');
          throw new Error(errData.error || `Polling hatası (HTTP ${poll.status})`);
        }

        const data = await poll.json();
        if (data.status === 'ready') { downloadUrl = data.downloadUrl; break; }
        if (data.status === 'error') throw new Error(data.error || 'ZIP oluşturma başarısız');

        attempt++;
        if (attempt % 2 === 0) delayMs = Math.min(delayMs * 2, maxDelayMs);
      }

      if (!downloadUrl) throw new Error('ZIP oluşturma zaman aşımına uğradı (10 dk). Son export listesinden indirmeyi deneyin.');

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadUrl.split('/').pop() || 'site-export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sites', tenantId, 'exports'] });
      toast({ title: 'ZIP downloaded', description: 'Tüm dil sayfaları ve varlıklar dahil.' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExportingZip(false);
    }
  };

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
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleExportZip}
                disabled={exportingZip || isLoading}
                data-testid="button-export-zip"
                title="Download full site as ZIP (10 languages)"
              >
                {exportingZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                ZIP
              </Button>
              <a href={`/admin/preview/${tenantId}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1" data-testid="button-preview-site">
                  <Monitor className="h-3 w-3" />
                  Preview
                </Button>
              </a>
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

          {recentExports.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Recent Exports</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentExports.map((exp) => (
                    <div key={exp.id} className="flex items-center gap-1.5 text-xs" data-testid={`export-job-${exp.id}`}>
                      {exp.status === 'ready' && exp.downloadUrl ? (
                        <a
                          href={exp.downloadUrl}
                          className="flex items-center gap-1 text-primary hover:underline"
                          data-testid={`link-download-export-${exp.id}`}
                        >
                          <Download className="h-3 w-3" />
                          {exp.filename || 'export.zip'}
                        </a>
                      ) : exp.status === 'error' ? (
                        <span className="text-destructive flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                          Failed
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Building…
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(exp.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="preview">
            <TabsList className="flex-wrap h-auto gap-0.5">
              <TabsTrigger value="preview" data-testid="tab-preview" className="gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="sections" data-testid="tab-sections">Sections</TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
              <TabsTrigger value="faq" data-testid="tab-faq">FAQ</TabsTrigger>
              <TabsTrigger value="testimonials" data-testid="tab-testimonials">Testimonials</TabsTrigger>
              <TabsTrigger value="theme" data-testid="tab-theme">Theme</TabsTrigger>
              <TabsTrigger value="widget" data-testid="tab-widget">Widget</TabsTrigger>
              <TabsTrigger value="seo" data-testid="tab-seo">SEO</TabsTrigger>
              <TabsTrigger value="media" data-testid="tab-media">Media</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              <TabsTrigger value="translations" data-testid="tab-translations">Çeviriler</TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai">AI</TabsTrigger>
              <TabsTrigger value="blog" data-testid="tab-blog">Blog</TabsTrigger>
              <TabsTrigger value="versions" data-testid="tab-versions">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <SitePreviewTab tenantId={tenantId} />
            </TabsContent>

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

            <TabsContent value="settings" className="mt-4 space-y-6">
              <TenantSettingsTab tenantId={tenantId} />
              <FooterContent embedded />
            </TabsContent>

            <TabsContent value="translations" className="mt-4">
              <PlaceholderTab title="Çeviriler" description="Manage multi-language translations for all site content across supported languages." />
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <Tabs defaultValue="settings">
                <TabsList>
                  <TabsTrigger value="settings">AI Settings</TabsTrigger>
                  <TabsTrigger value="generator">Content Generator</TabsTrigger>
                </TabsList>
                <TabsContent value="settings" className="mt-4">
                  <AISettings embedded />
                </TabsContent>
                <TabsContent value="generator" className="mt-4">
                  <ContentGenerator embedded />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="blog" className="mt-4">
              <Blog embedded />
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              <VersionsTab tenantId={tenantId} />
            </TabsContent>
          </Tabs>
        </div>
      </SiteProvider>
    </AdminLayout>
  );
}
