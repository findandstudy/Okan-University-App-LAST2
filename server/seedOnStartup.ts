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

const defaultSections = [
  { tenantId: 'default', sectionKey: 'hero', displayOrder: 1, isEnabled: true },
  { tenantId: 'default', sectionKey: 'trust_badges', displayOrder: 2, isEnabled: true },
  { tenantId: 'default', sectionKey: 'steps', displayOrder: 3, isEnabled: true },
  { tenantId: 'default', sectionKey: 'testimonials', displayOrder: 4, isEnabled: true },
  { tenantId: 'default', sectionKey: 'faq', displayOrder: 5, isEnabled: true },
  { tenantId: 'default', sectionKey: 'contact', displayOrder: 6, isEnabled: true },
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
    const existingAdmins = await db.select().from(adminUsers).where(eq(adminUsers.email, 'admin@okan.edu.tr'));
    if (existingAdmins.length === 0) {
      console.log('Creating demo admin user...');
      const passwordHash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
      await db.insert(adminUsers).values({
        id: 'admin-1',
        tenantId: 'default',
        email: 'admin@okan.edu.tr',
        passwordHash,
        name: 'Admin User',
        role: 'super_admin',
        isActive: true,
        mustChangePassword: true,
      });
      console.log('Created admin user (admin@okan.edu.tr / admin123) — mustChangePassword=true');
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
      await db.insert(sections).values(defaultSections);
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
