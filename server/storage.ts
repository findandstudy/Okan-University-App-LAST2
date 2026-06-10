import { db } from './db';
import { eq, desc, and } from 'drizzle-orm';
import {
  tenants, tenantDomains, tenantThemes, sections, menuItems,
  adminUsers, integrationSettings, mediaAssets, faqItems,
  testimonials, trustBadges, seoSettings, widgets,
  type Tenant, type InsertTenant,
  type TenantDomain, type InsertTenantDomain,
  type TenantTheme, type InsertTenantTheme,
  type Section, type InsertSection,
  type AdminUser, type InsertAdminUser,
  type FaqItem, type InsertFaqItem,
  type Testimonial, type InsertTestimonial,
  type TrustBadge, type InsertTrustBadge,
  type MediaAsset, type InsertMediaAsset,
  type SeoSettings, type InsertSeoSettings,
  type Widget, type InsertWidget,
} from '@shared/schema';

export interface IStorage {
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getTenantByHostDomain(host: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;

  // Tenant Domains
  getTenantDomains(tenantId: string): Promise<TenantDomain[]>;
  createTenantDomain(domain: InsertTenantDomain): Promise<TenantDomain>;
  deleteTenantDomain(id: string): Promise<boolean>;

  // Admin Users
  getAdminById(id: string): Promise<AdminUser | undefined>;
  getAdminByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(admin: InsertAdminUser): Promise<AdminUser>;
  updateAdminPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;

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
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
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

  // SEO Settings
  getSeoSettings(tenantId: string): Promise<SeoSettings | undefined>;
  createSeoSettings(seo: InsertSeoSettings): Promise<SeoSettings>;
  updateSeoSettings(tenantId: string, data: Partial<InsertSeoSettings>): Promise<SeoSettings | undefined>;

  // Widgets
  getWidgets(tenantId: string): Promise<Widget[]>;
  getWidget(id: string): Promise<Widget | undefined>;
  createWidget(widget: InsertWidget): Promise<Widget>;
  updateWidget(id: string, data: Partial<InsertWidget>): Promise<Widget | undefined>;
  deleteWidget(id: string): Promise<boolean>;
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

  /**
   * Resolve tenant from a Host header value.
   * Strips www. and port, then looks up tenant_domains first,
   * falling back to the legacy tenants.domain column.
   */
  async getTenantByHostDomain(host: string): Promise<Tenant | undefined> {
    const cleanHost = host.replace(/^www\./, '').replace(/:\d+$/, '').toLowerCase();

    // Check tenant_domains table first
    const [domainRow] = await db
      .select({ tenantId: tenantDomains.tenantId })
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, cleanHost));

    if (domainRow) {
      return this.getTenant(domainRow.tenantId);
    }

    // Fallback: legacy tenants.domain column
    return this.getTenantByDomain(cleanHost);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async deleteTenant(id: string): Promise<boolean> {
    // Delete child records first to avoid FK violations
    await db.delete(widgets).where(eq(widgets.tenantId, id));
    await db.delete(seoSettings).where(eq(seoSettings.tenantId, id));
    await db.delete(testimonials).where(eq(testimonials.tenantId, id));
    await db.delete(faqItems).where(eq(faqItems.tenantId, id));
    await db.delete(sections).where(eq(sections.tenantId, id));
    await db.delete(tenantThemes).where(eq(tenantThemes.tenantId, id));
    await db.delete(tenantDomains).where(eq(tenantDomains.tenantId, id));
    await db.delete(mediaAssets).where(eq(mediaAssets.tenantId, id));
    const result = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    return result.length > 0;
  }

  // Tenant Domains
  async getTenantDomains(tenantId: string): Promise<TenantDomain[]> {
    return db.select().from(tenantDomains).where(eq(tenantDomains.tenantId, tenantId));
  }

  async createTenantDomain(domain: InsertTenantDomain): Promise<TenantDomain> {
    const [created] = await db.insert(tenantDomains).values(domain).returning();
    return created;
  }

  async deleteTenantDomain(id: string): Promise<boolean> {
    const result = await db.delete(tenantDomains).where(eq(tenantDomains.id, id)).returning();
    return result.length > 0;
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

  async updateAdminPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    await db.update(adminUsers)
      .set({ passwordHash, mustChangePassword })
      .where(eq(adminUsers.id, id));
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

  async getMediaAsset(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset;
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

  // Widgets
  async getWidgets(tenantId: string): Promise<Widget[]> {
    return db.select().from(widgets).where(eq(widgets.tenantId, tenantId)).orderBy(widgets.displayOrder);
  }

  async getWidget(id: string): Promise<Widget | undefined> {
    const [widget] = await db.select().from(widgets).where(eq(widgets.id, id));
    return widget;
  }

  async createWidget(widget: InsertWidget): Promise<Widget> {
    const [created] = await db.insert(widgets).values(widget).returning();
    return created;
  }

  async updateWidget(id: string, data: Partial<InsertWidget>): Promise<Widget | undefined> {
    const [updated] = await db.update(widgets).set(data).where(eq(widgets.id, id)).returning();
    return updated;
  }

  async deleteWidget(id: string): Promise<boolean> {
    const result = await db.delete(widgets).where(eq(widgets.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
