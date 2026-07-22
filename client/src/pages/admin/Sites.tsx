import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminLayout from './AdminLayout';
import AdminErrorState from '@/components/admin/AdminErrorState';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Settings2, Copy, Trash2, Globe, Loader2,
  Eye, Power, PowerOff, RefreshCw, ExternalLink,
  LayoutGrid, List, Search, ArrowUpDown, X,
  CheckCircle, HeartPulse, CircleCheck, CircleX,
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

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'yayinda', label: 'Published' },
  { key: 'taslak', label: 'Draft' },
  { key: 'askiya_alindi', label: 'Suspended' },
];

interface NewSiteForm {
  universityName: string;
  domain: string;
  languages: string[];
}

interface CloneForm {
  universityName: string;
  domain: string;
}

// ── Site preview iframe ────────────────────────────────────────────────────
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
          top: 0, left: 0,
          width: '1280px', height: '720px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          border: 'none',
        }}
      />
    </div>
  );
}

// ── New Site / Clone dialogs (shared) ─────────────────────────────────────
function NewSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<NewSiteForm>({ universityName: '', domain: '', languages: ['en'] });
  const [copyFromDefault, setCopyFromDefault] = useState(true);

  const createMutation = useMutation({
    mutationFn: async (data: NewSiteForm) => {
      if (copyFromDefault) {
        // Clone all content (sections, FAQ, testimonials, theme, SEO, branding) from default site
        return (await apiRequest('POST', '/api/admin/tenants/default/clone', data)).json();
      }
      return (await apiRequest('POST', '/api/admin/tenants', data)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: copyFromDefault ? 'Site created from Default template' : 'Site created successfully' });
      onOpenChange(false);
      setForm({ universityName: '', domain: '', languages: ['en'] });
    },
    onError: (err: Error) => toast({ title: 'Failed to create site', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create New Site</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>University Name</Label>
            <Input data-testid="input-university-name" placeholder="e.g. Okan University"
              value={form.universityName} onChange={e => setForm(p => ({ ...p, universityName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Domain</Label>
            <Input data-testid="input-domain" placeholder="e.g. okanuniversity.app"
              value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_LANGUAGES.map(lang => (
                <label key={lang.code} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.languages.includes(lang.code)}
                    onChange={e => setForm(p => ({
                      ...p,
                      languages: e.target.checked ? [...p.languages, lang.code] : p.languages.filter(l => l !== lang.code),
                    }))}
                    data-testid={`checkbox-lang-${lang.code}`}
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </div>

          {/* ── Copy from Default toggle ── */}
          <div
            className={`rounded-lg border p-3 cursor-pointer transition-colors ${copyFromDefault ? 'border-primary bg-primary/5' : 'border-border'}`}
            onClick={() => setCopyFromDefault(v => !v)}
            data-testid="toggle-copy-from-default"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${copyFromDefault ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Copy className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Copy from Default Site</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Copies branding, SEO settings, sections, FAQ and testimonials
                </p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${copyFromDefault ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                {copyFromDefault && <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button data-testid="button-create-site"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.universityName || !form.domain || form.languages.length === 0}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {copyFromDefault ? 'Create from Default' : 'Create Blank'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Sites() {
  const { toast } = useToast();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState<string | null>(null);
  const [cloneForm, setCloneForm] = useState<CloneForm>({ universityName: '', domain: '' });
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // List management state
  const [view, setView] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'status'>('date_desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [healthDialogTenantId, setHealthDialogTenantId] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const bumpRefresh = (id: string) =>
    setRefreshKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  const { data: tenants = [], isLoading, isError, error } = useQuery<Tenant[]>({
    queryKey: ['/api/admin/tenants'],
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ sourceId, data }: { sourceId: string; data: CloneForm }) =>
      (await apiRequest('POST', `/api/admin/tenants/${sourceId}/clone`, data)).json(),
    onSuccess: (_, { sourceId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: 'Site cloned successfully' });
      setCloneDialogOpen(null);
      setCloneForm({ universityName: '', domain: '' });
      bumpRefresh(sourceId);
    },
    onError: (err: Error) => toast({ title: 'Failed to clone site', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest('DELETE', `/api/admin/tenants/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] }); toast({ title: 'Site deleted' }); },
    onError: () => toast({ title: 'Failed to delete site', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await apiRequest('PATCH', `/api/admin/tenants/${id}`, { status })).json(),
    onSuccess: (_, { id }) => { queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] }); bumpRefresh(id); },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  // Bulk mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest('POST', '/api/admin/tenants/bulk-delete', { ids }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      setSelectedIds(new Set());
      toast({ title: `${data.deleted ?? 0} sites deleted` });
    },
    onError: () => toast({ title: 'Bulk delete failed', variant: 'destructive' }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiRequest('POST', '/api/admin/tenants/bulk-status', { ids, status }).then(r => r.json()),
    onSuccess: (data: any, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      setSelectedIds(new Set());
      toast({ title: `${data.updated ?? 0} sites set to ${STATUS_LABELS[status] ?? status}` });
    },
    onError: () => toast({ title: 'Bulk status update failed', variant: 'destructive' }),
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const devPreviewUrl = (tenant: Tenant) =>
    `/en${tenant.id !== 'default' ? `?_tid=${tenant.id}` : ''}`;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tenants.length };
    for (const t of tenants) counts[t.status as string] = (counts[t.status as string] || 0) + 1;
    return counts;
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    let result = [...tenants];
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.universityName.toLowerCase().includes(q) || (t.domain || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.universityName.localeCompare(b.universityName);
      if (sortBy === 'name_desc') return b.universityName.localeCompare(a.universityName);
      if (sortBy === 'status') return (a.status as string).localeCompare(b.status as string);
      if (sortBy === 'date_asc') return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
    return result;
  }, [tenants, statusFilter, searchQuery, sortBy]);

  const allFiltered = filteredTenants.length > 0 && filteredTenants.every(t => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFiltered) {
      setSelectedIds(prev => { const n = new Set(prev); filteredTenants.forEach(t => n.delete(t.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); filteredTenants.forEach(t => n.add(t.id)); return n; });
    }
  };
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Clear selections when filter changes
  const handleStatusFilter = (key: string) => { setStatusFilter(key); setSelectedIds(new Set()); };

  // ── Logo avatar helper ─────────────────────────────────────────────────────
  const TenantAvatar = ({ tenant, size = 'sm' }: { tenant: Tenant; size?: 'sm' | 'md' }) => {
    const cls = size === 'sm'
      ? 'h-7 w-7 text-xs rounded'
      : 'h-9 w-9 text-sm rounded';
    return tenant.logoUrl
      ? <img src={tenant.logoUrl} alt={tenant.universityName} className={`${cls} object-contain border bg-white shrink-0`} data-testid={`img-logo-${tenant.id}`} />
      : <div className={`${cls} border bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0`}>{tenant.universityName.charAt(0)}</div>;
  };

  // ── Row actions (shared between card + list) ───────────────────────────────
  const TenantActions = ({ tenant, compact = false }: { tenant: Tenant; compact?: boolean }) => {
    const isPublished = tenant.status === 'yayinda';
    return (
      <div className={`flex items-center gap-1 flex-wrap ${compact ? '' : 'pt-1 border-t'}`}>
        <Link href={`/admin/sites/${tenant.id}`}>
          <Button variant="default" size="sm" className="gap-1.5 h-8" data-testid={`button-edit-${tenant.id}`}>
            <Settings2 className="h-3.5 w-3.5" />{!compact && 'Edit'}
          </Button>
        </Link>
        <Button variant={isPublished ? 'outline' : 'secondary'} size="sm" className="gap-1.5 h-8"
          data-testid={`button-toggle-status-${tenant.id}`}
          onClick={() => statusMutation.mutate({ id: tenant.id, status: isPublished ? 'taslak' : 'yayinda' })}
          disabled={statusMutation.isPending}>
          {statusMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : isPublished ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          {isPublished ? 'Unpublish' : 'Publish'}
        </Button>
        <a href={`/admin/preview/${tenant.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-preview-${tenant.id}`}>
            <Eye className="h-3.5 w-3.5" />Preview
          </Button>
        </a>
        {tenant.domain && (
          <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-live-${tenant.id}`}>
              <Globe className="h-3.5 w-3.5" />Live
            </Button>
          </a>
        )}
        <Button
          variant="ghost" size="sm" className="gap-1.5 h-8"
          data-testid={`button-domain-health-${tenant.id}`}
          onClick={async () => {
            setHealthDialogTenantId(tenant.id);
            setHealthData(null);
            setHealthLoading(true);
            try {
              const res = await apiRequest('GET', `/api/admin/tenants/${tenant.id}/domain-health`);
              setHealthData(await res.json());
            } catch (e: any) {
              setHealthData({ error: e?.message || 'Failed to load' });
            } finally {
              setHealthLoading(false);
            }
          }}
        >
          <HeartPulse className="h-3.5 w-3.5" />Health
        </Button>
        <Dialog open={cloneDialogOpen === tenant.id}
          onOpenChange={open => {
            setCloneDialogOpen(open ? tenant.id : null);
            if (open) setCloneForm({ universityName: `${tenant.universityName} (Copy)`, domain: '' });
          }}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8" data-testid={`button-clone-${tenant.id}`}>
              <Copy className="h-3.5 w-3.5" />Clone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Clone: {tenant.universityName}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>New University Name</Label>
                <Input data-testid="input-clone-name" value={cloneForm.universityName}
                  onChange={e => setCloneForm(p => ({ ...p, universityName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>New Domain</Label>
                <Input data-testid="input-clone-domain" placeholder="e.g. newuniversity.app"
                  value={cloneForm.domain} onChange={e => setCloneForm(p => ({ ...p, domain: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCloneDialogOpen(null)}>Cancel</Button>
                <Button data-testid="button-confirm-clone"
                  onClick={() => cloneMutation.mutate({ sourceId: tenant.id, data: cloneForm })}
                  disabled={cloneMutation.isPending || !cloneForm.universityName || !cloneForm.domain}>
                  {cloneMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Clone
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {tenant.id !== 'default' && (
          <Button variant="ghost" size="icon" className={`${compact ? 'h-8 w-8' : 'h-8 w-8 ml-auto'}`}
            data-testid={`button-delete-${tenant.id}`}
            onClick={() => setDeleteConfirmId(tenant.id)}
            disabled={deleteMutation.isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" data-testid="page-sites">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sites</h1>
            <p className="text-muted-foreground">Manage all university landing page sites</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <Button size="sm" variant={view === 'card' ? 'default' : 'ghost'} className="rounded-none border-0 gap-1.5"
                onClick={() => setView('card')} data-testid="button-view-card">
                <LayoutGrid className="h-3.5 w-3.5" />Cards
              </Button>
              <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="rounded-none border-0 gap-1.5"
                onClick={() => setView('list')} data-testid="button-view-list">
                <List className="h-3.5 w-3.5" />List
              </Button>
            </div>
            <Button data-testid="button-new-site" className="gap-2" onClick={() => setNewDialogOpen(true)}>
              <Plus className="h-4 w-4" />New Site
            </Button>
          </div>
        </div>

        {/* ── Search / Filter / Sort bar ──────────────────────────────── */}
        <div className="space-y-2">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => {
              const count = statusCounts[tab.key] ?? 0;
              if (tab.key !== 'all' && count === 0) return null;
              return (
                <button key={tab.key} onClick={() => handleStatusFilter(tab.key)}
                  data-testid={`tab-status-${tab.key}`}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                    statusFilter === tab.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted text-muted-foreground'
                  }`}>
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? 'bg-white/20' : 'bg-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search by name or domain…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm" data-testid="input-sites-search" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-search">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 text-sm w-44 gap-1.5" data-testid="select-sort-by">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="status">By status</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredTenants.length} site{filteredTenants.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk action bar */}
          {someSelected && view === 'list' && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-primary/5 border border-primary/20" data-testid="bulk-action-bar">
              <span className="text-sm font-medium text-primary" data-testid="text-selected-count">
                {selectedIds.size} selected
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'yayinda' })}
                disabled={bulkStatusMutation.isPending} data-testid="button-bulk-publish">
                <CheckCircle className="h-3 w-3" />Publish
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'taslak' })}
                disabled={bulkStatusMutation.isPending} data-testid="button-bulk-unpublish">
                <PowerOff className="h-3 w-3" />Unpublish
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={bulkDeleteMutation.isPending} data-testid="button-bulk-delete">
                <Trash2 className="h-3 w-3" />Delete
              </Button>
              <button onClick={() => setSelectedIds(new Set())}
                className="ml-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-selection">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : isError ? (
          <AdminErrorState error={error} queryKey={['/api/admin/tenants']} />
        ) : filteredTenants.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {tenants.length === 0 ? 'No sites yet. Create your first site.' : 'No sites match your filter.'}
          </div>
        ) : view === 'card' ? (
          /* ─── Card grid ─────────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTenants.map(tenant => {
              const isPublished = tenant.status === 'yayinda';
              const refreshKey = refreshKeys[tenant.id] ?? 0;
              return (
                <div key={tenant.id}
                  className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col"
                  data-testid={`card-tenant-${tenant.id}`}>
                  {/* Live preview */}
                  <div className="relative group">
                    <SitePreviewFrame url={devPreviewUrl(tenant)} refreshKey={refreshKey} />
                    <div className="absolute top-2 left-2">
                      <Badge variant={STATUS_VARIANTS[tenant.status as string] ?? 'secondary'} className="shadow"
                        data-testid={`badge-status-${tenant.id}`}>
                        {STATUS_LABELS[tenant.status as string] ?? tenant.status}
                      </Badge>
                    </div>
                    <button onClick={() => bumpRefresh(tenant.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1.5 shadow hover:bg-background"
                      title="Refresh preview" data-testid={`button-refresh-preview-${tenant.id}`}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <a href={`/admin/preview/${tenant.id}`} target="_blank" rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1.5 shadow hover:bg-background"
                      title="Open full preview" data-testid={`button-open-dev-${tenant.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {/* Card info */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3">
                      <TenantAvatar tenant={tenant} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-name-${tenant.id}`}>{tenant.universityName}</p>
                        {tenant.domain && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <Globe className="h-3 w-3 shrink-0" />{tenant.domain}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(tenant as any).supportedLanguages?.length ?? 1} language{((tenant as any).supportedLanguages?.length ?? 1) !== 1 ? 's' : ''}</span>
                      {tenant.createdAt && <><span>·</span><span>Created {new Date(tenant.createdAt).toLocaleDateString('en-GB')}</span></>}
                    </div>
                    <TenantActions tenant={tenant} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── List table ─────────────────────────────────────────────── */
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <Checkbox checked={allFiltered} onCheckedChange={toggleSelectAll}
                      aria-label="Select all" data-testid="checkbox-select-all" />
                  </TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map(tenant => (
                  <TableRow key={tenant.id}
                    className={selectedIds.has(tenant.id) ? 'bg-primary/5' : ''}
                    data-testid={`row-tenant-${tenant.id}`}>
                    <TableCell className="pl-4">
                      <Checkbox checked={selectedIds.has(tenant.id)}
                        onCheckedChange={() => toggleSelect(tenant.id)}
                        aria-label={`Select ${tenant.universityName}`}
                        data-testid={`checkbox-tenant-${tenant.id}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <TenantAvatar tenant={tenant} />
                        <span className="font-medium text-sm" data-testid={`text-name-${tenant.id}`}>
                          {tenant.universityName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3 shrink-0" />
                        {tenant.domain || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[tenant.status as string] ?? 'secondary'}
                        data-testid={`badge-status-${tenant.id}`}>
                        {STATUS_LABELS[tenant.status as string] ?? tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(tenant as any).supportedLanguages?.length ?? 1} lang
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-GB') : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TenantActions tenant={tenant} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New site dialog */}
      <NewSiteDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />

      {/* Domain Health Dialog */}
      <Dialog open={!!healthDialogTenantId} onOpenChange={open => { if (!open) { setHealthDialogTenantId(null); setHealthData(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              Publish Status Check
            </DialogTitle>
          </DialogHeader>
          {healthLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Checking…
            </div>
          )}
          {!healthLoading && healthData && !healthData.error && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{healthData.universityName}</span>
                {' · '}{healthData.domain || '(no domain)'}
              </div>
              <div className="space-y-2">
                {(healthData.diagnostics as Array<{ ok: boolean; message: string }>).map((d, i) => (
                  <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-md ${d.ok ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`} data-testid={`health-item-${i}`}>
                    {d.ok
                      ? <CircleCheck className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      : <CircleX className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />}
                    <span className={d.ok ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>{d.message}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3">
                verify-domain simulation: <code className={`px-1 py-0.5 rounded ${healthData.verifyDomainSimulation?.caddyWillAccept ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {healthData.verifyDomainSimulation?.expectedStatus ?? '?'} {healthData.verifyDomainSimulation?.caddyWillAccept ? '— Caddy will accept' : '— Caddy will reject'}
                </code>
              </div>
            </div>
          )}
          {!healthLoading && healthData?.error && (
            <p className="text-sm text-destructive py-4">{healthData.error}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">
                {tenants.find(t => t.id === deleteConfirmId)?.universityName ?? 'this site'}
              </span>{' '}
              and all its content, programs, leads and settings. The domain will be freed up for reuse. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
              data-testid="button-delete-confirm">
              Delete site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} site{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected site{selectedIds.size !== 1 ? 's' : ''} and all their content, programs, and leads. The default site cannot be deleted and will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setBulkDeleteConfirm(false); bulkDeleteMutation.mutate(Array.from(selectedIds)); }}
              data-testid="button-bulk-delete-confirm">
              Delete {selectedIds.size} site{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
