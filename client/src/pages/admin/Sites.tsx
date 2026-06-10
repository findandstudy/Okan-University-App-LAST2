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
import { Plus, Settings2, Copy, Trash2, Globe, Loader2, ExternalLink } from 'lucide-react';
import type { Tenant } from '@shared/schema';

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

interface NewSiteForm {
  universityName: string;
  domain: string;
}

interface CloneForm {
  universityName: string;
  domain: string;
}

export default function Sites() {
  const { toast } = useToast();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<NewSiteForm>({ universityName: '', domain: '' });
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
      setNewForm({ universityName: '', domain: '' });
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
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                  <Button
                    data-testid="button-create-site"
                    onClick={() => createMutation.mutate(newForm)}
                    disabled={createMutation.isPending || !newForm.universityName || !newForm.domain}
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
                    <TableHead>University</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map(tenant => (
                    <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                      <TableCell className="font-medium">{tenant.universityName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Globe className="h-3 w-3" />
                          {tenant.domain}
                          {tenant.domain && (
                            <a
                              href={`https://${tenant.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANTS[tenant.status as string] ?? 'secondary'}
                          className="cursor-pointer"
                          onClick={() => {
                            const nextStatus = tenant.status === 'yayinda' ? 'taslak' : 'yayinda';
                            statusMutation.mutate({ id: tenant.id, status: nextStatus });
                          }}
                          data-testid={`badge-status-${tenant.id}`}
                        >
                          {STATUS_LABELS[tenant.status as string] ?? tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/sites/${tenant.id}`}>
                            <Button variant="ghost" size="icon" data-testid={`button-edit-${tenant.id}`}>
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          </Link>

                          <Dialog
                            open={cloneDialogOpen === tenant.id}
                            onOpenChange={open => {
                              setCloneDialogOpen(open ? tenant.id : null);
                              if (open) setCloneForm({ universityName: `${tenant.universityName} (Copy)`, domain: '' });
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-clone-${tenant.id}`}>
                                <Copy className="h-4 w-4" />
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
