import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'tr', 'fr', 'ru', 'fa', 'zh', 'hi', 'es', 'id'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar', 'fa'];

// Tenant publication statuses
export const TENANT_STATUSES = ['taslak', 'yayinda', 'durduruldu'] as const;
export type TenantStatus = typeof TENANT_STATUSES[number];

// Tenants (Universities)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  universityName: text("university_name").notNull(),
  status: text("status").default("taslak").notNull(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  googleAnalyticsId: text("google_analytics_id"),
  googleSearchConsoleCode: text("google_search_console_code"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  youtubeUrl: text("youtube_url"),
  contactFormEmbed: text("contact_form_embed"),
  heroVideoUrl: text("hero_video_url"),
  supportedLanguages: text("supported_languages").array().default(sql`ARRAY['en']::text[]`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenant Domains — one tenant can have multiple domains (aliases)
export const tenantDomains = pgTable("tenant_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  domain: text("domain").notNull().unique(),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenant Theme Settings
export const tenantThemes = pgTable("tenant_themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  primaryColor: text("primary_color").default("#2563eb"),
  secondaryColor: text("secondary_color").default("#3b82f6"),
  backgroundColor: text("background_color").default("#ffffff"),
  textColor: text("text_color").default("#1f2937"),
  buttonStyle: text("button_style").default("rounded"),
  fontFamily: text("font_family").default("Inter"),
});

// Content by language type
export const contentByLangSchema = z.record(z.enum(SUPPORTED_LANGUAGES), z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
}));
export type ContentByLang = z.infer<typeof contentByLangSchema>;

// Sections
export const sections = pgTable("sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sectionKey: text("section_key").notNull(),
  displayOrder: integer("display_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  contentByLang: jsonb("content_by_lang").$type<ContentByLang>(),
  settings: jsonb("settings"),
});

// Menu Items
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sectionKey: text("section_key").notNull(),
  displayOrder: integer("display_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  labelByLang: jsonb("label_by_lang").$type<Record<SupportedLanguage, string>>(),
});

// Admin Users
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").default("admin"),
  isActive: boolean("is_active").default(true),
  mustChangePassword: boolean("must_change_password").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Integration Settings (repurposed for AI settings in Faz 5 — do not remove)
export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationType: text("integration_type").notNull(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  isEnabled: boolean("is_enabled").default(false),
  settings: jsonb("settings"),
});

// Media Assets
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  altText: text("alt_text"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// FAQ Items
export const faqItems = pgTable("faq_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  displayOrder: integer("display_order").default(0),
  questionByLang: jsonb("question_by_lang").$type<Record<SupportedLanguage, string>>(),
  answerByLang: jsonb("answer_by_lang").$type<Record<SupportedLanguage, string>>(),
  isEnabled: boolean("is_enabled").default(true),
});

// Testimonials
export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  studentName: text("student_name").notNull(),
  studentPhoto: text("student_photo"),
  country: text("country"),
  programName: text("program_name"),
  contentByLang: jsonb("content_by_lang").$type<Record<SupportedLanguage, string>>(),
  rating: integer("rating").default(5),
  displayOrder: integer("display_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
});

// Trust Badges
export const trustBadges = pgTable("trust_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  iconUrl: text("icon_url"),
  titleByLang: jsonb("title_by_lang").$type<Record<SupportedLanguage, string>>(),
  displayOrder: integer("display_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
});

// Widgets — embed codes / iframe URLs shown on the landing page
export const widgets = pgTable("widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull().default("Widget"),
  sectionKey: text("section_key").notNull().default("widget"),
  embedCode: text("embed_code"),
  iframeUrl: text("iframe_url"),
  isEnabled: boolean("is_enabled").default(true),
  displayOrder: integer("display_order").default(0),
});

// SEO Settings
export const seoSettings = pgTable("seo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  metaTitleByLang: jsonb("meta_title_by_lang").$type<Record<SupportedLanguage, string>>(),
  metaDescriptionByLang: jsonb("meta_description_by_lang").$type<Record<SupportedLanguage, string>>(),
  metaKeywordsByLang: jsonb("meta_keywords_by_lang").$type<Record<SupportedLanguage, string>>(),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  ogType: text("og_type").default("website"),
  twitterCard: text("twitter_card").default("summary_large_image"),
  twitterSite: text("twitter_site"),
  canonicalUrl: text("canonical_url"),
  robotsDirective: text("robots_directive").default("index, follow"),
});

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertTenantDomainSchema = createInsertSchema(tenantDomains).omit({ id: true, createdAt: true });
export const insertTenantThemeSchema = createInsertSchema(tenantThemes).omit({ id: true });
export const insertSectionSchema = createInsertSchema(sections).omit({ id: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({ id: true });
export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({ id: true, uploadedAt: true });
export const insertFaqItemSchema = createInsertSchema(faqItems).omit({ id: true });
export const insertTestimonialSchema = createInsertSchema(testimonials).omit({ id: true });
export const insertTrustBadgeSchema = createInsertSchema(trustBadges).omit({ id: true });
export const insertSeoSettingsSchema = createInsertSchema(seoSettings).omit({ id: true });
export const insertWidgetSchema = createInsertSchema(widgets).omit({ id: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantDomain = typeof tenantDomains.$inferSelect;
export type InsertTenantDomain = z.infer<typeof insertTenantDomainSchema>;
export type TenantTheme = typeof tenantThemes.$inferSelect;
export type InsertTenantTheme = z.infer<typeof insertTenantThemeSchema>;
export type Section = typeof sections.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type FaqItem = typeof faqItems.$inferSelect;
export type InsertFaqItem = z.infer<typeof insertFaqItemSchema>;
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type TrustBadge = typeof trustBadges.$inferSelect;
export type InsertTrustBadge = z.infer<typeof insertTrustBadgeSchema>;
export type SeoSettings = typeof seoSettings.$inferSelect;
export type InsertSeoSettings = z.infer<typeof insertSeoSettingsSchema>;
export type Widget = typeof widgets.$inferSelect;
export type InsertWidget = z.infer<typeof insertWidgetSchema>;

// Blog Post Status
export const BLOG_POST_STATUSES = ['taslak', 'zamanli', 'yayinda'] as const;
export type BlogPostStatus = typeof BLOG_POST_STATUSES[number];

// Blog Schedule Mode
export const BLOG_SCHEDULE_MODES = ['otomatik', 'onay'] as const;
export type BlogScheduleMode = typeof BLOG_SCHEDULE_MODES[number];

// Blog Posts
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  status: text("status").default("taslak").notNull(),
  publishAt: timestamp("publish_at"),
  keyword: text("keyword"),
  backlinkSites: text("backlink_sites").array().default(sql`ARRAY[]::text[]`),
  isAiGenerated: boolean("is_ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog Post Translations (one per lang per post)
// tenantId is denormalized here to allow a global unique slug constraint per tenant+lang
export const blogPostTranslations = pgTable("blog_post_translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => blogPosts.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  lang: text("lang").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content").notNull(),
  metaTitle: text("meta_title"),
  metaDesc: text("meta_desc"),
}, (t) => ({
  // Unique slug per tenant + lang (routing correctness)
  slugTenantUnique: uniqueIndex("blog_slug_tenant_unique").on(t.tenantId, t.lang, t.slug),
  // One translation per post+lang
  postLangUnique: uniqueIndex("blog_post_lang_unique").on(t.postId, t.lang),
}));

// Blog Schedule Settings (one per tenant)
export const blogSchedule = pgTable("blog_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  dailyLimit: integer("daily_limit").default(1),
  weekdays: text("weekdays").array().default(sql`ARRAY['1','2','3','4','5']::text[]`),
  mode: text("mode").default("onay").notNull(),
  isEnabled: boolean("is_enabled").default(false),
});

// Insert schemas
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true });
export const insertBlogPostTranslationSchema = createInsertSchema(blogPostTranslations).omit({ id: true });
export const insertBlogScheduleSchema = createInsertSchema(blogSchedule).omit({ id: true });

// Types
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPostTranslation = typeof blogPostTranslations.$inferSelect;
export type InsertBlogPostTranslation = z.infer<typeof insertBlogPostTranslationSchema>;
export type BlogSchedule = typeof blogSchedule.$inferSelect;
export type InsertBlogSchedule = z.infer<typeof insertBlogScheduleSchema>;

// Site Versions — snapshots of all tenant content (max 10 kept per tenant)
export const siteVersions = pgTable("site_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  label: text("label").notNull().default("Manual snapshot"),
  snapshotData: jsonb("snapshot_data").notNull().$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSiteVersionSchema = createInsertSchema(siteVersions).omit({ id: true, createdAt: true });
export type SiteVersion = typeof siteVersions.$inferSelect;
export type InsertSiteVersion = z.infer<typeof insertSiteVersionSchema>;

// Users table (kept for compatibility)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
