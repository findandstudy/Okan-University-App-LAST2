import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'tr', 'fr', 'ru', 'fa'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar', 'fa'];

// Tenants (Universities)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  universityName: text("university_name").notNull(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  googleAnalyticsId: text("google_analytics_id"),
  googleSearchConsoleCode: text("google_search_console_code"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  youtubeUrl: text("youtube_url"),
  isActive: boolean("is_active").default(true),
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
  sectionKey: text("section_key").notNull(), // hero, trust_badges, program_finder, steps, testimonials, faq, contact
  displayOrder: integer("display_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  contentByLang: jsonb("content_by_lang").$type<ContentByLang>(),
  settings: jsonb("settings"), // Additional section-specific settings
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

// Programs
export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  universityName: text("university_name").notNull(),
  programName: text("program_name").notNull(),
  degree: text("degree").notNull(), // Bachelor, Master, PhD, etc.
  language: text("language").notNull(), // Teaching language
  tuitionFee: decimal("tuition_fee", { precision: 10, scale: 2 }).notNull(),
  discountedFee: decimal("discounted_fee", { precision: 10, scale: 2 }),
  externalProgramId: text("external_program_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leads (Step 1 of application)
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  countryCode: text("country_code").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Applications
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  programId: varchar("program_id").references(() => programs.id),
  status: text("status").default("draft"), // draft, submitted, processing, approved, rejected
  currentStep: integer("current_step").default(1),
  applicantData: jsonb("applicant_data"), // All form data in UPPERCASE
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id),
  documentType: text("document_type").notNull(), // passport, diploma, transcript, photo
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// AI Extractions from documents
export const aiExtractions = pgTable("ai_extractions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  extractedFields: jsonb("extracted_fields"),
  checks: jsonb("checks"), // Validation results
  status: text("status").default("pending"), // pending, completed, failed
  processedAt: timestamp("processed_at"),
});

// Admin Users
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").default("admin"), // superadmin, admin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat Settings
export const chatSettings = pgTable("chat_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  isEnabled: boolean("is_enabled").default(false),
  welcomeMessageByLang: jsonb("welcome_message_by_lang").$type<Record<SupportedLanguage, string>>(),
  n8nWebhookUrl: text("n8n_webhook_url"),
  n8nWebhookSecret: text("n8n_webhook_secret"),
});

// Chat Sessions
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sessionId: text("session_id").notNull(),
  language: text("language").default("en"),
  selectedProgramId: varchar("selected_program_id").references(() => programs.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationType: text("integration_type").notNull(), // portal, n8n, email
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  isEnabled: boolean("is_enabled").default(false),
  settings: jsonb("settings"),
});

// Webhook Outbox (for reliable delivery)
export const webhookOutbox = pgTable("webhook_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").default("pending"), // pending, processing, delivered, failed
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook Deliveries (logs)
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outboxId: varchar("outbox_id").notNull().references(() => webhookOutbox.id),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

// Email Settings
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  provider: text("provider").default("smtp"), // smtp, sendgrid
  isEnabled: boolean("is_enabled").default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  sendgridApiKey: text("sendgrid_api_key"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
});

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  templateKey: text("template_key").notNull(), // application_confirmation, welcome, etc.
  subjectByLang: jsonb("subject_by_lang").$type<Record<SupportedLanguage, string>>(),
  htmlBodyByLang: jsonb("html_body_by_lang").$type<Record<SupportedLanguage, string>>(),
  textBodyByLang: jsonb("text_body_by_lang").$type<Record<SupportedLanguage, string>>(),
});

// Media Assets
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(), // image, video
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

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertTenantThemeSchema = createInsertSchema(tenantThemes).omit({ id: true });
export const insertSectionSchema = createInsertSchema(sections).omit({ id: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertProgramSchema = createInsertSchema(programs).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export const insertChatSettingsSchema = createInsertSchema(chatSettings).omit({ id: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({ id: true });
export const insertWebhookOutboxSchema = createInsertSchema(webhookOutbox).omit({ id: true, createdAt: true });
export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({ id: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true });
export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({ id: true, uploadedAt: true });
export const insertFaqItemSchema = createInsertSchema(faqItems).omit({ id: true });
export const insertTestimonialSchema = createInsertSchema(testimonials).omit({ id: true });
export const insertTrustBadgeSchema = createInsertSchema(trustBadges).omit({ id: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantTheme = typeof tenantThemes.$inferSelect;
export type InsertTenantTheme = z.infer<typeof insertTenantThemeSchema>;
export type Section = typeof sections.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type Program = typeof programs.$inferSelect;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type ChatSettings = typeof chatSettings.$inferSelect;
export type InsertChatSettings = z.infer<typeof insertChatSettingsSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type WebhookOutbox = typeof webhookOutbox.$inferSelect;
export type InsertWebhookOutbox = z.infer<typeof insertWebhookOutboxSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type FaqItem = typeof faqItems.$inferSelect;
export type InsertFaqItem = z.infer<typeof insertFaqItemSchema>;
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type TrustBadge = typeof trustBadges.$inferSelect;
export type InsertTrustBadge = z.infer<typeof insertTrustBadgeSchema>;

// Application form validation schema with UPPERCASE enforcement
export const leadFormSchema = z.object({
  fullName: z.string().min(2).transform(val => val.toUpperCase()),
  email: z.string().email(),
  phone: z.string().min(5),
  countryCode: z.string().min(1),
});

export const applicationFormSchema = z.object({
  programId: z.string().min(1),
  firstName: z.string().min(1).transform(val => val.toUpperCase()),
  lastName: z.string().min(1).transform(val => val.toUpperCase()),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional().transform(val => val?.toUpperCase()),
  passportNumber: z.string().optional().transform(val => val?.toUpperCase()),
  address: z.string().optional().transform(val => val?.toUpperCase()),
  city: z.string().optional().transform(val => val?.toUpperCase()),
  country: z.string().optional().transform(val => val?.toUpperCase()),
});

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
