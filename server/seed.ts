import { db } from './db';
import { programs, tenants, adminUsers, sections, tenantThemes } from '@shared/schema';
import { eq } from 'drizzle-orm';

const samplePrograms = [
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Computer Engineering',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '12000',
    discountedFee: '8500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Business Administration',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '10000',
    discountedFee: '7000',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'International Relations',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '9500',
    discountedFee: '6500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Medicine (MD)',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '25000',
    discountedFee: '20000',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Dentistry',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '22000',
    discountedFee: '18000',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'MBA - Business Administration',
    degree: 'Master',
    language: 'English',
    tuitionFee: '15000',
    discountedFee: '10000',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Data Science and Analytics',
    degree: 'Master',
    language: 'English',
    tuitionFee: '14000',
    discountedFee: '9500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Architecture',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '11000',
    discountedFee: '8000',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Electrical Engineering',
    degree: 'Bachelor',
    language: 'Turkish',
    tuitionFee: '8000',
    discountedFee: '5500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Psychology',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '9000',
    discountedFee: '6500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Law',
    degree: 'Bachelor',
    language: 'Turkish',
    tuitionFee: '10000',
    discountedFee: '7500',
    isActive: true,
  },
  {
    tenantId: 'default',
    universityName: 'Okan University',
    programName: 'Civil Engineering',
    degree: 'Bachelor',
    language: 'English',
    tuitionFee: '11500',
    discountedFee: '8000',
    isActive: true,
  },
];

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
  { tenantId: 'default', sectionKey: 'program_finder', displayOrder: 3, isEnabled: true },
  { tenantId: 'default', sectionKey: 'steps', displayOrder: 4, isEnabled: true },
  { tenantId: 'default', sectionKey: 'testimonials', displayOrder: 5, isEnabled: true },
  { tenantId: 'default', sectionKey: 'faq', displayOrder: 6, isEnabled: true },
  { tenantId: 'default', sectionKey: 'contact', displayOrder: 7, isEnabled: true },
  { tenantId: 'default', sectionKey: 'chatbox', displayOrder: 8, isEnabled: true },
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
    // Check if tenant exists
    const existingTenant = await db.select().from(tenants).where(eq(tenants.id, 'default'));
    
    if (existingTenant.length === 0) {
      console.log('Creating default tenant...');
      await db.insert(tenants).values(defaultTenant);
    } else {
      console.log('Default tenant already exists');
    }

    // Check if programs exist
    const existingPrograms = await db.select().from(programs);
    
    if (existingPrograms.length === 0) {
      console.log('Creating sample programs...');
      await db.insert(programs).values(samplePrograms);
      console.log(`✅ Created ${samplePrograms.length} programs`);
    } else {
      console.log(`Programs already exist (${existingPrograms.length} found)`);
    }

    // Check if admin user exists
    const existingAdmin = await db.select().from(adminUsers).where(eq(adminUsers.email, 'admin@okan.edu.tr'));
    
    if (existingAdmin.length === 0) {
      console.log('Creating demo admin user...');
      await db.insert(adminUsers).values(demoAdmin);
      console.log('✅ Created admin user (admin@okan.edu.tr / admin123)');
    } else {
      console.log('Demo admin already exists');
    }

    // Check if sections exist
    const existingSections = await db.select().from(sections).where(eq(sections.tenantId, 'default'));
    
    if (existingSections.length === 0) {
      console.log('Creating default sections...');
      await db.insert(sections).values(defaultSections);
      console.log(`✅ Created ${defaultSections.length} sections`);
    } else {
      console.log(`Sections already exist (${existingSections.length} found)`);
    }

    // Check if theme exists
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
