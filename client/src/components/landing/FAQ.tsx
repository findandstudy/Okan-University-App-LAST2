import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FaqItem, SupportedLanguage } from '@shared/schema';

const defaultFAQs = [
  {
    question: {
      en: 'What are the admission requirements?',
      ar: 'ما هي متطلبات القبول؟',
      tr: 'Kabul şartları nelerdir?',
      fr: 'Quelles sont les conditions d\'admission?',
      ru: 'Каковы требования для поступления?',
      fa: 'شرایط پذیرش چیست؟',
    },
    answer: {
      en: 'Requirements vary by program but generally include a high school diploma or equivalent, passport, and English proficiency test (TOEFL/IELTS) for English-taught programs. Our team will guide you through specific requirements for your chosen program.',
      ar: 'تختلف المتطلبات حسب البرنامج ولكنها تشمل عمومًا شهادة الثانوية العامة أو ما يعادلها وجواز السفر واختبار إتقان اللغة الإنجليزية (TOEFL/IELTS) للبرامج التي تُدرس باللغة الإنجليزية.',
      tr: 'Gereksinimler programa göre değişir, ancak genellikle lise diploması veya dengi, pasaport ve İngilizce yeterlilik testi (TOEFL/IELTS) içerir.',
      fr: 'Les exigences varient selon le programme mais comprennent généralement un diplôme d\'études secondaires, un passeport et un test de compétence en anglais.',
      ru: 'Требования варьируются в зависимости от программы, но обычно включают аттестат о среднем образовании, паспорт и тест на знание английского языка.',
      fa: 'الزامات بسته به برنامه متفاوت است اما به طور کلی شامل دیپلم دبیرستان، پاسپورت و آزمون مهارت انگلیسی است.',
    },
  },
  {
    question: {
      en: 'How long does the application process take?',
      ar: 'كم تستغرق عملية التقديم؟',
      tr: 'Başvuru süreci ne kadar sürer?',
      fr: 'Combien de temps prend le processus de candidature?',
      ru: 'Сколько времени занимает процесс подачи заявки?',
      fa: 'فرآیند درخواست چقدر طول می‌کشد؟',
    },
    answer: {
      en: 'Our application processing typically takes 48-72 hours. Once approved, the university acceptance letter is usually issued within 1-2 weeks. The entire process from application to enrollment can take 2-4 weeks.',
      ar: 'تستغرق معالجة طلبنا عادةً 48-72 ساعة. بمجرد الموافقة، يتم إصدار خطاب القبول الجامعي عادةً في غضون 1-2 أسبوع.',
      tr: 'Başvuru işlememiz genellikle 48-72 saat sürer. Onaylandıktan sonra, üniversite kabul mektubu genellikle 1-2 hafta içinde verilir.',
      fr: 'Le traitement de notre demande prend généralement 48 à 72 heures. Une fois approuvée, la lettre d\'acceptation est généralement émise dans un délai de 1 à 2 semaines.',
      ru: 'Обработка заявки обычно занимает 48-72 часа. После одобрения письмо о зачислении выдается в течение 1-2 недель.',
      fa: 'پردازش درخواست ما معمولاً 48-72 ساعت طول می‌کشد. پس از تایید، نامه پذیرش دانشگاه معمولاً ظرف 1-2 هفته صادر می‌شود.',
    },
  },
  {
    question: {
      en: 'Are scholarships available?',
      ar: 'هل المنح الدراسية متاحة؟',
      tr: 'Burslar mevcut mu?',
      fr: 'Des bourses sont-elles disponibles?',
      ru: 'Доступны ли стипендии?',
      fa: 'آیا بورسیه در دسترس است؟',
    },
    answer: {
      en: 'Yes! We offer exclusive scholarships of up to 50% on tuition fees. Scholarship amounts depend on the program, your academic background, and availability. Contact us to learn about current scholarship opportunities.',
      ar: 'نعم! نقدم منحًا دراسية حصرية تصل إلى 50% على الرسوم الدراسية. تعتمد مبالغ المنح على البرنامج وخلفيتك الأكاديمية والتوفر.',
      tr: 'Evet! Öğrenim ücretlerinde %50\'ye varan özel burslar sunuyoruz. Burs miktarları programa, akademik geçmişinize ve müsaitliğe bağlıdır.',
      fr: 'Oui! Nous offrons des bourses exclusives jusqu\'à 50% sur les frais de scolarité. Les montants des bourses dépendent du programme et de votre parcours académique.',
      ru: 'Да! Мы предлагаем эксклюзивные стипендии до 50% от стоимости обучения. Размер стипендии зависит от программы и вашей академической подготовки.',
      fa: 'بله! ما بورسیه‌های انحصاری تا 50% شهریه ارائه می‌دهیم. مبالغ بورسیه به برنامه، سابقه تحصیلی شما و موجودی بستگی دارد.',
    },
  },
  {
    question: {
      en: 'Do you provide visa support?',
      ar: 'هل تقدمون دعم التأشيرة؟',
      tr: 'Vize desteği sağlıyor musunuz?',
      fr: 'Fournissez-vous un soutien pour les visas?',
      ru: 'Предоставляете ли вы визовую поддержку?',
      fa: 'آیا پشتیبانی ویزا ارائه می‌دهید؟',
    },
    answer: {
      en: 'Absolutely. We provide full visa support including document preparation, application guidance, and embassy appointment scheduling. Our visa approval rate is 98%.',
      ar: 'بالتأكيد. نقدم دعمًا كاملًا للتأشيرة بما في ذلك إعداد المستندات وإرشادات التقديم وجدولة مواعيد السفارة. معدل الموافقة على التأشيرة لدينا هو 98%.',
      tr: 'Kesinlikle. Belge hazırlama, başvuru rehberliği ve büyükelçilik randevu planlaması dahil tam vize desteği sağlıyoruz. Vize onay oranımız %98\'dir.',
      fr: 'Absolument. Nous fournissons un soutien complet pour les visas, y compris la préparation des documents et la prise de rendez-vous à l\'ambassade. Notre taux d\'approbation est de 98%.',
      ru: 'Безусловно. Мы предоставляем полную визовую поддержку, включая подготовку документов и запись на прием в посольство. Наш показатель одобрения виз составляет 98%.',
      fa: 'قطعاً. ما پشتیبانی کامل ویزا شامل تهیه مدارک، راهنمایی درخواست و برنامه‌ریزی قرار سفارت ارائه می‌دهیم. نرخ تایید ویزای ما 98% است.',
    },
  },
  {
    question: {
      en: 'Can I work while studying?',
      ar: 'هل يمكنني العمل أثناء الدراسة؟',
      tr: 'Okurken çalışabilir miyim?',
      fr: 'Puis-je travailler pendant mes études?',
      ru: 'Могу ли я работать во время учебы?',
      fa: 'آیا می‌توانم هنگام تحصیل کار کنم؟',
    },
    answer: {
      en: 'Student visa regulations allow part-time work during your studies. You can work up to 20 hours per week during semesters and full-time during breaks. We can provide more details based on your specific situation.',
      ar: 'تسمح لوائح تأشيرة الطالب بالعمل بدوام جزئي أثناء دراستك. يمكنك العمل حتى 20 ساعة أسبوعيًا خلال الفصول الدراسية وبدوام كامل خلال العطلات.',
      tr: 'Öğrenci vizesi düzenlemeleri, eğitiminiz sırasında yarı zamanlı çalışmaya izin verir. Dönemler sırasında haftada 20 saate kadar ve tatillerde tam zamanlı çalışabilirsiniz.',
      fr: 'Les réglementations du visa étudiant permettent le travail à temps partiel pendant vos études. Vous pouvez travailler jusqu\'à 20 heures par semaine pendant les semestres.',
      ru: 'Правила студенческой визы позволяют работать неполный рабочий день во время учебы. Вы можете работать до 20 часов в неделю во время семестров и полный рабочий день во время каникул.',
      fa: 'مقررات ویزای دانشجویی اجازه کار پاره وقت در طول تحصیل را می‌دهد. می‌توانید در طول ترم‌ها تا 20 ساعت در هفته و در تعطیلات تمام وقت کار کنید.',
    },
  },
  {
    question: {
      en: 'What is the cost of living?',
      ar: 'ما هي تكلفة المعيشة؟',
      tr: 'Yaşam maliyeti nedir?',
      fr: 'Quel est le coût de la vie?',
      ru: 'Какова стоимость проживания?',
      fa: 'هزینه زندگی چقدر است؟',
    },
    answer: {
      en: 'Living costs vary by city but average between $400-800 per month including accommodation, food, transportation, and personal expenses. We can help you find affordable housing options.',
      ar: 'تختلف تكاليف المعيشة حسب المدينة ولكنها تتراوح في المتوسط بين 400-800 دولار شهريًا بما في ذلك السكن والطعام والمواصلات والنفقات الشخصية.',
      tr: 'Yaşam maliyetleri şehre göre değişir, ancak konaklama, yemek, ulaşım ve kişisel harcamalar dahil aylık ortalama 400-800 dolar arasındadır.',
      fr: 'Les coûts de la vie varient selon la ville mais sont en moyenne entre 400 et 800 dollars par mois, y compris le logement, la nourriture et le transport.',
      ru: 'Стоимость проживания варьируется в зависимости от города, но в среднем составляет от 400 до 800 долларов в месяц, включая жилье, питание и транспорт.',
      fa: 'هزینه‌های زندگی بسته به شهر متفاوت است اما به طور متوسط بین 400-800 دلار در ماه شامل اقامت، غذا، حمل و نقل و هزینه‌های شخصی است.',
    },
  },
];

const INITIAL_FAQ_COUNT = 5;

export function FAQ() {
  const { t, isRTL, language } = useI18n();
  const [showAll, setShowAll] = useState(false);

  const { data: faqItems = [], isLoading } = useQuery<FaqItem[]>({
    queryKey: ['/api/faq'],
  });

  const enabledFaqs = faqItems.filter(faq => faq.isEnabled);

  const getQuestion = (faq: FaqItem): string => {
    const questionByLang = faq.questionByLang as Record<SupportedLanguage, string> | null;
    if (!questionByLang) return '';
    return questionByLang[language as SupportedLanguage] || questionByLang.en || '';
  };

  const getAnswer = (faq: FaqItem): string => {
    const answerByLang = faq.answerByLang as Record<SupportedLanguage, string> | null;
    if (!answerByLang) return '';
    return answerByLang[language as SupportedLanguage] || answerByLang.en || '';
  };

  const getDefaultQuestion = (faq: typeof defaultFAQs[0]): string => {
    return faq.question[language as SupportedLanguage] || faq.question.en;
  };

  const getDefaultAnswer = (faq: typeof defaultFAQs[0]): string => {
    return faq.answer[language as SupportedLanguage] || faq.answer.en;
  };

  const allFaqs = enabledFaqs.length > 0 ? enabledFaqs : null;
  const displayFaqs = allFaqs ? (showAll ? allFaqs : allFaqs.slice(0, INITIAL_FAQ_COUNT)) : null;
  const hasMoreFaqs = allFaqs ? allFaqs.length > INITIAL_FAQ_COUNT : false;
  const remainingCount = allFaqs ? allFaqs.length - INITIAL_FAQ_COUNT : 0;

  const displayDefaultFaqs = showAll ? defaultFAQs : defaultFAQs.slice(0, INITIAL_FAQ_COUNT);
  const hasMoreDefaultFaqs = defaultFAQs.length > INITIAL_FAQ_COUNT;
  const remainingDefaultCount = defaultFAQs.length - INITIAL_FAQ_COUNT;

  return (
    <section id="faq" className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('faq.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('faq.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <Accordion type="single" collapsible className="space-y-4">
                {displayFaqs ? (
                  displayFaqs.map((faq, index) => (
                    <AccordionItem
                      key={faq.id}
                      value={`item-${faq.id}`}
                      className="bg-card border rounded-xl px-6 shadow-sm"
                      data-testid={`faq-item-${index}`}
                    >
                      <AccordionTrigger className={`text-left hover:no-underline ${isRTL ? 'text-right' : ''}`}>
                        <span className="font-medium">{getQuestion(faq)}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {getAnswer(faq)}
                      </AccordionContent>
                    </AccordionItem>
                  ))
                ) : (
                  displayDefaultFaqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="bg-card border rounded-xl px-6 shadow-sm"
                      data-testid={`faq-item-${index}`}
                    >
                      <AccordionTrigger className={`text-left hover:no-underline ${isRTL ? 'text-right' : ''}`}>
                        <span className="font-medium">{getDefaultQuestion(faq)}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {getDefaultAnswer(faq)}
                      </AccordionContent>
                    </AccordionItem>
                  ))
                )}
              </Accordion>

              {((displayFaqs && hasMoreFaqs) || (!displayFaqs && hasMoreDefaultFaqs)) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center mt-8"
                >
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="group flex items-center gap-3 px-8 py-3 rounded-full border-2 border-primary/20 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                    data-testid="button-show-more-faq"
                  >
                    <span className="font-medium text-foreground">
                      {showAll 
                        ? t('common.showLess') || 'Show Less'
                        : `${t('common.showMore') || 'Show More'} (${displayFaqs ? remainingCount : remainingDefaultCount})`
                      }
                    </span>
                    {showAll ? (
                      <ChevronUp className="h-5 w-5 text-primary transition-transform group-hover:-translate-y-0.5" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-primary transition-transform group-hover:translate-y-0.5" />
                    )}
                  </button>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
