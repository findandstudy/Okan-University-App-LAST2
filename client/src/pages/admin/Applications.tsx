import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Eye, RefreshCw, Mail, Search, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Loader2 } from 'lucide-react';
import type { Application, Document as DocType, Program, Lead } from '@shared/schema';
import AdminLayout from './AdminLayout';

const STATUS_OPTIONS = ['All', 'draft', 'submitted', 'processing', 'approved', 'rejected'];

type SortField = 'id' | 'applicant' | 'program' | 'status' | 'submittedAt';
type SortDirection = 'asc' | 'desc';

interface ApplicationWithDetails extends Application {
  lead?: Lead;
  program?: Program;
  documents?: DocType[];
}

export default function Applications() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/applications/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      setSelectedIds(new Set());
      toast({ title: 'Applications deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete applications', variant: 'destructive' });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getApplicantName = (app: Application) => {
    const applicantData = app.applicantData as { fullName?: string; firstName?: string; lastName?: string } | null;
    if (applicantData?.fullName) return applicantData.fullName;
    if (applicantData?.firstName && applicantData?.lastName) {
      return `${applicantData.firstName} ${applicantData.lastName}`;
    }
    const lead = leads.find(l => l.id === app.leadId);
    return lead?.fullName || 'N/A';
  };

  const getProgramName = (app: Application) => {
    if (!app.programId) return 'Not selected';
    const program = programs.find(p => p.id === app.programId);
    return program?.programName || app.programId.slice(0, 8) + '...';
  };

  const filteredAndSortedApplications = useMemo(() => {
    let filtered = applications.filter((app) => {
      const matchesSearch = !searchQuery ||
        app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getApplicantName(app).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'applicant':
          comparison = getApplicantName(a).localeCompare(getApplicantName(b));
          break;
        case 'program':
          comparison = getProgramName(a).localeCompare(getProgramName(b));
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'submittedAt':
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [applications, searchQuery, statusFilter, sortField, sortDirection, leads, programs]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedApplications.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleViewDetails = async (app: Application) => {
    const lead = leads.find(l => l.id === app.leadId);
    const program = app.programId ? programs.find(p => p.id === app.programId) : undefined;
    
    setSelectedApplicationId(app.id);
    setSelectedApplication({ ...app, lead, program, documents: [] });
    setDetailsOpen(true);
    setIsLoadingDocuments(true);
    
    try {
      const response = await apiRequest('GET', `/api/applications/${app.id}/documents`);
      const documents: DocType[] = await response.json();
      setSelectedApplication(prev => prev ? { ...prev, documents } : null);
    } catch (e) {
      console.error('Failed to fetch documents', e);
      toast({ 
        title: 'Failed to load documents', 
        description: 'Could not fetch application documents.',
        variant: 'destructive' 
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} application(s)?`)) {
      deleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${styles[status] || styles.draft}`}>
        {status}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-muted-foreground">Review and manage student applications</p>
          </div>
          {selectedIds.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-bulk-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-applications"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'All' ? 'All Statuses' : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredAndSortedApplications.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No applications found.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredAndSortedApplications.length && filteredAndSortedApplications.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('id')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-id"
                        >
                          Application ID <SortIcon field="id" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('applicant')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-applicant"
                        >
                          Applicant <SortIcon field="applicant" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('program')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-program"
                        >
                          Program <SortIcon field="program" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('status')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-status"
                        >
                          Status <SortIcon field="status" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('submittedAt')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-date"
                        >
                          Submitted <SortIcon field="submittedAt" />
                        </button>
                      </TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedApplications.map((app) => (
                      <TableRow key={app.id} data-testid={`application-row-${app.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(app.id)}
                            onCheckedChange={() => toggleSelect(app.id)}
                            data-testid={`checkbox-${app.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {app.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {getApplicantName(app)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getProgramName(app)}
                        </TableCell>
                        <TableCell>{getStatusBadge(app.status || 'draft')}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {app.submittedAt
                            ? new Date(app.submittedAt).toLocaleDateString()
                            : app.createdAt
                            ? new Date(app.createdAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View details"
                              onClick={() => handleViewDetails(app)}
                              data-testid={`button-view-${app.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Resend webhook"
                              data-testid={`button-resend-webhook-${app.id}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Resend email"
                              data-testid={`button-resend-email-${app.id}`}
                            >
                              <Mail className="h-4 w-4" />
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
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Application Details</SheetTitle>
            <SheetDescription>
              ID: {selectedApplication?.id?.slice(0, 8)}...
            </SheetDescription>
          </SheetHeader>
          
          {selectedApplication && (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Status</h3>
                {getStatusBadge(selectedApplication.status || 'draft')}
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Applicant Information</h3>
                <dl className="space-y-2 text-sm">
                  {selectedApplication.lead && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Full Name</dt>
                        <dd className="font-medium">{selectedApplication.lead.fullName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd className="font-medium">{selectedApplication.lead.email}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Phone</dt>
                        <dd className="font-medium">{selectedApplication.lead.phone}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Country</dt>
                        <dd className="font-medium">{selectedApplication.lead.countryCode}</dd>
                      </div>
                    </>
                  )}
                  {(() => {
                    if (!selectedApplication.applicantData || typeof selectedApplication.applicantData !== 'object') {
                      return null;
                    }
                    const data = selectedApplication.applicantData as Record<string, string | number | boolean | null>;
                    const excludeFields = ['fullName', 'email', 'phone', 'countryCode'];
                    return Object.keys(data)
                      .filter(key => !excludeFields.includes(key))
                      .map((key) => (
                        <div key={key} className="flex justify-between">
                          <dt className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                          <dd className="font-medium">{data[key] != null ? String(data[key]) : '-'}</dd>
                        </div>
                      ));
                  })()}
                </dl>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Program</h3>
                {selectedApplication.program ? (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{selectedApplication.program.programName}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedApplication.program.degree} • {selectedApplication.program.language}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No program selected</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Documents</h3>
                {isLoadingDocuments ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading documents...</span>
                  </div>
                ) : selectedApplication.documents && selectedApplication.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedApplication.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        data-testid={`document-${doc.id}`}
                      >
                        <FileText className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType} • {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No documents uploaded</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Timeline</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium">
                      {selectedApplication.createdAt 
                        ? new Date(selectedApplication.createdAt).toLocaleString() 
                        : '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Submitted</dt>
                    <dd className="font-medium">
                      {selectedApplication.submittedAt 
                        ? new Date(selectedApplication.submittedAt).toLocaleString() 
                        : 'Not submitted yet'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
