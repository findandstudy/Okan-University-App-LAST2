import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertMediaAssetSchema,
  insertTestimonialSchema,
  insertFaqItemSchema,
  insertSeoSettingsSchema,
  type Tenant,
} from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import sharp from "sharp";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

const SessionStore = MemoryStore(session);

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module 'express-serve-static-core' {
  interface Request {
    tenantId: string;
    tenant: Tenant;
  }
}

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    tenantId?: string;
  }
}

// ─── Image cache ──────────────────────────────────────────────────────────────
const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const IMAGE_CACHE_TTL = 3600000; // 1 hour
const MAX_CACHE_SIZE = 100;

// ─── Bootstrap cache — keyed by tenantId ──────────────────────────────────────
const bootstrapCache = new Map<string, { data: any; timestamp: number }>();
const BOOTSTRAP_CACHE_TTL = 60000; // 60 seconds

// ─── Admin middleware ─────────────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Admin tenant isolation middleware ────────────────────────────────────────
// Must run AFTER both requireAdmin and resolveTenant.
// Superadmins (role === 'super_admin') may operate on any tenant.
// Regular admins are restricted to their own tenant (session.tenantId === req.tenantId).
async function requireAdminTenantAccess(req: Request, res: Response, next: NextFunction) {
  const admin = await storage.getAdminById(req.session.adminId || '');
  if (!admin) return res.status(401).json({ error: "Unauthorized" });

  if (admin.role === 'super_admin') return next();

  if (!req.session.tenantId || req.session.tenantId !== req.tenantId) {
    return res.status(403).json({ error: "Forbidden: tenant mismatch" });
  }
  next();
}

// ─── Dev host detection ───────────────────────────────────────────────────────
// Returns true for hosts where it's safe to fall back to the default tenant
// (local development and Replit preview environments).
function isDevHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.replit.dev') ||
    host.endsWith('.picard.replit.dev') ||
    host.endsWith('.repl.co')
  );
}

// ─── resolveTenant middleware ─────────────────────────────────────────────────
// Resolves tenant from Host header and attaches req.tenant + req.tenantId.
// Falls back to 'default' tenant ONLY for known dev/preview hosts.
// Unknown production domains receive a 404.
async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const rawHost = req.headers.host || '';
    const host = rawHost.replace(/^www\./, '').replace(/:\d+$/, '').toLowerCase();

    // Try to resolve from DB (tenant_domains → tenants.domain fallback)
    const tenant = await storage.getTenantByHostDomain(host);

    if (tenant) {
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return next();
    }

    // Allow fallback to 'default' tenant only on dev/preview hosts
    if (isDevHost(host)) {
      const defaultTenant = await storage.getTenant('default');
      if (defaultTenant) {
        req.tenant = defaultTenant;
        req.tenantId = defaultTenant.id;
        return next();
      }
    }

    return res.status(404).json({ error: "Tenant not found" });
  } catch (err) {
    console.error("resolveTenant error:", err);
    return res.status(500).json({ error: "Failed to resolve tenant" });
  }
}

// ─── Publish gate middleware ──────────────────────────────────────────────────
// Blocks public requests to draft/suspended tenants.
// Admin requests always pass through.
function requirePublished(req: Request, res: Response, next: NextFunction) {
  if (req.tenant.status === 'yayinda') return next();
  return res.status(404).json({ status: 'coming_soon', message: 'Bu site henüz yayında değil.' });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Trust proxy for Replit's HTTPS termination
  app.set('trust proxy', 1);

  app.use(session({
    secret: process.env.SESSION_SECRET || 'university-platform-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({ checkPeriod: 86400000 }),
    cookie: {
      secure: 'auto',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  // Register Object Storage routes
  registerObjectStorageRoutes(app);

  // ─── Optimized image endpoint ───────────────────────────────────────────────
  app.get("/api/img/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const width = parseInt(req.query.w as string) || 160;
      const height = req.query.h ? parseInt(req.query.h as string) : undefined;
      const format = (req.query.fmt as string) || 'webp';
      const quality = parseInt(req.query.q as string) || 75;

      const cacheKey = `${id}_${width}_${height || 'auto'}_${format}_${quality}`;
      const cached = imageCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
        res.set('Content-Type', cached.contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(cached.buffer);
      }

      const objectStorageService = new ObjectStorageService();
      let buffer: Buffer;
      try {
        const file = await objectStorageService.getObjectEntityFile(`/objects/uploads/${id}`);
        const [contents] = await file.download();
        buffer = contents;
      } catch {
        return res.status(404).json({ error: "Image not found" });
      }

      let sharpInstance = sharp(buffer);
      if (height) {
        sharpInstance = sharpInstance.resize(width, height, { fit: 'cover' });
      } else {
        sharpInstance = sharpInstance.resize(width, undefined, { withoutEnlargement: true });
      }

      let outputBuffer: Buffer;
      let contentType: string;
      if (format === 'webp') {
        outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
        contentType = 'image/webp';
      } else if (format === 'jpeg' || format === 'jpg') {
        outputBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
        contentType = 'image/jpeg';
      } else {
        outputBuffer = await sharpInstance.png({ quality }).toBuffer();
        contentType = 'image/png';
      }

      if (imageCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = imageCache.keys().next().value;
        if (oldestKey) imageCache.delete(oldestKey);
      }
      imageCache.set(cacheKey, { buffer: outputBuffer, contentType, timestamp: Date.now() });

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(outputBuffer);
    } catch (error) {
      console.error("Image optimization error:", error);
      res.status(500).json({ error: "Failed to optimize image" });
    }
  });

  // ─── Bootstrap API ──────────────────────────────────────────────────────────
  app.get("/api/bootstrap", resolveTenant, requirePublished, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const cached = bootstrapCache.get(tenantId);
      if (cached && Date.now() - cached.timestamp < BOOTSTRAP_CACHE_TTL) {
        res.set('Cache-Control', 'public, max-age=60');
        return res.json(cached.data);
      }

      const [tenant, theme, sectionsList, testimonialsList, faqList, seo] = await Promise.all([
        Promise.resolve(req.tenant),
        storage.getTheme(tenantId),
        storage.getSections(tenantId),
        storage.getTestimonials(tenantId),
        storage.getFaqItems(tenantId),
        storage.getSeoSettings(tenantId),
      ]);

      const data = { tenant, theme, sections: sectionsList, testimonials: testimonialsList, faqItems: faqList, seoSettings: seo };
      bootstrapCache.set(tenantId, { data, timestamp: Date.now() });

      res.set('Cache-Control', 'public, max-age=60');
      res.json(data);
    } catch (error) {
      console.error("Bootstrap error:", error);
      res.status(500).json({ error: "Failed to fetch bootstrap data" });
    }
  });

  // ─── File upload (admin only) ───────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file.buffer,
        headers: { "Content-Type": file.mimetype || "application/octet-stream" },
      });

      if (!response.ok) {
        console.error("GCS upload failed:", response.status, await response.text());
        return res.status(500).json({ error: "Failed to upload to storage" });
      }

      res.json({ objectPath, metadata: { name: file.originalname, size: file.size, contentType: file.mimetype } });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // ─── Admin Authentication ───────────────────────────────────────────────────
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const admin = await storage.getAdminByEmail(email);
      if (!admin || admin.passwordHash !== password) return res.status(401).json({ error: "Invalid credentials" });

      req.session.adminId = admin.id;
      req.session.tenantId = admin.tenantId || undefined;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        res.json({ success: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ success: true });
    });
  });

  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId || '');
      if (!admin) return res.status(404).json({ error: "Admin not found" });
      res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, tenantId: admin.tenantId });
    } catch {
      res.status(500).json({ error: "Failed to get admin info" });
    }
  });

  // ─── Admin Stats ────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const [sectionsList, testimonialsList, faqList, media] = await Promise.all([
        storage.getSections(tenantId),
        storage.getTestimonials(tenantId),
        storage.getFaqItems(tenantId),
        storage.getMediaAssets(tenantId),
      ]);
      res.json({
        sections: sectionsList.length,
        enabledSections: sectionsList.filter(s => s.isEnabled).length,
        testimonials: testimonialsList.length,
        faqItems: faqList.length,
        mediaAssets: media.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ─── Tenant API ─────────────────────────────────────────────────────────────
  app.get("/api/tenant", resolveTenant, requirePublished, async (req, res) => {
    res.json(req.tenant);
  });

  app.patch("/api/tenant", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const updated = await storage.updateTenant(req.tenantId, req.body);
      // Invalidate bootstrap cache for this tenant
      bootstrapCache.delete(req.tenantId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tenant:", error);
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // ─── Tenant Domains API ─────────────────────────────────────────────────────
  app.get("/api/admin/tenant-domains", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const domains = await storage.getTenantDomains(req.tenantId);
      res.json(domains);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch domains" });
    }
  });

  app.post("/api/admin/tenant-domains", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { domain, isPrimary } = req.body;
      if (!domain) return res.status(400).json({ error: "domain is required" });
      const created = await storage.createTenantDomain({ tenantId: req.tenantId, domain, isPrimary: isPrimary ?? false });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating domain:", error);
      res.status(500).json({ error: "Failed to create domain" });
    }
  });

  app.delete("/api/admin/tenant-domains/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const domains = await storage.getTenantDomains(req.tenantId);
      const domain = domains.find(d => d.id === req.params.id);
      if (!domain) return res.status(404).json({ error: "Domain not found" });
      await storage.deleteTenantDomain(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete domain" });
    }
  });

  // ─── Theme API ──────────────────────────────────────────────────────────────
  app.get("/api/theme", resolveTenant, requirePublished, async (req, res) => {
    try {
      let theme = await storage.getTheme(req.tenantId);
      if (!theme) theme = await storage.createTheme({ tenantId: req.tenantId });
      res.json(theme);
    } catch (error) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  });

  app.patch("/api/theme", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      let theme = await storage.getTheme(req.tenantId);
      if (!theme) {
        theme = await storage.createTheme({ tenantId: req.tenantId, ...req.body });
      } else {
        theme = await storage.updateTheme(req.tenantId, req.body);
      }
      bootstrapCache.delete(req.tenantId);
      res.json(theme);
    } catch (error) {
      console.error("Error updating theme:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  });

  // ─── Sections API ───────────────────────────────────────────────────────────
  app.get("/api/sections", resolveTenant, requirePublished, async (req, res) => {
    try {
      const list = await storage.getSections(req.tenantId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  app.post("/api/sections", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { sectionKey, displayOrder, isEnabled, contentByLang, settings } = req.body;
      if (!sectionKey) return res.status(400).json({ error: "sectionKey is required" });
      const section = await storage.createSection({
        tenantId: req.tenantId,
        sectionKey,
        displayOrder: displayOrder ?? 0,
        isEnabled: isEnabled ?? true,
        contentByLang: contentByLang ?? null,
        settings: settings ?? null,
      });
      bootstrapCache.delete(req.tenantId);
      res.status(201).json(section);
    } catch (error) {
      res.status(500).json({ error: "Failed to create section" });
    }
  });

  app.delete("/api/sections/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const deleted = await storage.deleteSection(req.params.id as string, req.tenantId);
      if (!deleted) return res.status(404).json({ error: "Section not found" });
      bootstrapCache.delete(req.tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete section" });
    }
  });

  app.patch("/api/sections/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const section = await storage.updateSection(req.params.id as string, req.body);
      if (!section) return res.status(404).json({ error: "Section not found" });
      bootstrapCache.delete(req.tenantId);
      res.json(section);
    } catch (error) {
      res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.patch("/api/sections", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const updates = req.body.sections as Array<{ id: string; isEnabled: boolean }>;
      const result = await storage.updateSections(updates);
      bootstrapCache.delete(req.tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sections" });
    }
  });

  // ─── SEO routes (sitemap + robots) ─────────────────────────────────────────
  app.get("/sitemap.xml", resolveTenant, requirePublished, (req, res) => {
    const baseUrl = `https://${req.tenant.domain}`;
    const languages = ["en", "ar", "tr", "fr", "ru", "fa"];

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

    languages.forEach((lang) => {
      sitemap += `
  <url>
    <loc>${baseUrl}/${lang}</loc>
    ${languages.map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l}" />`).join('\n    ')}
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`;
    });

    sitemap += "\n</urlset>";
    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  });

  app.get("/robots.txt", resolveTenant, requirePublished, (req, res) => {
    const baseUrl = `https://${req.tenant.domain}`;
    res.header("Content-Type", "text/plain");
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml`);
  });

  // ─── Media Assets API ───────────────────────────────────────────────────────
  app.get("/api/media", resolveTenant, requirePublished, async (req, res) => {
    try {
      const media = await storage.getMediaAssets(req.tenantId);
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  app.post("/api/media", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const parsed = insertMediaAssetSchema.safeParse({ ...req.body, tenantId: req.tenantId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid media data", details: parsed.error });
      const media = await storage.createMediaAsset(parsed.data);
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to create media" });
    }
  });

  app.delete("/api/media/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const asset = await storage.getMediaAsset(req.params.id as string);
      if (!asset || asset.tenantId !== req.tenantId) return res.status(404).json({ error: "Media not found" });
      await storage.deleteMediaAsset(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete media" });
    }
  });

  // ─── Testimonials API ───────────────────────────────────────────────────────
  app.get("/api/testimonials", resolveTenant, requirePublished, async (req, res) => {
    try {
      res.json(await storage.getTestimonials(req.tenantId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  app.get("/api/testimonials/:id", resolveTenant, requirePublished, async (req, res) => {
    try {
      const t = await storage.getTestimonial(req.params.id as string);
      if (!t || t.tenantId !== req.tenantId) return res.status(404).json({ error: "Testimonial not found" });
      res.json(t);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testimonial" });
    }
  });

  app.post("/api/testimonials", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const parsed = insertTestimonialSchema.safeParse({ ...req.body, tenantId: req.tenantId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid testimonial data", details: parsed.error });
      bootstrapCache.delete(req.tenantId);
      res.json(await storage.createTestimonial(parsed.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create testimonial" });
    }
  });

  app.patch("/api/testimonials/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const existing = await storage.getTestimonial(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "Testimonial not found" });
      const { tenantId: _, id: __, ...updateData } = req.body;
      bootstrapCache.delete(req.tenantId);
      res.json(await storage.updateTestimonial(req.params.id as string, updateData));
    } catch (error) {
      res.status(500).json({ error: "Failed to update testimonial" });
    }
  });

  app.delete("/api/testimonials/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const existing = await storage.getTestimonial(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "Testimonial not found" });
      await storage.deleteTestimonial(req.params.id as string);
      bootstrapCache.delete(req.tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete testimonial" });
    }
  });

  // ─── FAQ Items API ──────────────────────────────────────────────────────────
  app.get("/api/faq", resolveTenant, requirePublished, async (req, res) => {
    try {
      res.json(await storage.getFaqItems(req.tenantId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch FAQ items" });
    }
  });

  app.get("/api/faq/:id", resolveTenant, requirePublished, async (req, res) => {
    try {
      const faq = await storage.getFaqItem(req.params.id as string);
      if (!faq || faq.tenantId !== req.tenantId) return res.status(404).json({ error: "FAQ item not found" });
      res.json(faq);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch FAQ item" });
    }
  });

  app.post("/api/faq", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const parsed = insertFaqItemSchema.safeParse({ ...req.body, tenantId: req.tenantId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid FAQ data", details: parsed.error });
      bootstrapCache.delete(req.tenantId);
      res.json(await storage.createFaqItem(parsed.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create FAQ item" });
    }
  });

  app.patch("/api/faq/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const existing = await storage.getFaqItem(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "FAQ item not found" });
      const { tenantId: _, id: __, ...updateData } = req.body;
      bootstrapCache.delete(req.tenantId);
      res.json(await storage.updateFaqItem(req.params.id as string, updateData));
    } catch (error) {
      res.status(500).json({ error: "Failed to update FAQ item" });
    }
  });

  app.delete("/api/faq/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const existing = await storage.getFaqItem(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "FAQ item not found" });
      await storage.deleteFaqItem(req.params.id as string);
      bootstrapCache.delete(req.tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete FAQ item" });
    }
  });

  // ─── SEO Settings API ───────────────────────────────────────────────────────
  app.get("/api/seo-settings", resolveTenant, requirePublished, async (req, res) => {
    try {
      res.json(await storage.getSeoSettings(req.tenantId) || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SEO settings" });
    }
  });

  app.get("/api/admin/seo-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      res.json(await storage.getSeoSettings(req.tenantId) || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SEO settings" });
    }
  });

  app.post("/api/admin/seo-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { tenantId: _, id: __, ...data } = req.body;
      const parsed = insertSeoSettingsSchema.omit({ tenantId: true }).safeParse(data);
      if (!parsed.success) return res.status(400).json({ error: "Invalid SEO settings data", details: parsed.error });

      const existing = await storage.getSeoSettings(req.tenantId);
      const seo = existing
        ? await storage.updateSeoSettings(req.tenantId, parsed.data)
        : await storage.createSeoSettings({ ...parsed.data, tenantId: req.tenantId });
      bootstrapCache.delete(req.tenantId);
      res.json(seo);
    } catch (error) {
      res.status(500).json({ error: "Failed to save SEO settings" });
    }
  });

  return httpServer;
}
