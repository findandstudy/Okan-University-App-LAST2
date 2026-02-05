import { db } from './db';
import { eq, desc, and, ilike, gte, lte } from 'drizzle-orm';
import {
  tenants, tenantThemes, sections, menuItems, programs, leads, applications,
  documents, adminUsers, chatSettings, chatSessions, chatMessages,
  integrationSettings, webhookOutbox, webhookDeliveries, emailSettings,
  emailTemplates, mediaAssets, faqItems, testimonials, trustBadges, seoSettings,
  type Tenant, type InsertTenant,
  type TenantTheme, type InsertTenantTheme,
  type Section, type InsertSection,
  type Program, type InsertProgram,
  type Lead, type InsertLead,
  type Application, type InsertApplication,
  type Document, type InsertDocument,
  type AdminUser, type InsertAdminUser,
  type FaqItem, type InsertFaqItem,
  type Testimonial, type InsertTestimonial,
  type TrustBadge, type InsertTrustBadge,
  type MediaAsset, type InsertMediaAsset,
  type EmailTemplate, type InsertEmailTemplate,
  type EmailSettings, type InsertEmailSettings,
  type SeoSettings, type InsertSeoSettings,
} from '@shared/schema';

export interface IStorage {
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;

  // Programs
  getPrograms(tenantId?: string): Promise<Program[]>;
  getProgram(id: string): Promise<Program | undefined>;
  createProgram(program: InsertProgram): Promise<Program>;
  updateProgram(id: string, data: Partial<InsertProgram>): Promise<Program | undefined>;
  deleteProgram(id: string): Promise<boolean>;

  // Leads
  getLeads(tenantId?: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;

  // Applications
  getApplications(tenantId?: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined>;
  deleteApplication(id: string): Promise<boolean>;

  // Documents
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;

  // Admin Users
  getAdminById(id: string): Promise<AdminUser | undefined>;
  getAdminByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(admin: InsertAdminUser): Promise<AdminUser>;

  // Sections
  getSections(tenantId: string): Promise<Section[]>;
  createSection(section: InsertSection): Promise<Section>;
  updateSection(id: string, data: Partial<InsertSection>): Promise<Section | undefined>;
  updateSections(updates: Array<{ id: string; isEnabled: boolean }>): Promise<Section[]>;
  deleteSection(id: string, tenantId: string): Promise<boolean>;

  // Themes
  getTheme(tenantId: string): Promise<TenantTheme | undefined>;
  createTheme(theme: InsertTenantTheme): Promise<TenantTheme>;
  updateTheme(tenantId: string, data: Partial<InsertTenantTheme>): Promise<TenantTheme | undefined>;

  // Media Assets
  getMediaAssets(tenantId: string): Promise<MediaAsset[]>;
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  deleteMediaAsset(id: string): Promise<boolean>;

  // Testimonials
  getTestimonials(tenantId: string): Promise<Testimonial[]>;
  getTestimonial(id: string): Promise<Testimonial | undefined>;
  createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial>;
  updateTestimonial(id: string, data: Partial<InsertTestimonial>): Promise<Testimonial | undefined>;
  deleteTestimonial(id: string): Promise<boolean>;

  // FAQ Items
  getFaqItems(tenantId: string): Promise<FaqItem[]>;
  getFaqItem(id: string): Promise<FaqItem | undefined>;
  createFaqItem(faq: InsertFaqItem): Promise<FaqItem>;
  updateFaqItem(id: string, data: Partial<InsertFaqItem>): Promise<FaqItem | undefined>;
  deleteFaqItem(id: string): Promise<boolean>;
  
  // Email Templates
  getEmailTemplates(tenantId: string): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByKey(tenantId: string, templateKey: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<boolean>;

  // Email Settings
  getEmailSettings(tenantId: string): Promise<EmailSettings | undefined>;
  createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  updateEmailSettings(tenantId: string, data: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined>;

  // SEO Settings
  getSeoSettings(tenantId: string): Promise<SeoSettings | undefined>;
  createSeoSettings(seo: InsertSeoSettings): Promise<SeoSettings>;
  updateSeoSettings(tenantId: string, data: Partial<InsertSeoSettings>): Promise<SeoSettings | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Tenants
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.domain, domain));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated;
  }

  // Programs
  async getPrograms(tenantId?: string): Promise<Program[]> {
    if (tenantId) {
      return db.select().from(programs).where(eq(programs.tenantId, tenantId)).orderBy(desc(programs.createdAt));
    }
    return db.select().from(programs).orderBy(desc(programs.createdAt));
  }

  async getProgram(id: string): Promise<Program | undefined> {
    const [program] = await db.select().from(programs).where(eq(programs.id, id));
    return program;
  }

  async createProgram(program: InsertProgram): Promise<Program> {
    const [created] = await db.insert(programs).values(program).returning();
    return created;
  }

  async updateProgram(id: string, data: Partial<InsertProgram>): Promise<Program | undefined> {
    const [updated] = await db.update(programs).set(data).where(eq(programs.id, id)).returning();
    return updated;
  }

  async deleteProgram(id: string): Promise<boolean> {
    const result = await db.delete(programs).where(eq(programs.id, id));
    return true;
  }

  // Leads
  async getLeads(tenantId?: string): Promise<Lead[]> {
    if (tenantId) {
      return db.select().from(leads).where(eq(leads.tenantId, tenantId)).orderBy(desc(leads.createdAt));
    }
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  // Applications
  async getApplications(tenantId?: string): Promise<Application[]> {
    if (tenantId) {
      return db.select().from(applications).where(eq(applications.tenantId, tenantId)).orderBy(desc(applications.createdAt));
    }
    return db.select().from(applications).orderBy(desc(applications.createdAt));
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const [application] = await db.select().from(applications).where(eq(applications.id, id));
    return application;
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(application).returning();
    return created;
  }

  async updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined> {
    const [updated] = await db.update(applications).set(data).where(eq(applications.id, id)).returning();
    return updated;
  }

  async deleteApplication(id: string): Promise<boolean> {
    await db.delete(documents).where(eq(documents.applicationId, id));
    const result = await db.delete(applications).where(eq(applications.id, id));
    return true;
  }

  // Documents
  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.applicationId, applicationId)).orderBy(desc(documents.uploadedAt));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(document).returning();
    return created;
  }

  // Admin Users
  async getAdminById(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAdminByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }

  async createAdminUser(admin: InsertAdminUser): Promise<AdminUser> {
    const [created] = await db.insert(adminUsers).values(admin).returning();
    return created;
  }

  // Sections
  async getSections(tenantId: string): Promise<Section[]> {
    return db.select().from(sections).where(eq(sections.tenantId, tenantId)).orderBy(sections.displayOrder);
  }

  async createSection(section: InsertSection): Promise<Section> {
    const [created] = await db.insert(sections).values(section as any).returning();
    return created;
  }

  async updateSection(id: string, data: Partial<InsertSection>): Promise<Section | undefined> {
    const [updated] = await db.update(sections).set(data as any).where(eq(sections.id, id)).returning();
    return updated;
  }

  async updateSections(updates: Array<{ id: string; isEnabled: boolean }>): Promise<Section[]> {
    const results: Section[] = [];
    for (const update of updates) {
      const [updated] = await db.update(sections)
        .set({ isEnabled: update.isEnabled })
        .where(eq(sections.id, update.id))
        .returning();
      if (updated) results.push(updated);
    }
    return results;
  }

  async deleteSection(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(sections)
      .where(and(eq(sections.id, id), eq(sections.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // Themes
  async getTheme(tenantId: string): Promise<TenantTheme | undefined> {
    const [theme] = await db.select().from(tenantThemes).where(eq(tenantThemes.tenantId, tenantId));
    return theme;
  }

  async createTheme(theme: InsertTenantTheme): Promise<TenantTheme> {
    const [created] = await db.insert(tenantThemes).values(theme).returning();
    return created;
  }

  async updateTheme(tenantId: string, data: Partial<InsertTenantTheme>): Promise<TenantTheme | undefined> {
    const [updated] = await db.update(tenantThemes).set(data).where(eq(tenantThemes.tenantId, tenantId)).returning();
    return updated;
  }

  // Media Assets
  async getMediaAssets(tenantId: string): Promise<MediaAsset[]> {
    return db.select().from(mediaAssets).where(eq(mediaAssets.tenantId, tenantId)).orderBy(desc(mediaAssets.uploadedAt));
  }

  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const [created] = await db.insert(mediaAssets).values(asset).returning();
    return created;
  }

  async deleteMediaAsset(id: string): Promise<boolean> {
    const result = await db.delete(mediaAssets).where(eq(mediaAssets.id, id)).returning();
    return result.length > 0;
  }

  // Testimonials
  async getTestimonials(tenantId: string): Promise<Testimonial[]> {
    return db.select().from(testimonials).where(eq(testimonials.tenantId, tenantId)).orderBy(testimonials.displayOrder);
  }

  async getTestimonial(id: string): Promise<Testimonial | undefined> {
    const [testimonial] = await db.select().from(testimonials).where(eq(testimonials.id, id));
    return testimonial;
  }

  async createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial> {
    const [created] = await db.insert(testimonials).values(testimonial).returning();
    return created;
  }

  async updateTestimonial(id: string, data: Partial<InsertTestimonial>): Promise<Testimonial | undefined> {
    const [updated] = await db.update(testimonials).set(data).where(eq(testimonials.id, id)).returning();
    return updated;
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    const result = await db.delete(testimonials).where(eq(testimonials.id, id)).returning();
    return result.length > 0;
  }

  // FAQ Items
  async getFaqItems(tenantId: string): Promise<FaqItem[]> {
    return db.select().from(faqItems).where(eq(faqItems.tenantId, tenantId)).orderBy(faqItems.displayOrder);
  }

  async getFaqItem(id: string): Promise<FaqItem | undefined> {
    const [faq] = await db.select().from(faqItems).where(eq(faqItems.id, id));
    return faq;
  }

  async createFaqItem(faq: InsertFaqItem): Promise<FaqItem> {
    const [created] = await db.insert(faqItems).values(faq).returning();
    return created;
  }

  async updateFaqItem(id: string, data: Partial<InsertFaqItem>): Promise<FaqItem | undefined> {
    const [updated] = await db.update(faqItems).set(data).where(eq(faqItems.id, id)).returning();
    return updated;
  }

  async deleteFaqItem(id: string): Promise<boolean> {
    const result = await db.delete(faqItems).where(eq(faqItems.id, id)).returning();
    return result.length > 0;
  }

  // Email Templates
  async getEmailTemplates(tenantId: string): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId));
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async getEmailTemplateByKey(tenantId: string, templateKey: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.templateKey, templateKey)));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(emailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updated] = await db.update(emailTemplates).set(data).where(eq(emailTemplates.id, id)).returning();
    return updated;
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    const result = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Email Settings
  async getEmailSettings(tenantId: string): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.tenantId, tenantId));
    return settings;
  }

  async createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const [created] = await db.insert(emailSettings).values(settings).returning();
    return created;
  }

  async updateEmailSettings(tenantId: string, data: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    const [updated] = await db.update(emailSettings).set(data).where(eq(emailSettings.tenantId, tenantId)).returning();
    return updated;
  }

  // SEO Settings
  async getSeoSettings(tenantId: string): Promise<SeoSettings | undefined> {
    const [seo] = await db.select().from(seoSettings).where(eq(seoSettings.tenantId, tenantId));
    return seo;
  }

  async createSeoSettings(seo: InsertSeoSettings): Promise<SeoSettings> {
    const [created] = await db.insert(seoSettings).values(seo).returning();
    return created;
  }

  async updateSeoSettings(tenantId: string, data: Partial<InsertSeoSettings>): Promise<SeoSettings | undefined> {
    const [updated] = await db.update(seoSettings).set(data).where(eq(seoSettings.tenantId, tenantId)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
