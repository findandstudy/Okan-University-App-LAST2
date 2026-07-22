import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminLayout from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { UserPlus, Pencil, Trash2, ShieldCheck, User, Building2, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminErrorState from '@/components/admin/AdminErrorState';
import type { Tenant } from '@shared/schema';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string | null;
  tenantId: string | null;
  isActive: boolean | null;
  mustChangePassword: boolean | null;
  createdAt: string | null;
  passwordHash?: undefined;
}

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'super_admin']),
  tenantId: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'super_admin']),
  tenantId: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const NO_TENANT = '__none__';

export default function AdminUsers() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading, isError, error } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/admin/tenants'],
  });

  const { data: me } = useQuery<{ id: string; role: string }>({
    queryKey: ['/api/admin/me'],
  });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', email: '', password: '', role: 'admin', tenantId: '' },
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', email: '', role: 'admin', tenantId: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      apiRequest('POST', '/api/admin/users', {
        ...data,
        tenantId: data.tenantId === NO_TENANT || !data.tenantId ? null : data.tenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setCreateOpen(false);
      createForm.reset();
      toast({ title: 'Admin created', description: 'The new admin account has been created. They must change their password on first login.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to create admin', variant: 'destructive' });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditForm }) =>
      apiRequest('PATCH', `/api/admin/users/${id}`, {
        ...data,
        tenantId: data.tenantId === NO_TENANT || !data.tenantId ? null : data.tenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditTarget(null);
      toast({ title: 'Admin updated', description: 'Admin account has been updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to update admin', variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest('PATCH', `/api/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to toggle status', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setDeleteTarget(null);
      toast({ title: 'Admin deleted', description: 'The admin account has been removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to delete admin', variant: 'destructive' });
    },
  });

  const openEdit = (user: AdminUser) => {
    setEditTarget(user);
    editForm.reset({
      name: user.name,
      email: user.email,
      role: (user.role as 'admin' | 'super_admin') || 'admin',
      tenantId: user.tenantId || NO_TENANT,
    });
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return null;
    const t = tenants.find(t => t.id === tenantId);
    return t?.universityName || tenantId;
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Users</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage admin accounts and their site access permissions.
            </p>
          </div>
          <Button data-testid="button-create-admin" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              {users.length} admin account{users.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : isError ? (
              <AdminErrorState error={error} queryKey={['/api/admin/users']} className="rounded-b-lg" />
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No admin users found.</div>
            ) : (
              <div className="divide-y">
                {users.map(user => (
                  <div
                    key={user.id}
                    data-testid={`row-admin-${user.id}`}
                    className="flex items-center justify-between px-6 py-4 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        {user.role === 'super_admin'
                          ? <ShieldCheck className="h-4 w-4 text-primary" />
                          : <User className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span data-testid={`text-admin-name-${user.id}`} className="font-medium text-sm truncate">
                            {user.name}
                          </span>
                          {user.id === me?.id && (
                            <Badge variant="outline" className="text-xs shrink-0">You</Badge>
                          )}
                          {user.mustChangePassword && (
                            <Badge variant="secondary" className="text-xs shrink-0">Must change password</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        {user.tenantId && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {getTenantName(user.tenantId)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={user.role === 'super_admin' ? 'default' : 'secondary'}
                        data-testid={`badge-role-${user.id}`}
                      >
                        {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </Badge>
                      <Badge variant={user.isActive ? 'outline' : 'destructive'} className="text-xs">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-toggle-${user.id}`}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                        disabled={user.id === me?.id}
                        onClick={() => toggleMutation.mutate({ id: user.id, isActive: !user.isActive })}
                      >
                        {user.isActive
                          ? <ToggleRight className="h-4 w-4 text-green-600" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-edit-${user.id}`}
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-${user.id}`}
                        disabled={user.id === me?.id}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <FormField control={createForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input data-testid="input-admin-name" placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input data-testid="input-admin-email" type="email" placeholder="admin@university.edu" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary Password</FormLabel>
                  <FormControl><Input data-testid="input-admin-password" type="password" placeholder="Min. 8 characters" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-admin-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin (tenant-scoped)</SelectItem>
                      <SelectItem value="super_admin">Super Admin (all sites)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="tenantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Site <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <Select value={field.value || NO_TENANT} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-admin-tenant">
                        <SelectValue placeholder="No site restriction" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TENANT}>No site restriction</SelectItem>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.universityName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button data-testid="button-submit-create" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create Admin'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin User</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(d => editTarget && editMutation.mutate({ id: editTarget.id, data: d }))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input data-testid="input-edit-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input data-testid="input-edit-email" type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin (tenant-scoped)</SelectItem>
                      <SelectItem value="super_admin">Super Admin (all sites)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="tenantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Site <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <Select value={field.value || NO_TENANT} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-tenant">
                        <SelectValue placeholder="No site restriction" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TENANT}>No site restriction</SelectItem>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.universityName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button data-testid="button-submit-edit" type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
