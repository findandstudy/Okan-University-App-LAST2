import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Loader2, HelpCircle } from 'lucide-react';
import type { FaqItem, SupportedLanguage } from '@shared/schema';
import AdminLayout from './AdminLayout';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ar', 'tr', 'fr', 'ru', 'fa'];
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  ar: 'Arabic',
  tr: 'Turkish',
  fr: 'French',
  ru: 'Russian',
  fa: 'Farsi',
};

interface FAQForm {
  displayOrder: number;
  isEnabled: boolean;
  questionByLang: Record<SupportedLanguage, string>;
  answerByLang: Record<SupportedLanguage, string>;
}

const initialFormState: FAQForm = {
  displayOrder: 0,
  isEnabled: true,
  questionByLang: {
    en: '',
    ar: '',
    tr: '',
    fr: '',
    ru: '',
    fa: '',
  },
  answerByLang: {
    en: '',
    ar: '',
    tr: '',
    fr: '',
    ru: '',
    fa: '',
  },
};

export default function FAQ() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [formData, setFormData] = useState<FAQForm>(initialFormState);
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('en');

  const { data: faqItems = [], isLoading } = useQuery<FaqItem[]>({
    queryKey: ['/api/faq'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FAQForm) => {
      const response = await apiRequest('POST', '/api/faq', {
        ...data,
        tenantId: 'default',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faq'] });
      toast({ title: 'FAQ item created successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to create FAQ item', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FAQForm> }) => {
      const response = await apiRequest('PATCH', `/api/faq/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faq'] });
      toast({ title: 'FAQ item updated successfully' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Failed to update FAQ item', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/faq/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faq'] });
      toast({ title: 'FAQ item deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete FAQ item', variant: 'destructive' });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFaq(null);
    setFormData(initialFormState);
    setSelectedLang('en');
  };

  const handleOpenEdit = (faq: FaqItem) => {
    setEditingFaq(faq);
    setFormData({
      displayOrder: faq.displayOrder || 0,
      isEnabled: faq.isEnabled ?? true,
      questionByLang: {
        en: (faq.questionByLang as Record<string, string>)?.en || '',
        ar: (faq.questionByLang as Record<string, string>)?.ar || '',
        tr: (faq.questionByLang as Record<string, string>)?.tr || '',
        fr: (faq.questionByLang as Record<string, string>)?.fr || '',
        ru: (faq.questionByLang as Record<string, string>)?.ru || '',
        fa: (faq.questionByLang as Record<string, string>)?.fa || '',
      },
      answerByLang: {
        en: (faq.answerByLang as Record<string, string>)?.en || '',
        ar: (faq.answerByLang as Record<string, string>)?.ar || '',
        tr: (faq.answerByLang as Record<string, string>)?.tr || '',
        fr: (faq.answerByLang as Record<string, string>)?.fr || '',
        ru: (faq.answerByLang as Record<string, string>)?.ru || '',
        fa: (faq.answerByLang as Record<string, string>)?.fa || '',
      },
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.questionByLang.en || !formData.answerByLang.en) {
      toast({ title: 'English question and answer are required', variant: 'destructive' });
      return;
    }
    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleQuestionChange = (lang: SupportedLanguage, value: string) => {
    setFormData(prev => ({
      ...prev,
      questionByLang: {
        ...prev.questionByLang,
        [lang]: value,
      },
    }));
  };

  const handleAnswerChange = (lang: SupportedLanguage, value: string) => {
    setFormData(prev => ({
      ...prev,
      answerByLang: {
        ...prev.answerByLang,
        [lang]: value,
      },
    }));
  };

  return (
    <AdminLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>FAQ Management</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-faq">
                <Plus className="h-4 w-4 mr-2" />
                Add FAQ Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingFaq ? 'Edit FAQ Item' : 'Add New FAQ Item'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <div className="flex gap-2 flex-wrap">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <Button
                        key={lang}
                        type="button"
                        size="sm"
                        variant={selectedLang === lang ? 'default' : 'outline'}
                        onClick={() => setSelectedLang(lang)}
                        data-testid={`button-lang-${lang}`}
                      >
                        {LANGUAGE_LABELS[lang]}
                        {(formData.questionByLang[lang] || formData.answerByLang[lang]) && (
                          <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question">
                    Question ({LANGUAGE_LABELS[selectedLang]}) {selectedLang === 'en' && '*'}
                  </Label>
                  <Input
                    id="question"
                    value={formData.questionByLang[selectedLang]}
                    onChange={(e) => handleQuestionChange(selectedLang, e.target.value)}
                    placeholder={`Enter question in ${LANGUAGE_LABELS[selectedLang]}...`}
                    data-testid="input-question"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">
                    Answer ({LANGUAGE_LABELS[selectedLang]}) {selectedLang === 'en' && '*'}
                  </Label>
                  <Textarea
                    id="answer"
                    value={formData.answerByLang[selectedLang]}
                    onChange={(e) => handleAnswerChange(selectedLang, e.target.value)}
                    placeholder={`Enter answer in ${LANGUAGE_LABELS[selectedLang]}...`}
                    rows={4}
                    data-testid="textarea-answer"
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
                    data-testid="button-save-faq"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingFaq ? 'Update' : 'Create'}
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
          ) : faqItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No FAQ items yet. Click "Add FAQ Item" to create one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Order</TableHead>
                  <TableHead>Question (English)</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqItems.map((faq) => {
                  const questionLangs = SUPPORTED_LANGUAGES.filter(
                    lang => (faq.questionByLang as Record<string, string>)?.[lang]
                  );
                  return (
                    <TableRow key={faq.id} data-testid={`faq-row-${faq.id}`}>
                      <TableCell className="font-medium">{faq.displayOrder}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="truncate">
                          {(faq.questionByLang as Record<string, string>)?.en || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {questionLangs.map(lang => (
                            <span
                              key={lang}
                              className="px-1.5 py-0.5 rounded text-xs bg-muted font-medium"
                            >
                              {lang.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${faq.isEnabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                          {faq.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(faq)}
                          data-testid={`button-edit-${faq.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this FAQ item?')) {
                              deleteMutation.mutate(faq.id);
                            }
                          }}
                          data-testid={`button-delete-${faq.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
