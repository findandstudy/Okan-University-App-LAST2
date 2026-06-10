import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Plus, Trash2, Loader2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

interface HeroSettings {
  badge: Partial<Record<SupportedLanguage, string>>;
  title: Partial<Record<SupportedLanguage, string>>;
  subtitle: Partial<Record<SupportedLanguage, string>>;
  features: Partial<Record<SupportedLanguage, string[]>>;
  stats: {
    stat1Value: string;
    stat1Label: Partial<Record<SupportedLanguage, string>>;
    stat1Sublabel: Partial<Record<SupportedLanguage, string>>;
    stat2Value: string;
    stat2Label: Partial<Record<SupportedLanguage, string>>;
    stat2Sublabel: Partial<Record<SupportedLanguage, string>>;
  };
}

interface Section {
  id: string;
  sectionKey: string;
  settings?: HeroSettings;
}

const languageLabels: Partial<Record<SupportedLanguage, string>> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  fr: 'Français',
  ru: 'Русский',
  fa: 'فارسی',
  zh: '中文',
  hi: 'हिन्दी',
  es: 'Español',
  id: 'Bahasa',
};

export default function HeroContent({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix } = useSiteContext();
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('en');
  const [settings, setSettings] = useState<HeroSettings>({
    badge: { en: 'Applications Open for 2026', ar: '', tr: '', fr: '', ru: '', fa: '', zh: '', hi: '', es: '', id: '' },
    title: { en: 'Start Your Journey to Excellence', ar: '', tr: '', fr: '', ru: '', fa: '', zh: '', hi: '', es: '', id: '' },
    subtitle: { en: 'Study at top universities with exclusive scholarships and full support', ar: '', tr: '', fr: '', ru: '', fa: '', zh: '', hi: '', es: '', id: '' },
    features: {
      en: ['Scholarship opportunities up to 50%', 'Full visa and admission support', '48-hour application processing'],
      ar: [], tr: [], fr: [], ru: [], fa: [], zh: [], hi: [], es: [], id: [],
    },
    stats: {
      stat1Value: '50+',
      stat1Label: { en: 'Programs', ar: 'البرامج', tr: 'Programlar', fr: 'Programmes', ru: 'Программы', fa: 'برنامه‌ها', zh: '项目', hi: 'कार्यक्रम', es: 'Programas', id: 'Program' },
      stat1Sublabel: { en: 'Available', ar: 'متاح', tr: 'Mevcut', fr: 'Disponibles', ru: 'Доступно', fa: 'موجود', zh: '可选', hi: 'उपलब्ध', es: 'Disponibles', id: 'Tersedia' },
      stat2Value: '98%',
      stat2Label: { en: 'Success Rate', ar: 'نسبة النجاح', tr: 'Başarı Oranı', fr: 'Taux de réussite', ru: 'Успех', fa: 'نرخ موفقیت', zh: '成功率', hi: 'सफलता दर', es: 'Tasa de Éxito', id: 'Tingkat Sukses' },
      stat2Sublabel: { en: 'Visa Approval', ar: 'الموافقة على التأشيرة', tr: 'Vize Onayı', fr: 'Approbation de visa', ru: 'Виза', fa: 'تایید ویزا', zh: '签证批准', hi: 'वीजा अनुमोदन', es: 'Aprobación de Visa', id: 'Persetujuan Visa' },
    },
  });

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections' + apiSuffix],
  });

  const heroSection = sections.find(s => s.sectionKey === 'hero');

  useEffect(() => {
    if (heroSection?.settings) {
      const savedSettings = heroSection.settings as Partial<HeroSettings>;
      setSettings(prev => {
        const merged: HeroSettings = {
          badge: { ...prev.badge, ...(savedSettings.badge || {}) },
          title: { ...prev.title, ...(savedSettings.title || {}) },
          subtitle: { ...prev.subtitle, ...(savedSettings.subtitle || {}) },
          features: { ...prev.features, ...(savedSettings.features || {}) },
          stats: {
            stat1Value: savedSettings.stats?.stat1Value || prev.stats.stat1Value,
            stat1Label: { ...prev.stats.stat1Label, ...(savedSettings.stats?.stat1Label || {}) },
            stat1Sublabel: { ...prev.stats.stat1Sublabel, ...(savedSettings.stats?.stat1Sublabel || {}) },
            stat2Value: savedSettings.stats?.stat2Value || prev.stats.stat2Value,
            stat2Label: { ...prev.stats.stat2Label, ...(savedSettings.stats?.stat2Label || {}) },
            stat2Sublabel: { ...prev.stats.stat2Sublabel, ...(savedSettings.stats?.stat2Sublabel || {}) },
          },
        };
        return merged;
      });
    }
  }, [heroSection]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!heroSection) return;
      return apiRequest('PATCH', `/api/sections/${heroSection.id}${apiSuffix}`, { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Success', description: 'Hero content updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update hero content', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  const updateBadge = (lang: SupportedLanguage, value: string) => {
    setSettings(prev => ({
      ...prev,
      badge: { ...prev.badge, [lang]: value },
    }));
  };

  const updateTitle = (lang: SupportedLanguage, value: string) => {
    setSettings(prev => ({
      ...prev,
      title: { ...prev.title, [lang]: value },
    }));
  };

  const updateSubtitle = (lang: SupportedLanguage, value: string) => {
    setSettings(prev => ({
      ...prev,
      subtitle: { ...prev.subtitle, [lang]: value },
    }));
  };

  const updateFeature = (lang: SupportedLanguage, index: number, value: string) => {
    setSettings(prev => {
      const features = [...(prev.features?.[lang] || [])];
      features[index] = value;
      return { ...prev, features: { ...prev.features, [lang]: features } };
    });
  };

  const addFeature = (lang: SupportedLanguage) => {
    setSettings(prev => {
      const features = [...(prev.features?.[lang] || []), ''];
      return { ...prev, features: { ...prev.features, [lang]: features } };
    });
  };

  const removeFeature = (lang: SupportedLanguage, index: number) => {
    setSettings(prev => {
      const features = [...(prev.features?.[lang] || [])];
      features.splice(index, 1);
      return { ...prev, features: { ...prev.features, [lang]: features } };
    });
  };

  const updateStat = (field: keyof NonNullable<HeroSettings['stats']>, value: string | Record<SupportedLanguage, string>) => {
    setSettings(prev => ({
      ...prev,
      stats: { ...prev.stats, [field]: value },
    }));
  };

  if (isLoading) {
    return (
      <EmbeddableLayout embedded={embedded}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </EmbeddableLayout>
    );
  }

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hero Content</h1>
            <p className="text-muted-foreground">Edit the hero section content for all languages</p>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-hero">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SupportedLanguage)}>
          <TabsList className="mb-4">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TabsTrigger key={lang} value={lang} data-testid={`tab-lang-${lang}`}>
                {languageLabels[lang]}
              </TabsTrigger>
            ))}
          </TabsList>

          {SUPPORTED_LANGUAGES.map((lang) => (
            <TabsContent key={lang} value={lang} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Main Content</CardTitle>
                  <CardDescription>Badge, title, and subtitle texts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Badge Text</Label>
                    <Input
                      value={settings.badge?.[lang] || ''}
                      onChange={(e) => updateBadge(lang, e.target.value)}
                      placeholder="e.g., Applications Open for 2026"
                      data-testid={`input-badge-${lang}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={settings.title?.[lang] || ''}
                      onChange={(e) => updateTitle(lang, e.target.value)}
                      placeholder="Main headline"
                      data-testid={`input-title-${lang}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Textarea
                      value={settings.subtitle?.[lang] || ''}
                      onChange={(e) => updateSubtitle(lang, e.target.value)}
                      placeholder="Supporting text"
                      rows={2}
                      data-testid={`input-subtitle-${lang}`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Features List</CardTitle>
                  <CardDescription>Bullet points shown below the CTA buttons</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(settings.features?.[lang] || []).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={feature}
                        onChange={(e) => updateFeature(lang, index, e.target.value)}
                        placeholder={`Feature ${index + 1}`}
                        data-testid={`input-feature-${lang}-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeature(lang, index)}
                        data-testid={`button-remove-feature-${lang}-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addFeature(lang)} data-testid={`button-add-feature-${lang}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Feature
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Statistics Cards</CardTitle>
            <CardDescription>Two floating stat cards shown on the hero image</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Stat Card 1</h4>
                <div className="space-y-2">
                  <Label>Value (e.g., 50+)</Label>
                  <Input
                    value={settings.stats?.stat1Value || ''}
                    onChange={(e) => updateStat('stat1Value', e.target.value)}
                    data-testid="input-stat1-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Label ({languageLabels[activeTab]})</Label>
                  <Input
                    value={settings.stats?.stat1Label?.[activeTab] || ''}
                    onChange={(e) => updateStat('stat1Label', { ...settings.stats?.stat1Label, [activeTab]: e.target.value } as Record<SupportedLanguage, string>)}
                    data-testid="input-stat1-label"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sublabel ({languageLabels[activeTab]})</Label>
                  <Input
                    value={settings.stats?.stat1Sublabel?.[activeTab] || ''}
                    onChange={(e) => updateStat('stat1Sublabel', { ...settings.stats?.stat1Sublabel, [activeTab]: e.target.value } as Record<SupportedLanguage, string>)}
                    data-testid="input-stat1-sublabel"
                  />
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Stat Card 2</h4>
                <div className="space-y-2">
                  <Label>Value (e.g., 98%)</Label>
                  <Input
                    value={settings.stats?.stat2Value || ''}
                    onChange={(e) => updateStat('stat2Value', e.target.value)}
                    data-testid="input-stat2-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Label ({languageLabels[activeTab]})</Label>
                  <Input
                    value={settings.stats?.stat2Label?.[activeTab] || ''}
                    onChange={(e) => updateStat('stat2Label', { ...settings.stats?.stat2Label, [activeTab]: e.target.value } as Record<SupportedLanguage, string>)}
                    data-testid="input-stat2-label"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sublabel ({languageLabels[activeTab]})</Label>
                  <Input
                    value={settings.stats?.stat2Sublabel?.[activeTab] || ''}
                    onChange={(e) => updateStat('stat2Sublabel', { ...settings.stats?.stat2Sublabel, [activeTab]: e.target.value } as Record<SupportedLanguage, string>)}
                    data-testid="input-stat2-sublabel"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmbeddableLayout>
  );
}
