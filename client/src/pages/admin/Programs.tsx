import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Upload, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Program } from '@shared/schema';
import AdminLayout from './AdminLayout';

const DEGREE_OPTIONS = ['Bachelor', 'Master', 'PhD', 'Associate', 'Certificate'];
const LANGUAGE_OPTIONS = ['English', 'Turkish', 'Arabic', 'French', 'German'];

type SortField = 'programName' | 'degree' | 'language' | 'tuitionFee' | 'discountedFee';
type SortDirection = 'asc' | 'desc';

interface ProgramForm {
  universityName: string;
  programName: string;
  degree: string;
  language: string;
  tuitionFee: string;
  discountedFee: string;
  externalProgramId: string;
}

const initialFormState: ProgramForm = {
  universityName: 'Okan University',
  programName: '',
  degree: 'Bachelor',
  language: 'English',
  tuitionFee: '',
  discountedFee: '',
  externalProgramId: '',
};

export default function Programs() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramForm>(initialFormState);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('programName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProgramForm) => {
      const response = await apiRequest('POST', '/api/programs', {
        ...data,
        tenantId: 'default',
        tuitionFee: data.tuitionFee,
        discountedFee: data.discountedFee || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      toast({ title: 'Program created successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to create program', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProgramForm }) => {
      const response = await apiRequest('PATCH', `/api/programs/${id}`, {
        ...data,
        tuitionFee: data.tuitionFee,
        discountedFee: data.discountedFee || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      toast({ title: 'Program updated successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to update program', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      toast({ title: 'Program deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete program', variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/programs/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      setSelectedIds(new Set());
      toast({ title: 'Programs deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete programs', variant: 'destructive' });
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

  const filteredAndSortedPrograms = useMemo(() => {
    let filtered = programs.filter((program) =>
      program.programName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.degree.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'programName':
          comparison = a.programName.localeCompare(b.programName);
          break;
        case 'degree':
          comparison = a.degree.localeCompare(b.degree);
          break;
        case 'language':
          comparison = a.language.localeCompare(b.language);
          break;
        case 'tuitionFee':
          comparison = parseFloat(a.tuitionFee) - parseFloat(b.tuitionFee);
          break;
        case 'discountedFee':
          const feeA = a.discountedFee ? parseFloat(a.discountedFee) : Infinity;
          const feeB = b.discountedFee ? parseFloat(b.discountedFee) : Infinity;
          comparison = feeA - feeB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [programs, searchQuery, sortField, sortDirection]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedPrograms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedPrograms.map(p => p.id)));
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} program(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProgram(null);
    setFormData(initialFormState);
  };

  const handleEdit = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      universityName: program.universityName,
      programName: program.programName,
      degree: program.degree,
      language: program.language,
      tuitionFee: program.tuitionFee.toString(),
      discountedFee: program.discountedFee?.toString() || '',
      externalProgramId: program.externalProgramId || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const downloadTemplate = () => {
    const csv = 'university,program_name,degree,language,tuition_fee,discounted_fee,external_program_id\nOkan University,Computer Engineering,Bachelor,English,12000,8500,\nOkan University,Business Administration,Master,English,10000,7000,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'programs_template.csv';
    a.click();
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Programs</h1>
            <p className="text-muted-foreground">Manage your university programs</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete-programs"
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              CSV Template
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-program">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Program
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingProgram ? 'Edit Program' : 'Add New Program'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Program Name *</Label>
                    <Input
                      value={formData.programName}
                      onChange={(e) =>
                        setFormData({ ...formData, programName: e.target.value })
                      }
                      placeholder="e.g., Computer Engineering"
                      className="mt-1.5"
                      required
                      data-testid="input-program-name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Degree *</Label>
                      <Select
                        value={formData.degree}
                        onValueChange={(value) =>
                          setFormData({ ...formData, degree: value })
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEGREE_OPTIONS.map((degree) => (
                            <SelectItem key={degree} value={degree}>
                              {degree}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Language *</Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) =>
                          setFormData({ ...formData, language: value })
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tuition Fee (USD) *</Label>
                      <Input
                        type="number"
                        value={formData.tuitionFee}
                        onChange={(e) =>
                          setFormData({ ...formData, tuitionFee: e.target.value })
                        }
                        placeholder="12000"
                        className="mt-1.5"
                        required
                        data-testid="input-tuition-fee"
                      />
                    </div>

                    <div>
                      <Label>Discounted Fee (USD)</Label>
                      <Input
                        type="number"
                        value={formData.discountedFee}
                        onChange={(e) =>
                          setFormData({ ...formData, discountedFee: e.target.value })
                        }
                        placeholder="8500"
                        className="mt-1.5"
                        data-testid="input-discounted-fee"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>External Program ID</Label>
                    <Input
                      value={formData.externalProgramId}
                      onChange={(e) =>
                        setFormData({ ...formData, externalProgramId: e.target.value })
                      }
                      placeholder="Optional: for portal integration"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-program"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingProgram ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-programs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredAndSortedPrograms.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No programs found. Add your first program to get started.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredAndSortedPrograms.length && filteredAndSortedPrograms.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all-programs"
                        />
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('programName')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-program-name"
                        >
                          Program <SortIcon field="programName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('degree')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-degree"
                        >
                          Degree <SortIcon field="degree" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('language')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-language"
                        >
                          Language <SortIcon field="language" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('tuitionFee')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-fee"
                        >
                          Fee <SortIcon field="tuitionFee" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort('discountedFee')} 
                          className="flex items-center font-medium hover:text-foreground"
                          data-testid="sort-discounted"
                        >
                          Discounted <SortIcon field="discountedFee" />
                        </button>
                      </TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedPrograms.map((program) => (
                      <TableRow key={program.id} data-testid={`program-row-${program.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(program.id)}
                            onCheckedChange={() => toggleSelect(program.id)}
                            data-testid={`checkbox-program-${program.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{program.programName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{program.degree}</Badge>
                        </TableCell>
                        <TableCell>{program.language}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatCurrency(program.tuitionFee)}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {program.discountedFee
                            ? formatCurrency(program.discountedFee)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(program)}
                              data-testid={`button-edit-program-${program.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(program.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-program-${program.id}`}
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
      </div>
    </AdminLayout>
  );
}
