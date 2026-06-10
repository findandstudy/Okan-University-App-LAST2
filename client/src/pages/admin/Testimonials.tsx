import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Upload, Star, Loader2, ImageIcon } from 'lucide-react';
import type { Testimonial, SupportedLanguage } from '@shared/schema';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ar', 'tr', 'fr', 'ru', 'fa', 'zh', 'hi', 'es', 'id'];
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  ar: 'Arabic',
  tr: 'Turkish',
  fr: 'French',
  ru: 'Russian',
  fa: 'Farsi',
  zh: 'Chinese',
  hi: 'Hindi',
  es: 'Spanish',
  id: 'Indonesian',
};

interface TestimonialForm {
  studentName: string;
  studentPhoto: string;
  country: string;
  programName: string;
  rating: number;
  displayOrder: number;
  isEnabled: boolean;
  contentByLang: Partial<Record<SupportedLanguage, string>>;
}

const initialFormState: TestimonialForm = {
  studentName: '',
  studentPhoto: '',
  country: '',
  programName: '',
  rating: 5,
  displayOrder: 0,
  isEnabled: true,
  contentByLang: {
    en: '', ar: '', tr: '', fr: '', ru: '', fa: '', zh: '', hi: '', es: '', id: '',
  },
};

export default function Testimonials({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix } = useSiteContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [formData, setFormData] = useState<TestimonialForm>(initialFormState);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: testimonials = [], isLoading } = useQuery<Testimonial[]>({
    queryKey: ['/api/testimonials' + apiSuffix],
  });

  const createMutation = useMutation({
    mutationFn: async (data: TestimonialForm) => {
      const response = await apiRequest('POST', '/api/testimonials' + apiSuffix, {
        ...data,
        tenantId: 'default',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/testimonials' + apiSuffix] });
      toast({ title: 'Testimonial created successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to create testimonial', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TestimonialForm> }) => {
      const response = await apiRequest('PATCH', `/api/testimonials/${id}${apiSuffix}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/testimonials' + apiSuffix] });
      toast({ title: 'Testimonial updated successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to update testimonial', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/testimonials/${id}${apiSuffix}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/testimonials' + apiSuffix] });
      toast({ title: 'Testimonial deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete testimonial', variant: 'destructive' });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTestimonial(null);
    setFormData(initialFormState);
    setSelectedLang('en');
  };

  const handleOpenEdit = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setFormData({
      studentName: testimonial.studentName,
      studentPhoto: testimonial.studentPhoto || '',
      country: testimonial.country || '',
      programName: testimonial.programName || '',
      rating: testimonial.rating || 5,
      displayOrder: testimonial.displayOrder || 0,
      isEnabled: testimonial.isEnabled ?? true,
      contentByLang: {
        en: (testimonial.contentByLang as Record<string, string>)?.en || '',
        ar: (testimonial.contentByLang as Record<string, string>)?.ar || '',
        tr: (testimonial.contentByLang as Record<string, string>)?.tr || '',
        fr: (testimonial.contentByLang as Record<string, string>)?.fr || '',
        ru: (testimonial.contentByLang as Record<string, string>)?.ru || '',
        fa: (testimonial.contentByLang as Record<string, string>)?.fa || '',
      },
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTestimonial) {
      updateMutation.mutate({ id: editingTestimonial.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      const photoUrl = result.objectPath;
      setFormData(prev => ({ ...prev, studentPhoto: photoUrl }));
      toast({ title: 'Photo uploaded successfully' });
    } catch (error) {
      toast({ title: 'Failed to upload photo', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleContentChange = (lang: SupportedLanguage, value: string) => {
    setFormData(prev => ({
      ...prev,
      contentByLang: {
        ...prev.contentByLang,
        [lang]: value,
      },
    }));
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <EmbeddableLayout embedded={embedded}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Testimonials</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-testimonial">
                <Plus className="h-4 w-4 mr-2" />
                Add Testimonial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTestimonial ? 'Edit Testimonial' : 'Add New Testimonial'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentName">Student Name *</Label>
                    <Input
                      id="studentName"
                      value={formData.studentName}
                      onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                      placeholder="Enter student name"
                      required
                      data-testid="input-student-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="e.g., Egypt, Brazil"
                      data-testid="input-country"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="programName">Program Name</Label>
                    <Input
                      id="programName"
                      value={formData.programName}
                      onChange={(e) => setFormData({ ...formData, programName: e.target.value })}
                      placeholder="e.g., Computer Engineering"
                      data-testid="input-program-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating</Label>
                    <Select
                      value={String(formData.rating)}
                      onValueChange={(value) => setFormData({ ...formData, rating: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-rating">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            {r} Star{r > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Student Photo</Label>
                  <div className="flex items-center gap-4">
                    {formData.studentPhoto ? (
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={formData.studentPhoto} alt="Student photo" />
                        <AvatarFallback>
                          {formData.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-photo"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Photo
                      </Button>
                      {formData.studentPhoto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() => setFormData({ ...formData, studentPhoto: '' })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Testimonial Content</Label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <Button
                        key={lang}
                        type="button"
                        size="sm"
                        variant={selectedLang === lang ? 'default' : 'outline'}
                        onClick={() => setSelectedLang(lang)}
                      >
                        {LANGUAGE_LABELS[lang]}
                        {formData.contentByLang[lang] && (
                          <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    value={formData.contentByLang[selectedLang]}
                    onChange={(e) => handleContentChange(selectedLang, e.target.value)}
                    placeholder={`Enter testimonial content in ${LANGUAGE_LABELS[selectedLang]}...`}
                    rows={4}
                    data-testid="textarea-content"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayOrder">Display Order</Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                      data-testid="input-display-order"
                    />
                  </div>
                  <div className="flex items-center justify-between space-y-0 pt-6">
                    <Label htmlFor="isEnabled">Enabled</Label>
                    <Switch
                      id="isEnabled"
                      checked={formData.isEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                      data-testid="switch-enabled"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-testimonial"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingTestimonial ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : testimonials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No testimonials yet. Click "Add Testimonial" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testimonials.map((testimonial) => (
                  <TableRow key={testimonial.id} data-testid={`testimonial-row-${testimonial.id}`}>
                    <TableCell>
                      <Avatar>
                        {testimonial.studentPhoto ? (
                          <AvatarImage src={testimonial.studentPhoto} alt={testimonial.studentName} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {testimonial.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{testimonial.studentName}</TableCell>
                    <TableCell>{testimonial.programName || '-'}</TableCell>
                    <TableCell>{testimonial.country || '-'}</TableCell>
                    <TableCell>{renderStars(testimonial.rating || 5)}</TableCell>
                    <TableCell>{testimonial.displayOrder}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${testimonial.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {testimonial.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(testimonial)}
                        data-testid={`button-edit-${testimonial.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this testimonial?')) {
                            deleteMutation.mutate(testimonial.id);
                          }
                        }}
                        data-testid={`button-delete-${testimonial.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </EmbeddableLayout>
  );
}
