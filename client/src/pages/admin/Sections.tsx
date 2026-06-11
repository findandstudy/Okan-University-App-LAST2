import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { GripVertical, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';
import type { Section, ContentByLang, SupportedLanguage } from '@shared/schema';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

const SECTION_TYPES = [
  { key: 'hero', label: 'Hero Section' },
  { key: 'trust_badges', label: 'Trust Badges' },
  { key: 'program_finder', label: 'Program Finder' },
  { key: 'steps', label: 'Application Steps' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'faq', label: 'FAQ' },
  { key: 'contact', label: 'Contact Form' },
  { key: 'chatbox', label: 'Chat Widget' },
  { key: 'stats', label: 'Statistics / Counters' },
  { key: 'embed', label: 'Embed (Calendly, Typeform, YouTube…)' },
  { key: 'map', label: 'Map (Google Maps)' },
  { key: 'html_block', label: 'Custom HTML Block' },
  { key: 'custom', label: 'Custom Section' },
];

const getSectionLabel = (key: string) => {
  return SECTION_TYPES.find(s => s.key === key)?.label || key;
};

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'fa', label: 'فارسی' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

const WIDGET_SECTION_KEYS = ['embed', 'map', 'html_block', 'stats'];

interface SectionState {
  id: string;
  key: string;
  label: string;
  isEnabled: boolean;
  contentByLang?: ContentByLang | null;
  settings?: Record<string, unknown> | null;
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

interface StatItem {
  value: string;
  label: string;
}

export default function Sections({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);

  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);
  const [editingSection, setEditingSection] = useState<SectionState | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newSectionDialogOpen, setNewSectionDialogOpen] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState('');
  const [customSectionName, setCustomSectionName] = useState('');
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('en');
  const [contentForms, setContentForms] = useState<Record<SupportedLanguage, ContentForm>>({
    en: { ...emptyContentForm },
    ar: { ...emptyContentForm },
    tr: { ...emptyContentForm },
    fr: { ...emptyContentForm },
    ru: { ...emptyContentForm },
    fa: { ...emptyContentForm },
    zh: { ...emptyContentForm },
    hi: { ...emptyContentForm },
    es: { ...emptyContentForm },
    id: { ...emptyContentForm },
  });

  // Widget-specific settings (not language-dependent)
  const [settingsForm, setSettingsForm] = useState<Record<string, unknown>>({});

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections' + apiSuffix],
  });

  useEffect(() => {
    if (sections.length > 0) {
      setSectionStates(
        sections.map((section) => ({
          id: section.id,
          key: section.sectionKey,
          label: getSectionLabel(section.sectionKey),
          isEnabled: section.isEnabled ?? true,
          contentByLang: section.contentByLang,
          settings: section.settings as Record<string, unknown> | null,
        }))
      );
    }
  }, [sections]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; isEnabled: boolean; displayOrder: number }>) => {
      const response = await apiRequest('PATCH', '/api/sections' + apiSuffix, { sections: updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Sections saved', description: 'Order and visibility updated.' });
    },
    onError: () => {
      toast({ title: 'Failed to save sections', variant: 'destructive' });
    },
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      const enContent = contentForms['en'];
      const response = await apiRequest('POST', `/api/admin/ai/translate${apiSuffix}`, {
        sourceContent: enContent,
        sourceLang: 'en',
        targetLangs: LANGUAGES.filter(l => l.code !== 'en').map(l => l.code),
      });
      return response.json();
    },
    onSuccess: (data: Record<string, Record<string, string>>) => {
      setContentForms(prev => {
        const updated = { ...prev };
        for (const [lang, content] of Object.entries(data)) {
          updated[lang as SupportedLanguage] = { ...prev[lang as SupportedLanguage], ...content };
        }
        return updated;
      });
      toast({ title: 'Translated!', description: 'All language tabs have been filled.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Translation failed', description: err.message || 'Check your AI settings.', variant: 'destructive' });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, contentByLang, settings }: { id: string; contentByLang: ContentByLang; settings?: Record<string, unknown> }) => {
      const response = await apiRequest('PATCH', `/api/sections/${id}${apiSuffix}`, { contentByLang, settings });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Content saved', description: 'Section content has been updated.' });
      setEditDialogOpen(false);
      setEditingSection(null);
    },
    onError: () => {
      toast({ title: 'Failed to save content', variant: 'destructive' });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: { sectionKey: string; displayOrder: number }) => {
      const response = await apiRequest('POST', '/api/sections' + apiSuffix, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Section created', description: 'New section has been added.' });
      setNewSectionDialogOpen(false);
      setNewSectionKey('');
      setCustomSectionName('');
    },
    onError: () => {
      toast({ title: 'Failed to create section', variant: 'destructive' });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/sections/${id}${apiSuffix}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Section deleted', description: 'Section has been removed.' });
    },
    onError: () => {
      toast({ title: 'Failed to delete section', variant: 'destructive' });
    },
  });

  // ─── Drag-and-drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const dragIdx = sectionStates.findIndex(s => s.id === draggedId);
    const dropIdx = sectionStates.findIndex(s => s.id === targetId);
    if (dragIdx < 0 || dropIdx < 0) { setDraggedId(null); return; }
    const newStates = [...sectionStates];
    const [removed] = newStates.splice(dragIdx, 1);
    newStates.splice(dropIdx, 0, removed);
    setSectionStates(newStates);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // ─── Actions ────────────────────────────────────────────────────────────────
  const toggleSection = (key: string) => {
    setSectionStates(prev =>
      prev.map(section => section.key === key ? { ...section, isEnabled: !section.isEnabled } : section)
    );
  };

  const handleSave = () => {
    const updates = sectionStates
      .filter(s => !s.id.startsWith('temp-'))
      .map((s, index) => ({ id: s.id, isEnabled: s.isEnabled, displayOrder: index }));

    if (updates.length > 0) {
      updateMutation.mutate(updates);
    } else {
      toast({ title: 'No sections to update', variant: 'destructive' });
    }
  };

  const handleEditSection = (section: SectionState) => {
    setEditingSection(section);

    const newForms: Record<SupportedLanguage, ContentForm> = {
      en: { ...emptyContentForm }, ar: { ...emptyContentForm }, tr: { ...emptyContentForm },
      fr: { ...emptyContentForm }, ru: { ...emptyContentForm }, fa: { ...emptyContentForm },
      zh: { ...emptyContentForm }, hi: { ...emptyContentForm }, es: { ...emptyContentForm },
      id: { ...emptyContentForm },
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
    setSettingsForm((section.settings as Record<string, unknown>) || {});
    setActiveLanguage('en');
    setEditDialogOpen(true);
  };

  const handleContentChange = (field: keyof ContentForm, value: string) => {
    setContentForms(prev => ({
      ...prev,
      [activeLanguage]: { ...prev[activeLanguage], [field]: value },
    }));
  };

  const handleSaveContent = () => {
    if (!editingSection || editingSection.id.startsWith('temp-')) {
      toast({ title: 'Cannot save', description: 'Section not initialized.', variant: 'destructive' });
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
    updateContentMutation.mutate({
      id: editingSection.id,
      contentByLang,
      settings: Object.keys(settingsForm).length > 0 ? settingsForm : undefined,
    });
  };

  const handleCreateSection = () => {
    if (!newSectionKey) {
      toast({ title: 'Please select a section type', variant: 'destructive' });
      return;
    }
    const sectionKey = newSectionKey === 'custom'
      ? (customSectionName.toLowerCase().replace(/\s+/g, '_') || 'custom_section')
      : newSectionKey;
    const maxOrder = sectionStates.reduce((max, s) => {
      const order = sections.find(sec => sec.id === s.id)?.displayOrder ?? 0;
      return Math.max(max, order);
    }, 0);
    createSectionMutation.mutate({ sectionKey, displayOrder: maxOrder + 1 });
  };

  const handleDeleteSection = (section: SectionState) => {
    if (confirm(`Are you sure you want to delete "${section.label}"?`)) {
      deleteSectionMutation.mutate(section.id);
    }
  };

  // ─── Stat items helpers ──────────────────────────────────────────────────────
  const getStatItems = (): StatItem[] => (settingsForm.items as StatItem[]) || [];
  const setStatItems = (items: StatItem[]) => setSettingsForm(prev => ({ ...prev, items }));

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
    <EmbeddableLayout embedded={embedded}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Page Sections</h1>
          <p className="text-muted-foreground">Drag to reorder, toggle visibility, and edit content</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Landing Page Sections</CardTitle>
              <CardDescription>Drag the grip handle to reorder sections</CardDescription>
            </div>
            <Button onClick={() => setNewSectionDialogOpen(true)} data-testid="button-add-section">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </CardHeader>
          <CardContent>
            {sectionStates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No sections yet. Click "Add Section" to create your first section.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sectionStates.map((section) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, section.id)}
                    onDragOver={(e) => handleDragOver(e, section.id)}
                    onDrop={(e) => handleDrop(e, section.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all select-none ${
                      section.isEnabled ? 'bg-card' : 'bg-muted/50'
                    } ${draggedId === section.id ? 'opacity-40 scale-95' : ''}
                    ${dragOverId === section.id && draggedId !== section.id ? 'border-primary border-2 bg-primary/5' : ''}`}
                    data-testid={`section-item-${section.id}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
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
                      title="Edit content / widget settings"
                      data-testid={`button-edit-section-${section.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSection(section)}
                      title="Delete section"
                      disabled={deleteSectionMutation.isPending}
                      data-testid={`button-delete-section-${section.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-sections">
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Order & Visibility
          </Button>
        </div>
      </div>

      {/* ─── Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editingSection?.label}</DialogTitle>
            <DialogDescription>Configure content and settings for this section.</DialogDescription>
          </DialogHeader>

          {/* Widget-specific settings (outside language tabs) */}
          {editingSection && WIDGET_SECTION_KEYS.includes(editingSection.key) && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <p className="font-medium text-sm">Widget Settings</p>

              {editingSection.key === 'embed' && (
                <div className="space-y-3">
                  <div>
                    <Label>iFrame URL</Label>
                    <Input
                      value={(settingsForm.iframeUrl as string) || ''}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, iframeUrl: e.target.value }))}
                      placeholder="https://calendly.com/… or https://www.youtube.com/embed/…"
                      className="mt-1.5"
                      data-testid="input-embed-url"
                    />
                  </div>
                  <div>
                    <Label>Embed Code (alternative to URL)</Label>
                    <Textarea
                      value={(settingsForm.embedCode as string) || ''}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, embedCode: e.target.value }))}
                      placeholder="<script>…</script> or <iframe…>"
                      rows={3}
                      className="mt-1.5 font-mono text-xs"
                      data-testid="input-embed-code"
                    />
                  </div>
                  <div>
                    <Label>Height (px)</Label>
                    <Input
                      type="number"
                      value={(settingsForm.height as number) || 500}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, height: parseInt(e.target.value) || 500 }))}
                      className="mt-1.5 w-32"
                      data-testid="input-embed-height"
                    />
                  </div>
                </div>
              )}

              {editingSection.key === 'map' && (
                <div className="space-y-3">
                  <div>
                    <Label>Google Maps Embed URL</Label>
                    <Input
                      value={(settingsForm.mapUrl as string) || ''}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, mapUrl: e.target.value }))}
                      placeholder="https://www.google.com/maps/embed?pb=…"
                      className="mt-1.5"
                      data-testid="input-map-url"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Google Maps → Share → Embed a map → copy the <code>src</code> value
                    </p>
                  </div>
                  <div>
                    <Label>Height (px)</Label>
                    <Input
                      type="number"
                      value={(settingsForm.height as number) || 400}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, height: parseInt(e.target.value) || 400 }))}
                      className="mt-1.5 w-32"
                      data-testid="input-map-height"
                    />
                  </div>
                </div>
              )}

              {editingSection.key === 'html_block' && (
                <div>
                  <Label>HTML Content</Label>
                  <Textarea
                    value={(settingsForm.html as string) || ''}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, html: e.target.value }))}
                    placeholder="<div class='my-widget'>…</div>"
                    rows={8}
                    className="mt-1.5 font-mono text-xs"
                    data-testid="input-html-content"
                  />
                </div>
              )}

              {editingSection.key === 'stats' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Statistics Items</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStatItems([...getStatItems(), { value: '', label: '' }])}
                      data-testid="button-add-stat"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Stat
                    </Button>
                  </div>
                  {getStatItems().length === 0 && (
                    <p className="text-sm text-muted-foreground">No items yet. Click "Add Stat".</p>
                  )}
                  {getStatItems().map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={item.value}
                        onChange={(e) => {
                          const items = [...getStatItems()];
                          items[idx] = { ...items[idx], value: e.target.value };
                          setStatItems(items);
                        }}
                        placeholder="15,000+"
                        className="w-28"
                        data-testid={`input-stat-value-${idx}`}
                      />
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const items = [...getStatItems()];
                          items[idx] = { ...items[idx], label: e.target.value };
                          setStatItems(items);
                        }}
                        placeholder="Students"
                        data-testid={`input-stat-label-${idx}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setStatItems(getStatItems().filter((_, i) => i !== idx))}
                        data-testid={`button-remove-stat-${idx}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Language-specific content tabs */}
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
                    placeholder="Section title…"
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
                    placeholder="Section subtitle…"
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
                    placeholder="Main content…"
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
                      placeholder="Button text…"
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
                      placeholder="/apply or https://…"
                      className="mt-1.5"
                      data-testid={`input-cta-url-${lang.code}`}
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => translateMutation.mutate()}
              disabled={translateMutation.isPending || !contentForms['en'].title}
              className="flex-1 gap-1.5"
              data-testid="button-auto-translate"
            >
              {translateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Auto Translate
            </Button>
            <Button
              onClick={handleSaveContent}
              disabled={updateContentMutation.isPending}
              className="flex-1"
              data-testid="button-save-section-content"
            >
              {updateContentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Section Dialog ───────────────────────────────────────────── */}
      <Dialog open={newSectionDialogOpen} onOpenChange={setNewSectionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>Choose a section type to add to your landing page.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Type</Label>
              <Select value={newSectionKey} onValueChange={setNewSectionKey}>
                <SelectTrigger data-testid="select-section-type">
                  <SelectValue placeholder="Select a section type" />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newSectionKey === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Section Name</Label>
                <Input
                  value={customSectionName}
                  onChange={(e) => setCustomSectionName(e.target.value)}
                  placeholder="Enter section name"
                  data-testid="input-custom-section-name"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setNewSectionDialogOpen(false); setNewSectionKey(''); setCustomSectionName(''); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSection}
              disabled={createSectionMutation.isPending}
              className="flex-1"
              data-testid="button-create-section"
            >
              {createSectionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EmbeddableLayout>
  );
}
