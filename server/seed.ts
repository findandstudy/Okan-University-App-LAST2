import { db } from './db';
import { tenants, adminUsers, sections, tenantThemes } from '@shared/schema';
import { eq } from 'drizzle-orm';

const defaultTenant = {
  id: 'default',
  domain: 'okanuniversity.app',
  universityName: 'Okan University',
  isActive: true,
};

const demoAdmin = {
  id: 'admin-1',
  tenantId: 'default',
  email: 'admin@okan.edu.tr',
  passwordHash: 'admin123',
  name: 'Admin User',
  role: 'super_admin',
  isActive: true,
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

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    const existingTenant = await db.select().from(tenants).where(eq(tenants.id, 'default'));
    
    if (existingTenant.length === 0) {
      console.log('Creating default tenant...');
      await db.insert(tenants).values(defaultTenant);
    } else {
      console.log('Default tenant already exists');
    }

    const existingAdmin = await db.select().from(adminUsers).where(eq(adminUsers.email, 'admin@okan.edu.tr'));
    
    if (existingAdmin.length === 0) {
      console.log('Creating demo admin user...');
      await db.insert(adminUsers).values(demoAdmin);
      console.log('✅ Created admin user (admin@okan.edu.tr / admin123)');
    } else {
      console.log('Demo admin already exists');
    }

    const existingSections = await db.select().from(sections).where(eq(sections.tenantId, 'default'));
    
    if (existingSections.length === 0) {
      console.log('Creating default sections...');
      await db.insert(sections).values(defaultSections);
      console.log(`✅ Created ${defaultSections.length} sections`);
    } else {
      console.log(`Sections already exist (${existingSections.length} found)`);
    }

    const existingTheme = await db.select().from(tenantThemes).where(eq(tenantThemes.tenantId, 'default'));
    
    if (existingTheme.length === 0) {
      console.log('Creating default theme...');
      await db.insert(tenantThemes).values(defaultTheme);
      console.log('✅ Created default theme');
    } else {
      console.log('Theme already exists');
    }

    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
