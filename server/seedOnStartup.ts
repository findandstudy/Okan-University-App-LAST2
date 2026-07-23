import { db } from './db';
import { tenants, tenantDomains, adminUsers, sections, tenantThemes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

const defaultTenant = {
  id: 'default',
  domain: 'okanuniversity.app',
  universityName: 'Okan University',
  status: 'yayinda',
  isActive: true,
};

const defaultTenantDomain = {
  tenantId: 'default',
  domain: 'okanuniversity.app',
  isPrimary: true,
};

const DEFAULT_HERO_FEATURES: Record<string, string[]> = {
  en: [
    'Scholarship opportunities up to 20%',
    'No examination certificate is required!',
    'We need only diploma + transcript + passport',
    '48-hour application processing',
  ],
  ar: [
    'فرص منح دراسية تصل إلى 20%',
    'لا يُشترط شهادة امتحان!',
    'نحتاج فقط إلى الشهادة + كشف الدرجات + جواز السفر',
    'معالجة الطلب خلال 48 ساعة',
  ],
  tr: [
    '%20\'ye kadar burs imkânları',
    'Sınav belgesi gerekmemektedir!',
    'Yalnızca diploma + transkript + pasaport yeterli',
    '48 saatte başvuru işlemi',
  ],
  fr: [
    'Opportunités de bourses jusqu\'à 20%',
    'Aucun certificat d\'examen requis !',
    'Nous avons besoin uniquement du diplôme + relevé de notes + passeport',
    'Traitement des candidatures en 48 heures',
  ],
  ru: [
    'Возможности стипендии до 20%',
    'Сертификат о сдаче экзамена не требуется!',
    'Нам нужны только диплом + транскрипт + паспорт',
    'Обработка заявки за 48 часов',
  ],
  fa: [
    'فرصت‌های بورسیه تا ۲۰٪',
    'مدرک آزمون لازم نیست!',
    'فقط به مدرک + ریزنمرات + گذرنامه نیاز داریم',
    'پردازش درخواست در ۴۸ ساعت',
  ],
  zh: [
    '高达20%的奖学金机会',
    '无需考试证书！',
    '我们只需要学位证 + 成绩单 + 护照',
    '48小时处理申请',
  ],
  hi: [
    '20% तक छात्रवृत्ति के अवसर',
    'परीक्षा प्रमाण पत्र की आवश्यकता नहीं!',
    'हमें केवल डिप्लोमा + ट्रांसक्रिप्ट + पासपोर्ट चाहिए',
    '48 घंटे में आवेदन प्रसंस्करण',
  ],
  es: [
    'Oportunidades de becas de hasta el 20%',
    '¡No se requiere certificado de examen!',
    'Solo necesitamos diploma + expediente + pasaporte',
    'Procesamiento de solicitudes en 48 horas',
  ],
  id: [
    'Peluang beasiswa hingga 20%',
    'Tidak diperlukan sertifikat ujian!',
    'Kami hanya butuh ijazah + transkrip + paspor',
    'Pemrosesan lamaran dalam 48 jam',
  ],
};

const defaultSections = [
  {
    tenantId: 'default',
    sectionKey: 'hero',
    displayOrder: 1,
    isEnabled: true,
    settings: { features: DEFAULT_HERO_FEATURES },
  },
  { tenantId: 'default', sectionKey: 'trust_badges', displayOrder: 2, isEnabled: true },
  { tenantId: 'default', sectionKey: 'steps', displayOrder: 3, isEnabled: true },
  { tenantId: 'default', sectionKey: 'testimonials', displayOrder: 4, isEnabled: true },
  { tenantId: 'default', sectionKey: 'faq', displayOrder: 5, isEnabled: true },
  { tenantId: 'default', sectionKey: 'contact', displayOrder: 6, isEnabled: true },
  {
    tenantId: 'default',
    sectionKey: 'disclaimer',
    displayOrder: 7,
    isEnabled: false,
    contentByLang: {
      en: { body: 'This website is for informational purposes only. All information is subject to change without notice.' },
      ar: { body: 'هذا الموقع لأغراض إعلامية فقط. جميع المعلومات عرضة للتغيير دون إشعار مسبق.' },
      tr: { body: 'Bu web sitesi yalnızca bilgi amaçlıdır. Tüm bilgiler önceden bildirimde bulunmaksızın değiştirilebilir.' },
      fr: { body: 'Ce site web est à titre informatif uniquement. Toutes les informations sont susceptibles d\'être modifiées sans préavis.' },
      ru: { body: 'Данный веб-сайт предназначен исключительно для информационных целей. Вся информация может быть изменена без предварительного уведомления.' },
      fa: { body: 'این وب‌سایت صرفاً برای اهداف اطلاع‌رسانی است. تمام اطلاعات ممکن است بدون اطلاع قبلی تغییر کنند.' },
    },
  },
];

const defaultTheme = {
  tenantId: 'default',
  primaryColor: '#2563eb',
  secondaryColor: '#3b82f6',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  buttonStyle: 'rounded',
  fontFamily: 'Inter',
};

export async function seedDatabase() {
  console.log('Checking database seed status...');

  try {
    // Tenant
    const existingTenant = await db.select().from(tenants).where(eq(tenants.id, 'default'));
    if (existingTenant.length === 0) {
      console.log('Creating default tenant...');
      await db.insert(tenants).values(defaultTenant);
    } else {
      // Ensure status is set to 'yayinda' on existing tenant
      await db.update(tenants).set({ status: 'yayinda' }).where(eq(tenants.id, 'default'));
    }

    // Tenant Domains
    const existingDomains = await db.select().from(tenantDomains).where(eq(tenantDomains.tenantId, 'default'));
    if (existingDomains.length === 0) {
      console.log('Creating default tenant domain...');
      await db.insert(tenantDomains).values(defaultTenantDomain);
    }

    // Admin — create or migrate password to bcrypt hash
    const existingAdmins = await db.select().from(adminUsers).where(eq(adminUsers.email, 'en@findandstudy.com'));
    if (existingAdmins.length === 0) {
      console.log('Creating demo admin user...');
      const passwordHash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
      await db.insert(adminUsers).values({
        id: 'admin-1',
        tenantId: 'default',
        email: 'en@findandstudy.com',
        passwordHash,
        name: 'Admin User',
        role: 'super_admin',
        isActive: true,
        mustChangePassword: true,
      });
      console.log('Created admin user (en@findandstudy.com / admin123) — mustChangePassword=true');
    } else {
      // Migrate plain-text password to bcrypt if needed
      const existing = existingAdmins[0];
      if (!existing.passwordHash.startsWith('$2')) {
        console.log('Migrating admin password to bcrypt hash...');
        const passwordHash = await bcrypt.hash(existing.passwordHash, BCRYPT_ROUNDS);
        await db.update(adminUsers)
          .set({ passwordHash, mustChangePassword: true })
          .where(eq(adminUsers.id, existing.id));
      }
    }

    // Sections
    const existingSections = await db.select().from(sections).where(eq(sections.tenantId, 'default'));
    if (existingSections.length === 0) {
      console.log('Creating default sections...');
      await db.insert(sections).values(defaultSections as any);
    } else {
      // Ensure disclaimer section exists
      const hasDisclaimer = existingSections.some(s => s.sectionKey === 'disclaimer');
      if (!hasDisclaimer) {
        console.log('Adding disclaimer section...');
        await db.insert(sections).values(defaultSections.find(s => s.sectionKey === 'disclaimer') as any);
      }
      // Migrate hero section: add multi-language features if missing or only English
      const heroSection = existingSections.find(s => s.sectionKey === 'hero');
      if (heroSection) {
        const heroSettings = (heroSection.settings as any) || {};
        const features = heroSettings.features || {};
        const langCount = Object.keys(features).length;
        if (langCount < 2) {
          console.log('Migrating hero section: adding multi-language features...');
          const mergedFeatures = { ...DEFAULT_HERO_FEATURES, ...features };
          await db.update(sections)
            .set({ settings: { ...heroSettings, features: mergedFeatures } as any })
            .where(eq(sections.id, heroSection.id));
        }
      }
    }

    // Theme
    const existingTheme = await db.select().from(tenantThemes).where(eq(tenantThemes.tenantId, 'default'));
    if (existingTheme.length === 0) {
      console.log('Creating default theme...');
      await db.insert(tenantThemes).values(defaultTheme);
    }

    console.log('Database seed check completed');
  } catch (error) {
    console.error('Seed error:', error);
  }
}
