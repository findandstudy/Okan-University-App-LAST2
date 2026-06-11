import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Loader2, Phone, MapPin, MessageCircle, Mail, Code, Globe, Info } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

interface ContactItem {
  icon: string;
  label: Partial<Record<SupportedLanguage, string>>;
  value: string;
}

interface ContactSettings {
  sectionTitle: Partial<Record<SupportedLanguage, string>>;
  sectionSubtitle: Partial<Record<SupportedLanguage, string>>;
  items: ContactItem[];
  formIframeUrl?: string;
  formEmbedCode?: string;
}

interface Section {
  id: string;
  sectionKey: string;
  settings?: ContactSettings;
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

const iconOptions = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'address', label: 'Address', icon: MapPin },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
];

const defaultItems: ContactItem[] = [
  {
    icon: 'phone',
    label: { en: 'Phone', ar: 'الهاتف', tr: 'Telefon', fr: 'Téléphone', ru: 'Телефон', fa: 'تلفن' },
    value: '0 (216) 677 16 30',
  },
  {
    icon: 'address',
    label: { en: 'Address', ar: 'العنوان', tr: 'Adres', fr: 'Adresse', ru: 'Адрес', fa: 'آدرس' },
    value: 'Istanbul Okan University Campus',
  },
  {
    icon: 'whatsapp',
    label: { en: 'WhatsApp', ar: 'واتساب', tr: 'WhatsApp', fr: 'WhatsApp', ru: 'WhatsApp', fa: 'واتساپ' },
    value: '+90 552 689 85 15',
  },
  {
    icon: 'email',
    label: { en: 'Email', ar: 'البريد الإلكتروني', tr: 'E-posta', fr: 'E-mail', ru: 'Эл. почта', fa: 'ایمیل' },
    value: 'apply@okanuniversity.app',
  },
];

export default function ContactInfo({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('en');
  const [widgetMode, setWidgetMode] = useState<'iframe' | 'embed'>('iframe');
  const [settings, setSettings] = useState<ContactSettings>({
    sectionTitle: { en: 'Contact Us', ar: 'اتصل بنا', tr: 'İletişim', fr: 'Contactez-nous', ru: 'Контакты', fa: 'تماس با ما', zh: '联系我们', hi: 'संपर्क करें', es: 'Contáctenos', id: 'Hubungi Kami' },
    sectionSubtitle: { en: 'Have questions? Reach out to our admissions team', ar: 'هل لديك أسئلة؟ تواصل مع فريق القبول لدينا', tr: 'Sorularınız mı var? Kabul ekibimizle iletişime geçin', fr: 'Des questions ? Contactez notre équipe d\'admission', ru: 'Есть вопросы? Свяжитесь с нашей приемной комиссией', fa: 'سوالی دارید؟ با تیم پذیرش ما تماس بگیرید', zh: '有问题？联系我们的招生团队', hi: 'प्रश्न हैं? हमारी प्रवेश टीम से संपर्क करें', es: '¿Preguntas? Contacte a nuestro equipo', id: 'Ada pertanyaan? Hubungi tim penerimaan kami' },
    items: defaultItems,
    formIframeUrl: '',
    formEmbedCode: '',
  });

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections' + apiSuffix],
  });

  useEffect(() => {
    const contactSection = sections.find(s => s.sectionKey === 'contact');
    if (contactSection?.settings) {
      const s = contactSection.settings as ContactSettings;
      setSettings(s);
      if (s.formEmbedCode) setWidgetMode('embed');
      else setWidgetMode('iframe');
    }
  }, [sections]);

  const saveMutation = useMutation({
    mutationFn: async (data: ContactSettings) => {
      const contactSection = sections.find(s => s.sectionKey === 'contact');
      if (contactSection) {
        await apiRequest('PATCH', `/api/sections/${contactSection.id}${apiSuffix}`, { settings: data });
      } else {
        await apiRequest('POST', `/api/sections${apiSuffix}`, {
          sectionKey: 'contact',
          title: 'Contact',
          enabled: true,
          order: 90,
          settings: data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({ title: 'Contact info saved', description: 'Your changes have been saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    const cleanSettings: ContactSettings = {
      ...settings,
      formIframeUrl: widgetMode === 'iframe' ? (settings.formIframeUrl || '') : '',
      formEmbedCode: widgetMode === 'embed' ? (settings.formEmbedCode || '') : '',
    };
    saveMutation.mutate(cleanSettings);
  };

  const updateItem = (index: number, field: 'value', value: string) => {
    const newItems = [...settings.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettings({ ...settings, items: newItems });
  };

  const updateItemLabel = (index: number, lang: SupportedLanguage, value: string) => {
    const newItems = [...settings.items];
    newItems[index] = {
      ...newItems[index],
      label: { ...newItems[index].label, [lang]: value },
    };
    setSettings({ ...settings, items: newItems });
  };

  const getIcon = (iconName: string) => {
    const option = iconOptions.find(o => o.value === iconName);
    return option?.icon || Phone;
  };

  if (isLoading) {
    return (
      <EmbeddableLayout embedded={embedded}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </EmbeddableLayout>
    );
  }

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contact Info</h1>
            <p className="text-muted-foreground">Manage the contact section on the landing page</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-contact">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        {/* ── Form Widget ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Form Widget (Left Column)
            </CardTitle>
            <CardDescription>
              Embed an external form or widget on the left side. Leave empty to use the built-in contact form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Choose <strong>iframe URL</strong> to embed a clean widget via URL, or <strong>HTML Embed Code</strong> to paste raw HTML/script from your lead system.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={widgetMode === 'iframe' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWidgetMode('iframe')}
                className="flex items-center gap-2"
                data-testid="button-mode-iframe"
              >
                <Globe className="h-4 w-4" />
                iframe URL
              </Button>
              <Button
                type="button"
                variant={widgetMode === 'embed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWidgetMode('embed')}
                className="flex items-center gap-2"
                data-testid="button-mode-embed"
              >
                <Code className="h-4 w-4" />
                HTML Embed Code
              </Button>
            </div>

            {widgetMode === 'iframe' ? (
              <div>
                <Label htmlFor="formIframeUrl">Widget URL</Label>
                <Input
                  id="formIframeUrl"
                  value={settings.formIframeUrl || ''}
                  onChange={(e) => setSettings({ ...settings, formIframeUrl: e.target.value })}
                  placeholder="https://portal.example.com/embed/form"
                  className="mt-1.5"
                  data-testid="input-form-iframe-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The URL will be embedded as an iframe in the left column.
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="formEmbedCode">HTML Embed Code</Label>
                <Textarea
                  id="formEmbedCode"
                  value={settings.formEmbedCode || ''}
                  onChange={(e) => setSettings({ ...settings, formEmbedCode: e.target.value })}
                  placeholder={'<div data-widget="..."></div>\n<script src="..."></script>'}
                  rows={8}
                  className="mt-1.5 font-mono text-sm"
                  data-testid="textarea-form-embed-code"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the complete HTML embed code from your CRM or lead management system.
                </p>
              </div>
            )}

            {(settings.formIframeUrl || settings.formEmbedCode) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setSettings({ ...settings, formIframeUrl: '', formEmbedCode: '' })}
                data-testid="button-clear-widget"
              >
                Remove widget — use built-in form
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Section header + contact channels ───────────────────── */}
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
                  <CardTitle>Section Header</CardTitle>
                  <CardDescription>Title and subtitle for the contact section</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Section Title ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.sectionTitle[lang] || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        sectionTitle: { ...settings.sectionTitle, [lang]: e.target.value }
                      })}
                      className="mt-1.5"
                      data-testid={`input-section-title-${lang}`}
                    />
                  </div>
                  <div>
                    <Label>Section Subtitle ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.sectionSubtitle[lang] || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        sectionSubtitle: { ...settings.sectionSubtitle, [lang]: e.target.value }
                      })}
                      className="mt-1.5"
                      data-testid={`input-section-subtitle-${lang}`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Channels (Right Column)</CardTitle>
                  <CardDescription>Phone, address, WhatsApp, and email details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settings.items.map((item, index) => {
                    const IconComponent = getIcon(item.icon);
                    return (
                      <div key={index} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium capitalize">{item.icon}</span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>Label ({languageLabels[lang]})</Label>
                            <Input
                              value={item.label?.[lang] || ''}
                              onChange={(e) => updateItemLabel(index, lang, e.target.value)}
                              className="mt-1.5"
                              data-testid={`input-item-label-${index}-${lang}`}
                            />
                          </div>
                          <div>
                            <Label>Value</Label>
                            <Input
                              value={item.value}
                              onChange={(e) => updateItem(index, 'value', e.target.value)}
                              className="mt-1.5"
                              data-testid={`input-item-value-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </EmbeddableLayout>
  );
}
