import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2, Phone, MapPin, MessageCircle, Mail } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';

interface ContactItem {
  icon: string;
  label: Record<SupportedLanguage, string>;
  value: string;
}

interface ContactSettings {
  sectionTitle: Record<SupportedLanguage, string>;
  sectionSubtitle: Record<SupportedLanguage, string>;
  items: ContactItem[];
}

interface Section {
  id: string;
  sectionKey: string;
  settings?: ContactSettings;
}

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  fr: 'Français',
  ru: 'Русский',
  fa: 'فارسی',
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

export default function ContactInfo() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('en');
  const [settings, setSettings] = useState<ContactSettings>({
    sectionTitle: { en: 'Contact Us', ar: 'اتصل بنا', tr: 'İletişim', fr: 'Contactez-nous', ru: 'Контакты', fa: 'تماس با ما' },
    sectionSubtitle: { en: 'Have questions? Reach out to our admissions team', ar: 'هل لديك أسئلة؟ تواصل مع فريق القبول لدينا', tr: 'Sorularınız mı var? Kabul ekibimizle iletişime geçin', fr: 'Des questions ? Contactez notre équipe d\'admission', ru: 'Есть вопросы? Свяжитесь с нашей приемной комиссией', fa: 'سوالی دارید؟ با تیم پذیرش ما تماس بگیرید' },
    items: defaultItems,
  });

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  useEffect(() => {
    const contactSection = sections.find(s => s.sectionKey === 'contact');
    if (contactSection?.settings) {
      setSettings(contactSection.settings as ContactSettings);
    }
  }, [sections]);

  const saveMutation = useMutation({
    mutationFn: async (data: ContactSettings) => {
      const contactSection = sections.find(s => s.sectionKey === 'contact');
      if (contactSection) {
        await apiRequest('PATCH', `/api/sections/${contactSection.id}`, { settings: data });
      } else {
        await apiRequest('POST', '/api/sections', {
          sectionKey: 'contact',
          title: 'Contact',
          enabled: true,
          order: 90,
          settings: data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({ title: 'Contact info saved', description: 'Your changes have been saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
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
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contact Info</h1>
            <p className="text-muted-foreground">Manage contact information displayed on the landing page</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-contact">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
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
                  <CardTitle>Contact Information</CardTitle>
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
                              value={item.label[lang] || ''}
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
    </AdminLayout>
  );
}
