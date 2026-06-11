import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminLayout from './AdminLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Settings2, Copy, Trash2, Globe, Loader2, ExternalLink, Eye, Power, PowerOff } from 'lucide-react';
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

export default function Sites() {
  const { toast } = useToast();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<NewSiteForm>({ universityName: '', domain: '', languages: ['en'] });
  const [cloneForm, setCloneForm] = useState<CloneForm>({ universityName: '', domain: '' });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site cloned successfully' });
      setCloneDialogOpen(null);
      setCloneForm({ universityName: '', domain: '' });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] }),
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

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

        <Card>
          <CardHeader>
            <CardTitle>All Sites ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : tenants.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No sites yet. Create your first site.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Logo</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Languages</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map(tenant => {
                    const isPublished = tenant.status === 'yayinda';
                    const logoUrl = tenant.logoUrl;
                    return (
                      <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                        <TableCell>
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={tenant.universityName}
                              className="h-8 w-8 rounded object-contain border bg-white"
                              data-testid={`img-logo-${tenant.id}`}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded border bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {tenant.universityName.charAt(0)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{tenant.universityName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Globe className="h-3 w-3" />
                            <span>{tenant.domain}</span>
                            {tenant.domain && (
                              <a
                                href={`https://${tenant.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground"
                                data-testid={`link-visit-${tenant.id}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANTS[tenant.status as string] ?? 'secondary'}
                            data-testid={`badge-status-${tenant.id}`}
                          >
                            {STATUS_LABELS[tenant.status as string] ?? tenant.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground" data-testid={`cell-lang-count-${tenant.id}`}>
                          {(tenant as any).supportedLanguages?.length ?? 1}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`cell-created-${tenant.id}`}>
                          {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/sites/${tenant.id}`}>
                              <Button variant="ghost" size="sm" className="gap-1.5" data-testid={`button-edit-${tenant.id}`}>
                                <Settings2 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </Link>

                            <a
                              href={`/en${tenant.id !== 'default' ? `?_tid=${tenant.id}` : ''}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm" className="gap-1.5" data-testid={`button-preview-${tenant.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                                Dev
                              </Button>
                            </a>

                            {tenant.domain && (
                              <a
                                href={`https://${tenant.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm" className="gap-1.5" data-testid={`button-live-${tenant.id}`}>
                                  <Globe className="h-3.5 w-3.5" />
                                  Live
                                </Button>
                              </a>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              data-testid={`button-toggle-status-${tenant.id}`}
                              onClick={() => statusMutation.mutate({ id: tenant.id, status: isPublished ? 'taslak' : 'yayinda' })}
                              disabled={statusMutation.isPending}
                            >
                              {isPublished ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                              {isPublished ? 'Unpublish' : 'Publish'}
                            </Button>

                            <Dialog
                              open={cloneDialogOpen === tenant.id}
                              onOpenChange={open => {
                                setCloneDialogOpen(open ? tenant.id : null);
                                if (open) setCloneForm({ universityName: `${tenant.universityName} (Copy)`, domain: '' });
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1.5" data-testid={`button-clone-${tenant.id}`}>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
