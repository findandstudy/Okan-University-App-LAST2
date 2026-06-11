import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminLayout from './AdminLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus, Settings2, Copy, Trash2, Globe, Loader2,
  Eye, Power, PowerOff, RefreshCw, ExternalLink,
} from 'lucide-react';
import type { Tenant } from '@shared/schema';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

const STATUS_LABELS: Record<string, string> = {
  yayinda: 'Published',
  taslak: 'Draft',
  askiya_alindi: 'Suspended',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  yayinda: 'default',
  taslak: 'secondary',
  askiya_alindi: 'destructive',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ar: 'Arabic', tr: 'Turkish', fr: 'French',
  ru: 'Russian', fa: 'Farsi', zh: 'Chinese', hi: 'Hindi',
  es: 'Spanish', id: 'Indonesian',
};

const ALL_LANGUAGES = SUPPORTED_LANGUAGES.map(code => ({
  code,
  label: LANGUAGE_LABELS[code] || code,
}));

interface NewSiteForm {
  universityName: string;
  domain: string;
  languages: string[];
}

interface CloneForm {
  universityName: string;
  domain: string;
}

function SitePreviewFrame({ url, refreshKey }: { url: string; refreshKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setScale(w / 1280);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden w-full bg-muted"
      style={{ height: `${Math.round(720 * scale)}px` }}
    >
      <iframe
        key={refreshKey}
        src={url}
        title="Site preview"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1280px',
          height: '720px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          border: 'none',
        }}
      />
    </div>
  );
}

export default function Sites() {
  const { toast } = useToast();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<NewSiteForm>({ universityName: '', domain: '', languages: ['en'] });
  const [cloneForm, setCloneForm] = useState<CloneForm>({ universityName: '', domain: '' });
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});

  const bumpRefresh = (id: string) =>
    setRefreshKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['/api/admin/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: NewSiteForm) => {
      const res = await apiRequest('POST', '/api/admin/tenants', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site created successfully' });
      setNewDialogOpen(false);
      setNewForm({ universityName: '', domain: '', languages: ['en'] });
    },
    onError: () => toast({ title: 'Failed to create site', variant: 'destructive' }),
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ sourceId, data }: { sourceId: string; data: CloneForm }) => {
      const res = await apiRequest('POST', `/api/admin/tenants/${sourceId}/clone`, data);
      return res.json();
    },
    onSuccess: (_, { sourceId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site cloned successfully' });
      setCloneDialogOpen(null);
      setCloneForm({ universityName: '', domain: '' });
      bumpRefresh(sourceId);
    },
    onError: () => toast({ title: 'Failed to clone site', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/tenants/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site deleted' });
    },
    onError: () => toast({ title: 'Failed to delete site', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/tenants/${id}`, { status });
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      bumpRefresh(id);
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const devPreviewUrl = (tenant: Tenant) =>
    `/en${tenant.id !== 'default' ? `?_tid=${tenant.id}` : ''}`;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" data-testid="page-sites">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sites</h1>
            <p className="text-muted-foreground">Manage all university landing page sites</p>
          </div>
          <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-site" className="gap-2">
                <Plus className="h-4 w-4" />
                New Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>University Name</Label>
                  <Input
                    data-testid="input-university-name"
                    placeholder="e.g. Okan University"
                    value={newForm.universityName}
                    onChange={e => setNewForm(p => ({ ...p, universityName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input
                    data-testid="input-domain"
                    placeholder="e.g. okanuniversity.app"
                    value={newForm.domain}
                    onChange={e => setNewForm(p => ({ ...p, domain: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Languages</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_LANGUAGES.map(lang => (
                      <label key={lang.code} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newForm.languages.includes(lang.code)}
                          onChange={e => setNewForm(p => ({
                            ...p,
                            languages: e.target.checked
                              ? [...p.languages, lang.code]
                              : p.languages.filter(l => l !== lang.code),
                          }))}
                          data-testid={`checkbox-lang-${lang.code}`}
                        />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                  <Button
                    data-testid="button-create-site"
                    onClick={() => createMutation.mutate(newForm)}
                    disabled={createMutation.isPending || !newForm.universityName || !newForm.domain || newForm.languages.length === 0}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : tenants.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No sites yet. Create your first site.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {tenants.map(tenant => {
              const isPublished = tenant.status === 'yayinda';
              const refreshKey = refreshKeys[tenant.id] ?? 0;
              return (
                <div
                  key={tenant.id}
                  className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col"
                  data-testid={`card-tenant-${tenant.id}`}
                >
                  {/* Live preview */}
                  <div className="relative group">
                    <SitePreviewFrame url={devPreviewUrl(tenant)} refreshKey={refreshKey} />

                    {/* Status badge overlay */}
                    <div className="absolute top-2 left-2">
                      <Badge
                        variant={STATUS_VARIANTS[tenant.status as string] ?? 'secondary'}
                        data-testid={`badge-status-${tenant.id}`}
                        className="shadow"
                      >
                        {STATUS_LABELS[tenant.status as string] ?? tenant.status}
                      </Badge>
                    </div>

                    {/* Refresh overlay button */}
                    <button
                      onClick={() => bumpRefresh(tenant.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1.5 shadow hover:bg-background"
                      title="Refresh preview"
                      data-testid={`button-refresh-preview-${tenant.id}`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>

                    {/* Open in tab overlay */}
                    <a
                      href={devPreviewUrl(tenant)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1.5 shadow hover:bg-background"
                      title="Open dev preview in new tab"
                      data-testid={`button-open-dev-${tenant.id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Card info */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3">
                      {tenant.logoUrl ? (
                        <img
                          src={tenant.logoUrl}
                          alt={tenant.universityName}
                          className="h-9 w-9 rounded object-contain border bg-white shrink-0"
                          data-testid={`img-logo-${tenant.id}`}
                        />
                      ) : (
                        <div className="h-9 w-9 rounded border bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                          {tenant.universityName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-name-${tenant.id}`}>
                          {tenant.universityName}
                        </p>
                        {tenant.domain && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <Globe className="h-3 w-3 shrink-0" />
                            {tenant.domain}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(tenant as any).supportedLanguages?.length ?? 1} language{((tenant as any).supportedLanguages?.length ?? 1) !== 1 ? 's' : ''}</span>
                      {tenant.createdAt && (
                        <>
                          <span>·</span>
                          <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
                      <Link href={`/admin/sites/${tenant.id}`}>
                        <Button variant="default" size="sm" className="gap-1.5 h-8" data-testid={`button-edit-${tenant.id}`}>
                          <Settings2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Link>

                      <Button
                        variant={isPublished ? 'outline' : 'secondary'}
                        size="sm"
                        className="gap-1.5 h-8"
                        data-testid={`button-toggle-status-${tenant.id}`}
                        onClick={() => statusMutation.mutate({ id: tenant.id, status: isPublished ? 'taslak' : 'yayinda' })}
                        disabled={statusMutation.isPending}
                      >
                        {statusMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : isPublished
                            ? <PowerOff className="h-3.5 w-3.5" />
                            : <Power className="h-3.5 w-3.5" />
                        }
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </Button>

                      <a href={devPreviewUrl(tenant)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-preview-${tenant.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Dev
                        </Button>
                      </a>

                      {tenant.domain && (
                        <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-live-${tenant.id}`}>
                            <Globe className="h-3.5 w-3.5" />
                            Live
                          </Button>
                        </a>
                      )}

                      <Dialog
                        open={cloneDialogOpen === tenant.id}
                        onOpenChange={open => {
                          setCloneDialogOpen(open ? tenant.id : null);
                          if (open) setCloneForm({ universityName: `${tenant.universityName} (Copy)`, domain: '' });
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-clone-${tenant.id}`}>
                            <Copy className="h-3.5 w-3.5" />
                            Clone
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Clone: {tenant.universityName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>New University Name</Label>
                              <Input
                                data-testid="input-clone-name"
                                value={cloneForm.universityName}
                                onChange={e => setCloneForm(p => ({ ...p, universityName: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>New Domain</Label>
                              <Input
                                data-testid="input-clone-domain"
                                placeholder="e.g. newuniversity.app"
                                value={cloneForm.domain}
                                onChange={e => setCloneForm(p => ({ ...p, domain: e.target.value }))}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setCloneDialogOpen(null)}>Cancel</Button>
                              <Button
                                data-testid="button-confirm-clone"
                                onClick={() => cloneMutation.mutate({ sourceId: tenant.id, data: cloneForm })}
                                disabled={cloneMutation.isPending || !cloneForm.universityName || !cloneForm.domain}
                              >
                                {cloneMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Clone
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {tenant.id !== 'default' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 ml-auto"
                          data-testid={`button-delete-${tenant.id}`}
                          onClick={() => {
                            if (confirm(`Delete "${tenant.universityName}"? This cannot be undone.`)) {
                              deleteMutation.mutate(tenant.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
