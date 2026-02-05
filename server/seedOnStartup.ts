import { db } from './db';
import { programs, tenants, adminUsers, sections, tenantThemes, emailSettings, emailTemplates } from '@shared/schema';
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

const defaultEmailSettings = {
  tenantId: 'default',
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'apply@studysearch.org',
  fromEmail: 'apply@studysearch.org',
  fromName: 'Okan University Admissions',
  isEnabled: true,
};

const defaultEmailTemplates = [
  {
    tenantId: 'default',
    templateKey: 'application_user_confirmation',
    name: 'Application User Confirmation',
    description: 'Email sent to applicants after submitting application',
    subjectByLang: {
      en: 'We Received Your Application — {{siteName}}',
      ar: 'We Received Your Application — {{siteName}}',
      tr: 'We Received Your Application — {{siteName}}',
      fr: 'We Received Your Application — {{siteName}}',
      ru: 'We Received Your Application — {{siteName}}',
      fa: 'We Received Your Application — {{siteName}}',
    },
    htmlBodyByLang: {
      en: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#ffffff;padding:30px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <img src="{{logoUrl}}" alt="{{siteName}}" style="max-height:60px;max-width:200px;" onerror="this.style.display='none'">
              <h1 style="color:#2d5a87;margin:15px 0 0;font-size:24px;font-weight:600;">Application Received!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear {{firstName}},</p>
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Thank you for applying to <strong>{{siteName}}</strong>! We have successfully received your application.</p>
              <div style="background-color:#f0f9ff;border-radius:8px;padding:20px;margin:25px 0;border-left:4px solid #2d5a87;">
                <h2 style="color:#1e3a5f;font-size:16px;margin:0 0 15px;font-weight:600;">Your Application Summary</h2>
                <table width="100%" cellpadding="6" cellspacing="0">
                  <tr><td style="color:#6b7280;font-size:14px;width:40%;">Program:</td><td style="color:#111827;font-size:14px;font-weight:600;">{{programName}}</td></tr>
                  <tr><td style="color:#6b7280;font-size:14px;">Degree Level:</td><td style="color:#111827;font-size:14px;">{{degreeLevel}}</td></tr>
                  <tr><td style="color:#6b7280;font-size:14px;">Language:</td><td style="color:#111827;font-size:14px;">{{language}}</td></tr>
                  <tr><td style="color:#6b7280;font-size:14px;">Tuition Fee:</td><td style="color:#111827;font-size:14px;">{{tuitionFee}} USD</td></tr>
                </table>
              </div>
              <h2 style="color:#1e3a5f;font-size:18px;margin:25px 0 15px;font-weight:600;">What Happens Next?</h2>
              <div style="margin-bottom:20px;">
                <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
                  <span style="background-color:#2d5a87;color:#ffffff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;margin-right:12px;flex-shrink:0;">1</span>
                  <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">Our admissions team will review your application within 2 business days.</p>
                </div>
                <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
                  <span style="background-color:#2d5a87;color:#ffffff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;margin-right:12px;flex-shrink:0;">2</span>
                  <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">You will receive an email with your acceptance letter or additional requirements.</p>
                </div>
                <div style="display:flex;align-items:flex-start;">
                  <span style="background-color:#2d5a87;color:#ffffff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;margin-right:12px;flex-shrink:0;">3</span>
                  <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">Once accepted, you will receive instructions for enrollment and visa process.</p>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; {{currentYear}} {{siteName}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      ar: '', tr: '', fr: '', ru: '', fa: '',
    },
    textBodyByLang: {
      en: `Dear {{firstName}},

Thank you for applying to {{siteName}}! We have successfully received your application.

YOUR APPLICATION SUMMARY
Program: {{programName}}
Degree: {{degreeLevel}}
Language: {{language}}
Fee: {{tuitionFee}} USD

WHAT HAPPENS NEXT?
1. Our admissions team will review your application within 2 business days.
2. You will receive an email with your acceptance letter or additional requirements.
3. Once accepted, you will receive instructions for enrollment and visa process.

---
© {{currentYear}} {{siteName}}. All rights reserved.`,
      ar: '', tr: '', fr: '', ru: '', fa: '',
    },
    isEnabled: true,
  },
  {
    tenantId: 'default',
    templateKey: 'application_internal_notification',
    name: 'Application Internal Notification',
    description: 'Email sent to admissions team when new application is submitted',
    subjectByLang: {
      en: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
      ar: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
      tr: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
      fr: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
      ru: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
      fa: '{{siteName}} New Application Received — {{firstName}} {{lastName}}',
    },
    htmlBodyByLang: {
      en: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:30px;text-align:center;">
              <img src="{{logoUrl}}" alt="{{siteName}}" style="max-height:60px;max-width:200px;" onerror="this.style.display='none'">
              <h1 style="color:#ffffff;margin:15px 0 0;font-size:22px;font-weight:600;">New Application Received</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fff3cd;padding:15px 30px;border-left:4px solid #ffc107;">
              <p style="margin:0;color:#856404;font-size:14px;font-weight:500;">New application submitted on {{submittedDate}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 20px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;">Applicant Information</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:25px;">
                <tr><td style="color:#6b7280;font-size:14px;width:35%;">First Name:</td><td style="color:#111827;font-size:14px;font-weight:600;">{{firstName}}</td></tr>
                <tr style="background-color:#f9fafb;"><td style="color:#6b7280;font-size:14px;">Last Name:</td><td style="color:#111827;font-size:14px;font-weight:600;">{{lastName}}</td></tr>
                <tr><td style="color:#6b7280;font-size:14px;">Email:</td><td style="color:#111827;font-size:14px;"><a href="mailto:{{email}}" style="color:#2563eb;">{{email}}</a></td></tr>
                <tr style="background-color:#f9fafb;"><td style="color:#6b7280;font-size:14px;">Phone:</td><td style="color:#111827;font-size:14px;">{{countryCode}} {{phone}}</td></tr>
                <tr><td style="color:#6b7280;font-size:14px;">Nationality:</td><td style="color:#111827;font-size:14px;">{{nationality}}</td></tr>
              </table>
              <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 20px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;">Selected Program</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:25px;">
                <tr><td style="color:#6b7280;font-size:14px;width:35%;">Program:</td><td style="color:#111827;font-size:14px;font-weight:600;">{{programName}}</td></tr>
                <tr style="background-color:#f9fafb;"><td style="color:#6b7280;font-size:14px;">Degree Level:</td><td style="color:#111827;font-size:14px;">{{degreeLevel}}</td></tr>
                <tr><td style="color:#6b7280;font-size:14px;">Language:</td><td style="color:#111827;font-size:14px;">{{language}}</td></tr>
                <tr style="background-color:#f9fafb;"><td style="color:#6b7280;font-size:14px;">Tuition Fee:</td><td style="color:#111827;font-size:14px;">{{tuitionFee}} USD</td></tr>
              </table>
              <div style="background-color:#dcfce7;border-radius:8px;padding:15px 20px;margin-bottom:25px;border-left:4px solid #22c55e;">
                <p style="margin:0;color:#166534;font-size:14px;font-weight:500;">📎 Documents Attached</p>
                <p style="margin:8px 0 0;color:#14532d;font-size:13px;">All applicant documents (passport, diploma, transcript, photo) are attached to this email.</p>
              </div>
              <div style="text-align:center;margin-top:30px;">
                <a href="{{dashboardUrl}}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in Dashboard</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">This is an automated notification from {{siteName}}</p>
              <p style="margin:5px 0 0;color:#9ca3af;font-size:11px;">&copy; {{currentYear}} {{siteName}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      ar: '', tr: '', fr: '', ru: '', fa: '',
    },
    textBodyByLang: {
      en: `NEW APPLICATION RECEIVED

Submitted: {{submittedDate}}

APPLICANT INFORMATION
First Name: {{firstName}}
Last Name: {{lastName}}
Email: {{email}}
Phone: {{countryCode}} {{phone}}
Nationality: {{nationality}}

SELECTED PROGRAM
Program: {{programName}}
Degree: {{degreeLevel}}
Language: {{language}}
Fee: {{tuitionFee}} USD

DOCUMENTS ATTACHED
All applicant documents (passport, diploma, transcript, photo) are attached to this email.

View application in dashboard: {{dashboardUrl}}

---
This is an automated notification from {{siteName}}`,
      ar: '', tr: '', fr: '', ru: '', fa: '',
    },
    isEnabled: true,
  },
];

export async function seedDatabase() {
  console.log('Checking database seed status...');

  try {
    const existingTenant = await db.select().from(tenants).where(eq(tenants.id, 'default'));
    
    if (existingTenant.length === 0) {
      console.log('Creating default tenant...');
      await db.insert(tenants).values(defaultTenant);
    }

    const existingPrograms = await db.select().from(programs);
    
    if (existingPrograms.length === 0) {
      console.log('Creating sample programs...');
      await db.insert(programs).values(samplePrograms);
      console.log(`Created ${samplePrograms.length} programs`);
    }

    const existingAdmin = await db.select().from(adminUsers).where(eq(adminUsers.email, 'admin@okan.edu.tr'));
    
    if (existingAdmin.length === 0) {
      console.log('Creating demo admin user...');
      await db.insert(adminUsers).values(demoAdmin);
      console.log('Created admin user (admin@okan.edu.tr / admin123)');
    }

    const existingSections = await db.select().from(sections).where(eq(sections.tenantId, 'default'));
    
    if (existingSections.length === 0) {
      console.log('Creating default sections...');
      await db.insert(sections).values(defaultSections);
    }

    const existingTheme = await db.select().from(tenantThemes).where(eq(tenantThemes.tenantId, 'default'));
    
    if (existingTheme.length === 0) {
      console.log('Creating default theme...');
      await db.insert(tenantThemes).values(defaultTheme);
    }

    // Check if email settings exist
    const existingEmailSettings = await db.select().from(emailSettings).where(eq(emailSettings.tenantId, 'default'));
    
    if (existingEmailSettings.length === 0) {
      console.log('Creating default email settings...');
      await db.insert(emailSettings).values(defaultEmailSettings);
      console.log('Created default email settings (password must be set via admin panel)');
    }

    // Check if email templates exist
    const existingEmailTemplates = await db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, 'default'));
    
    if (existingEmailTemplates.length === 0) {
      console.log('Creating default email templates...');
      await db.insert(emailTemplates).values(defaultEmailTemplates);
      console.log(`Created ${defaultEmailTemplates.length} email templates`);
    }

    console.log('Database seed check completed');
  } catch (error) {
    console.error('Seed error:', error);
  }
}
