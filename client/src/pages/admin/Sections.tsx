import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { GripVertical, Eye, EyeOff, Loader2, Pencil } from 'lucide-react';
import AdminLayout from './AdminLayout';
import type { Section, ContentByLang, SupportedLanguage } from '@shared/schema';

const DEFAULT_SECTIONS = [
  { key: 'hero', label: 'Hero Section' },
  { key: 'trust_badges', label: 'Trust Badges' },
  { key: 'program_finder', label: 'Program Finder' },
  { key: 'steps', label: 'Application Steps' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'faq', label: 'FAQ' },
  { key: 'contact', label: 'Contact Form' },
];

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'fa', label: 'فارسی' },
];

interface SectionState {
  id: string;
  key: string;
  label: string;
  isEnabled: boolean;
  contentByLang?: ContentByLang | null;
}

interface ContentForm {
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

const emptyContentForm: ContentForm = {
  title: '',
  subtitle: '',
  body: '',
  ctaLabel: '',
  ctaUrl: '',
};

export default function Sections() {
  const { toast } = useToast();
  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);
  const [editingSection, setEditingSection] = useState<SectionState | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('en');
  const [contentForms, setContentForms] = useState<Record<SupportedLanguage, ContentForm>>({
    en: { ...emptyContentForm },
    ar: { ...emptyContentForm },
    tr: { ...emptyContentForm },
    fr: { ...emptyContentForm },
    ru: { ...emptyContentForm },
    fa: { ...emptyContentForm },
  });

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  useEffect(() => {
    if (sections.length > 0) {
      setSectionStates(
        sections.map((section) => ({
          id: section.id,
          key: section.sectionKey,
          label: DEFAULT_SECTIONS.find((s) => s.key === section.sectionKey)?.label || section.sectionKey,
          isEnabled: section.isEnabled ?? true,
          contentByLang: section.contentByLang,
        }))
      );
    } else {
      setSectionStates(
        DEFAULT_SECTIONS.map((s, index) => ({
          id: `temp-${index}`,
          key: s.key,
          label: s.label,
          isEnabled: true,
          contentByLang: null,
        }))
      );
    }
  }, [sections]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; isEnabled: boolean }>) => {
      const response = await apiRequest('PATCH', '/api/sections', { sections: updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({
        title: 'Sections saved',
        description: 'Section visibility has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save sections',
        variant: 'destructive',
      });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, contentByLang }: { id: string; contentByLang: ContentByLang }) => {
      const response = await apiRequest('PATCH', `/api/sections/${id}`, { contentByLang });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({
        title: 'Content saved',
        description: 'Section content has been updated.',
      });
      setEditDialogOpen(false);
      setEditingSection(null);
    },
    onError: () => {
      toast({
        title: 'Failed to save content',
        variant: 'destructive',
      });
    },
  });

  const toggleSection = (key: string) => {
    setSectionStates((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, isEnabled: !section.isEnabled } : section
      )
    );
  };

  const handleSave = () => {
    const updates = sectionStates
      .filter((s) => !s.id.startsWith('temp-'))
      .map((s) => ({ id: s.id, isEnabled: s.isEnabled }));
    
    if (updates.length > 0) {
      updateMutation.mutate(updates);
    } else {
      toast({
        title: 'No sections to update',
        description: 'Sections have not been initialized in the database yet.',
        variant: 'destructive',
      });
    }
  };

  const handleEditSection = (section: SectionState) => {
    setEditingSection(section);
    
    const newForms: Record<SupportedLanguage, ContentForm> = {
      en: { ...emptyContentForm },
      ar: { ...emptyContentForm },
      tr: { ...emptyContentForm },
      fr: { ...emptyContentForm },
      ru: { ...emptyContentForm },
      fa: { ...emptyContentForm },
    };
    
    if (section.contentByLang) {
      for (const lang of LANGUAGES) {
        const content = section.contentByLang[lang.code];
        if (content) {
          newForms[lang.code] = {
            title: content.title || '',
            subtitle: content.subtitle || '',
            body: content.body || '',
            ctaLabel: content.ctaLabel || '',
            ctaUrl: content.ctaUrl || '',
          };
        }
      }
    }
    
    setContentForms(newForms);
    setActiveLanguage('en');
    setEditDialogOpen(true);
  };

  const handleContentChange = (field: keyof ContentForm, value: string) => {
    setContentForms((prev) => ({
      ...prev,
      [activeLanguage]: {
        ...prev[activeLanguage],
        [field]: value,
      },
    }));
  };

  const handleSaveContent = () => {
    if (!editingSection || editingSection.id.startsWith('temp-')) {
      toast({
        title: 'Cannot save',
        description: 'This section has not been initialized yet.',
        variant: 'destructive',
      });
      return;
    }

    const contentByLang: ContentByLang = {};
    for (const lang of LANGUAGES) {
      const form = contentForms[lang.code];
      if (form.title || form.subtitle || form.body || form.ctaLabel || form.ctaUrl) {
        contentByLang[lang.code] = {
          title: form.title || undefined,
          subtitle: form.subtitle || undefined,
          body: form.body || undefined,
          ctaLabel: form.ctaLabel || undefined,
          ctaUrl: form.ctaUrl || undefined,
        };
      }
    }

    updateContentMutation.mutate({ id: editingSection.id, contentByLang });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sections</h1>
          <p className="text-muted-foreground">Toggle, reorder, and edit landing page sections</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Landing Page Sections</CardTitle>
            <CardDescription>
              Enable or disable sections and edit their content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sectionStates.map((section) => (
                <div
                  key={section.key}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    section.isEnabled ? 'bg-card' : 'bg-muted/50'
                  }`}
                  data-testid={`section-item-${section.key}`}
                >
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <p className={`font-medium ${!section.isEnabled && 'text-muted-foreground'}`}>
                      {section.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {section.isEnabled ? 'Visible on landing page' : 'Hidden from landing page'}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditSection(section)}
                    title="Edit content"
                    data-testid={`button-edit-section-${section.key}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-3">
                    {section.isEnabled ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={section.isEnabled}
                      onCheckedChange={() => toggleSection(section.key)}
                      data-testid={`switch-section-${section.key}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-sections"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editingSection?.label} Content</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeLanguage} onValueChange={(v) => setActiveLanguage(v as SupportedLanguage)}>
            <TabsList className="grid grid-cols-6 w-full">
              {LANGUAGES.map((lang) => (
                <TabsTrigger key={lang.code} value={lang.code} data-testid={`tab-${lang.code}`}>
                  {lang.code.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {LANGUAGES.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={contentForms[lang.code].title}
                    onChange={(e) => handleContentChange('title', e.target.value)}
                    placeholder="Section title..."
                    className="mt-1.5"
                    dir={lang.code === 'ar' || lang.code === 'fa' ? 'rtl' : 'ltr'}
                    data-testid={`input-title-${lang.code}`}
                  />
                </div>
                
                <div>
                  <Label>Subtitle</Label>
                  <Input
                    value={contentForms[lang.code].subtitle}
                    onChange={(e) => handleContentChange('subtitle', e.target.value)}
                    placeholder="Section subtitle..."
                    className="mt-1.5"
                    dir={lang.code === 'ar' || lang.code === 'fa' ? 'rtl' : 'ltr'}
                    data-testid={`input-subtitle-${lang.code}`}
                  />
                </div>
                
                <div>
                  <Label>Body Content</Label>
                  <Textarea
                    value={contentForms[lang.code].body}
                    onChange={(e) => handleContentChange('body', e.target.value)}
                    placeholder="Main content..."
                    rows={4}
                    className="mt-1.5"
                    dir={lang.code === 'ar' || lang.code === 'fa' ? 'rtl' : 'ltr'}
                    data-testid={`input-body-${lang.code}`}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CTA Button Label</Label>
                    <Input
                      value={contentForms[lang.code].ctaLabel}
                      onChange={(e) => handleContentChange('ctaLabel', e.target.value)}
                      placeholder="Button text..."
                      className="mt-1.5"
                      dir={lang.code === 'ar' || lang.code === 'fa' ? 'rtl' : 'ltr'}
                      data-testid={`input-cta-label-${lang.code}`}
                    />
                  </div>
                  <div>
                    <Label>CTA Button URL</Label>
                    <Input
                      value={contentForms[lang.code].ctaUrl}
                      onChange={(e) => handleContentChange('ctaUrl', e.target.value)}
                      placeholder="/apply or https://..."
                      className="mt-1.5"
                      data-testid={`input-cta-url-${lang.code}`}
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveContent}
              disabled={updateContentMutation.isPending}
              className="flex-1"
              data-testid="button-save-section-content"
            >
              {updateContentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
