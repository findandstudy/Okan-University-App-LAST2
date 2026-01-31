import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Upload, Download, Loader2 } from 'lucide-react';
import type { Program } from '@shared/schema';
import AdminLayout from './AdminLayout';

const DEGREE_OPTIONS = ['Bachelor', 'Master', 'PhD', 'Associate', 'Certificate'];
const LANGUAGE_OPTIONS = ['English', 'Turkish', 'Arabic', 'French', 'German'];

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

  const filteredPrograms = programs.filter((program) =>
    program.programName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    program.degree.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

          <div className="flex gap-2">
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
            ) : filteredPrograms.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No programs found. Add your first program to get started.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Degree</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Discounted</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrograms.map((program) => (
                      <TableRow key={program.id} data-testid={`program-row-${program.id}`}>
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
