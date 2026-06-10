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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Shield, Clock, Users, Award, Globe, HeartHandshake, Sparkles, GraduationCap, BookOpen, Building } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

interface Badge {
  icon: string;
  title: Partial<Record<SupportedLanguage, string>>;
  description: Partial<Record<SupportedLanguage, string>>;
}

interface TrustBadgesSettings {
  sectionTitle: Partial<Record<SupportedLanguage, string>>;
  sectionSubtitle: Partial<Record<SupportedLanguage, string>>;
  badges: Badge[];
}

interface Section {
  id: string;
  sectionKey: string;
  settings?: TrustBadgesSettings;
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
  { value: 'shield', label: 'Shield', icon: Shield },
  { value: 'clock', label: 'Clock', icon: Clock },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'award', label: 'Award', icon: Award },
  { value: 'globe', label: 'Globe', icon: Globe },
  { value: 'heart', label: 'Heart/Support', icon: HeartHandshake },
  { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'graduation', label: 'Graduation', icon: GraduationCap },
  { value: 'book', label: 'Book', icon: BookOpen },
  { value: 'building', label: 'Building', icon: Building },
];

const defaultBadges: Badge[] = [
  {
    icon: 'shield',
    title: { en: 'Accredited Programs', ar: 'برامج معتمدة', tr: 'Akredite Programlar', fr: 'Programmes Accrédités', ru: 'Аккредитованные программы', fa: 'برنامه‌های معتبر' },
    description: { en: 'All programs are internationally recognized', ar: 'جميع البرامج معترف بها دوليًا', tr: 'Tüm programlar uluslararası olarak tanınmaktadır', fr: 'Tous les programmes sont reconnus internationalement', ru: 'Все программы признаны на международном уровне', fa: 'تمام برنامه‌ها به صورت بین‌المللی شناخته شده‌اند' },
  },
  {
    icon: 'clock',
    title: { en: '48-Hour Processing', ar: 'معالجة خلال 48 ساعة', tr: '48 Saat İşlem', fr: 'Traitement en 48 heures', ru: 'Обработка за 48 часов', fa: 'پردازش ۴۸ ساعته' },
    description: { en: 'Fast application review and response', ar: 'مراجعة سريعة للطلب والرد', tr: 'Hızlı başvuru incelemesi ve yanıt', fr: 'Examen rapide des candidatures et réponse', ru: 'Быстрое рассмотрение заявки и ответ', fa: 'بررسی و پاسخ سریع درخواست' },
  },
  {
    icon: 'users',
    title: { en: '10,000+ Students', ar: '+10,000 طالب', tr: '10.000+ Öğrenci', fr: '10 000+ Étudiants', ru: '10 000+ студентов', fa: 'بیش از ۱۰،۰۰۰ دانشجو' },
    description: { en: 'From over 100 countries worldwide', ar: 'من أكثر من 100 دولة حول العالم', tr: 'Dünya genelinde 100\'den fazla ülkeden', fr: 'De plus de 100 pays à travers le monde', ru: 'Из более чем 100 стран мира', fa: 'از بیش از ۱۰۰ کشور جهان' },
  },
  {
    icon: 'award',
    title: { en: 'Scholarship Support', ar: 'دعم المنح الدراسية', tr: 'Burs Desteği', fr: 'Soutien aux Bourses', ru: 'Поддержка стипендий', fa: 'پشتیبانی بورسیه' },
    description: { en: 'Up to 50% tuition discount available', ar: 'خصم يصل إلى 50% على الرسوم الدراسية', tr: '%50\'ye varan öğrenim ücreti indirimi', fr: 'Réduction des frais de scolarité jusqu\'à 50%', ru: 'Скидка на обучение до 50%', fa: 'تخفیف شهریه تا ۵۰٪' },
  },
  {
    icon: 'globe',
    title: { en: 'Visa Assistance', ar: 'المساعدة في التأشيرة', tr: 'Vize Desteği', fr: 'Assistance Visa', ru: 'Визовая поддержка', fa: 'کمک ویزا' },
    description: { en: '98% visa approval success rate', ar: 'نسبة نجاح الموافقة على التأشيرة 98%', tr: '%98 vize onay başarı oranı', fr: 'Taux de réussite d\'approbation de visa de 98%', ru: '98% успешного одобрения визы', fa: 'نرخ موفقیت ۹۸٪ در تایید ویزا' },
  },
  {
    icon: 'heart',
    title: { en: 'Full Support', ar: 'دعم كامل', tr: 'Tam Destek', fr: 'Soutien Complet', ru: 'Полная поддержка', fa: 'پشتیبانی کامل' },
    description: { en: 'From application to graduation', ar: 'من التقديم إلى التخرج', tr: 'Başvurudan mezuniyete kadar', fr: 'De la candidature à l\'obtention du diplôme', ru: 'От подачи заявки до выпуска', fa: 'از درخواست تا فارغ‌التحصیلی' },
  },
];

export default function WhyChooseUs({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('en');
  const [settings, setSettings] = useState<TrustBadgesSettings>({
    sectionTitle: { en: 'Why Choose Us', ar: 'لماذا تختارنا', tr: 'Neden Bizi Seçmelisiniz', fr: 'Pourquoi Nous Choisir', ru: 'Почему мы', fa: 'چرا ما را انتخاب کنید', zh: '为什么选择我们', hi: 'हमें क्यों चुनें', es: 'Por Qué Elegirnos', id: 'Mengapa Memilih Kami' },
    sectionSubtitle: { en: 'Trusted by thousands of students to guide their educational journey', ar: 'موثوق به من قبل آلاف الطلاب لتوجيه رحلتهم التعليمية', tr: 'Binlerce öğrenci tarafından eğitim yolculuklarında güvenilir', fr: 'Des milliers d\'étudiants nous font confiance pour les guider', ru: 'Тысячи студентов доверяют нам', fa: 'مورد اعتماد هزاران دانشجو برای راهنمایی سفر تحصیلی', zh: '受到数千名学生信赖', hi: 'हजारों छात्रों द्वारा विश्वसनीय', es: 'La confianza de miles de estudiantes', id: 'Dipercaya ribuan mahasiswa' },
    badges: defaultBadges,
  });

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections' + apiSuffix],
  });

  const trustSection = sections.find(s => s.sectionKey === 'trust_badges');

  useEffect(() => {
    if (trustSection?.settings) {
      const saved = trustSection.settings as Partial<TrustBadgesSettings>;
      setSettings(prev => ({
        sectionTitle: { ...prev.sectionTitle, ...(saved.sectionTitle || {}) },
        sectionSubtitle: { ...prev.sectionSubtitle, ...(saved.sectionSubtitle || {}) },
        badges: saved.badges?.length ? saved.badges : prev.badges,
      }));
    }
  }, [trustSection]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!trustSection) return;
      return apiRequest('PATCH', `/api/sections/${trustSection.id}${apiSuffix}`, { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      toast({ title: 'Success', description: 'Why Choose Us section updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update section', variant: 'destructive' });
    },
  });

  const updateBadge = (index: number, field: 'icon' | 'title' | 'description', value: string, lang?: SupportedLanguage) => {
    setSettings(prev => {
      const newBadges = [...prev.badges];
      if (field === 'icon') {
        newBadges[index] = { ...newBadges[index], icon: value };
      } else if (lang) {
        newBadges[index] = {
          ...newBadges[index],
          [field]: { ...newBadges[index][field], [lang]: value },
        };
      }
      return { ...prev, badges: newBadges };
    });
  };

  const getIconComponent = (iconName: string) => {
    const option = iconOptions.find(o => o.value === iconName);
    return option?.icon || Shield;
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
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Why Choose Us</h1>
            <p className="text-muted-foreground">Manage the trust badges section on your landing page</p>
          </div>
          <Button 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending}
            data-testid="button-save-changes"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SupportedLanguage)}>
          <TabsList className="mb-4">
            {SUPPORTED_LANGUAGES.map(lang => (
              <TabsTrigger key={lang} value={lang} data-testid={`tab-${lang}`}>
                {languageLabels[lang]}
              </TabsTrigger>
            ))}
          </TabsList>

          {SUPPORTED_LANGUAGES.map(lang => (
            <TabsContent key={lang} value={lang} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Section Header</CardTitle>
                  <CardDescription>Title and subtitle for the Why Choose Us section</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Section Title ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.sectionTitle[lang]}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        sectionTitle: { ...prev.sectionTitle, [lang]: e.target.value }
                      }))}
                      placeholder="Why Choose Us"
                      data-testid={`input-section-title-${lang}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Section Subtitle ({languageLabels[lang]})</Label>
                    <Input
                      value={settings.sectionSubtitle[lang]}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        sectionSubtitle: { ...prev.sectionSubtitle, [lang]: e.target.value }
                      }))}
                      placeholder="Trusted by thousands of students..."
                      data-testid={`input-section-subtitle-${lang}`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trust Badges</CardTitle>
                  <CardDescription>Edit the 6 feature badges displayed in this section</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {settings.badges.map((badge, index) => {
                      const IconComponent = getIconComponent(badge.icon);
                      return (
                        <div key={index} className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <IconComponent className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-medium">Badge {index + 1}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Icon</Label>
                            <Select
                              value={badge.icon}
                              onValueChange={(v) => updateBadge(index, 'icon', v)}
                            >
                              <SelectTrigger data-testid={`select-icon-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {iconOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                      <opt.icon className="h-4 w-4" />
                                      {opt.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Title ({languageLabels[lang]})</Label>
                            <Input
                              value={badge.title[lang] || ''}
                              onChange={(e) => updateBadge(index, 'title', e.target.value, lang)}
                              placeholder="Badge title"
                              data-testid={`input-badge-title-${index}-${lang}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Description ({languageLabels[lang]})</Label>
                            <Input
                              value={badge.description[lang] || ''}
                              onChange={(e) => updateBadge(index, 'description', e.target.value, lang)}
                              placeholder="Badge description"
                              data-testid={`input-badge-desc-${index}-${lang}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </EmbeddableLayout>
  );
}
