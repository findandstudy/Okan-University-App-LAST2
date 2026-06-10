import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';

interface FooterSettings {
  description: Partial<Record<SupportedLanguage, string>>;
  contactTitle: Partial<Record<SupportedLanguage, string>>;
  contactEmail: string;
  contactPhone: string;
  contactAddress: Partial<Record<SupportedLanguage, string>>;
}

interface Section {
  id: string;
  sectionKey: string;
  settings?: FooterSettings;
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

const defaultSettings: FooterSettings = {
  description: {
    en: 'Your gateway to world-class education. We help students from around the globe achieve their academic dreams with personalized guidance and support.',
    ar: 'بوابتك إلى تعليم عالمي المستوى. نساعد الطلاب من جميع أنحاء العالم على تحقيق أحلامهم الأكاديمية.',
    tr: 'Dünya standartlarında eğitime açılan kapınız. Dünyanın dört bir yanından öğrencilerin akademik hayallerini gerçekleştirmelerine yardımcı oluyoruz.',
    fr: 'Votre passerelle vers une éducation de classe mondiale. Nous aidons les étudiants du monde entier à réaliser leurs rêves académiques.',
    ru: 'Ваш путь к образованию мирового класса. Мы помогаем студентам со всего мира осуществить их академические мечты.',
    fa: 'دروازه شما به آموزش در سطح جهانی. ما به دانشجویان از سراسر جهان کمک می‌کنیم تا رویاهای تحصیلی خود را محقق کنند.',
    zh: '您通往世界一流教育的门户。我们帮助全球学生实现学术梦想。',
    hi: 'विश्व स्तरीय शिक्षा का आपका द्वार। हम दुनिया भर के छात्रों को उनके शैक्षणिक सपने पूरे करने में मदद करते हैं।',
    es: 'Su puerta hacia una educación de clase mundial. Ayudamos a estudiantes de todo el mundo a alcanzar sus sueños académicos.',
    id: 'Gerbang Anda menuju pendidikan kelas dunia. Kami membantu mahasiswa dari seluruh dunia mewujudkan impian akademis mereka.',
  },
  contactTitle: {
    en: 'Contact', ar: 'اتصل بنا', tr: 'İletişim', fr: 'Contact', ru: 'Контакты', fa: 'تماس',
    zh: '联系', hi: 'संपर्क', es: 'Contacto', id: 'Kontak',
  },
  contactEmail: 'apply@okanuniversity.app',
  contactPhone: '+90 552 689 85 15',
  contactAddress: {
    en: 'Istanbul Okan University Campus',
    ar: 'حرم جامعة أوكان في اسطنبول',
    tr: 'İstanbul Okan Üniversitesi Kampüsü',
    fr: 'Campus de l\'Université Okan d\'Istanbul',
    ru: 'Кампус Стамбульского университета Окан',
    fa: 'پردیس دانشگاه اوکان استانبول',
    zh: '伊斯坦布尔奥坎大学校园',
    hi: 'इस्तांबुल ओकान विश्वविद्यालय परिसर',
    es: 'Campus de la Universidad Okan de Estambul',
    id: 'Kampus Universitas Okan Istanbul',
  },
};

export default function FooterContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('en');
  const [settings, setSettings] = useState<FooterSettings>(defaultSettings);

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  useEffect(() => {
    const footerSection = sections.find(s => s.sectionKey === 'footer');
    if (footerSection?.settings) {
      setSettings(footerSection.settings as FooterSettings);
    }
  }, [sections]);

  const saveMutation = useMutation({
    mutationFn: async (data: FooterSettings) => {
      const footerSection = sections.find(s => s.sectionKey === 'footer');
      if (footerSection) {
        await apiRequest('PATCH', `/api/sections/${footerSection.id}`, { settings: data });
      } else {
        await apiRequest('POST', '/api/sections', {
          sectionKey: 'footer',
          title: 'Footer',
          enabled: true,
          order: 100,
          settings: data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({ title: 'Footer content saved', description: 'Your changes have been saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
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
            <h1 className="text-2xl font-bold">Footer Content</h1>
            <p className="text-muted-foreground">Manage footer description and contact information</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-footer">
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
                  <CardTitle>Description</CardTitle>
                  <CardDescription>The text shown in the left side of footer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label>Description Text ({languageLabels[lang]})</Label>
                    <Textarea
                      value={settings.description[lang] || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        description: { ...settings.description, [lang]: e.target.value }
                      })}
                      className="mt-1.5 min-h-[100px]"
                      data-testid={`input-description-${lang}`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Section</CardTitle>
                  <CardDescription>Contact information in the footer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Section Title ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.contactTitle[lang] || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        contactTitle: { ...settings.contactTitle, [lang]: e.target.value }
                      })}
                      className="mt-1.5"
                      data-testid={`input-contact-title-${lang}`}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={settings.contactEmail}
                      onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                      className="mt-1.5"
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={settings.contactPhone}
                      onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                      className="mt-1.5"
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div>
                    <Label>Address ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.contactAddress[lang] || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        contactAddress: { ...settings.contactAddress, [lang]: e.target.value }
                      })}
                      className="mt-1.5"
                      data-testid={`input-contact-address-${lang}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
