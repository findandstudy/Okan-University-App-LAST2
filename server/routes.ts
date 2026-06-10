import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertMediaAssetSchema,
  insertTestimonialSchema,
  insertFaqItemSchema,
  insertSeoSettingsSchema,
  insertWidgetSchema,
  type Tenant,
} from "@shared/schema";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { saveUpload, readUpload, serveUpload } from "./localFileStorage";
import { db } from "./db";
import { integrationSettings, SUPPORTED_LANGUAGES } from "@shared/schema";
import { sql, and, eq } from "drizzle-orm";
import { startBlogScheduler } from "./blogScheduler";
import { startExportJob, getExportJob, captureSnapshot, restoreSnapshot } from "./zipExporter";

const PgStore = connectPgSimple(session);

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
  // Admin _tid override: only super_admin or admin's own tenant can override via ?_tid=
  if (req.session?.adminId && req.query._tid && typeof req.query._tid === 'string') {
    try {
      const admin = await storage.getAdminById(req.session.adminId);
      const isSuperAdmin = admin?.role === 'super_admin';
      const isOwnTenant = admin?.tenantId === req.query._tid;
      if (isSuperAdmin || isOwnTenant) {
        const overrideTenant = await storage.getTenant(req.query._tid);
        if (overrideTenant) {
          req.tenant = overrideTenant;
          req.tenantId = overrideTenant.id;
          return next();
        }
      }
    } catch { /* fall through to normal resolution */ }
  }
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
// Authenticated admins always pass through regardless of status.
function requirePublished(req: Request, res: Response, next: NextFunction) {
  if (req.session?.adminId) return next(); // Admins can view/edit draft tenants
  if (req.tenant.status === 'yayinda') return next();
  return res.status(404).json({ status: 'coming_soon', message: 'Bu site henüz yayında değil.' });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Trust proxy for Replit's HTTPS termination
  app.set('trust proxy', 1);

  // ─── Rate limiters ──────────────────────────────────────────────────────────
  const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again in 15 minutes." },
  });

  const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Upload rate limit exceeded. Try again shortly." },
  });

  // ─── PostgreSQL session store ───────────────────────────────────────────────
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
      // Use the same pg Pool from drizzle's db connection
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 3600, // prune expired sessions every hour
    }),
    cookie: {
      secure: 'auto',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  // ─── Local file serving (replaces Replit GCS sidecar) ─────────────────────
  // Serve local uploads — pathParam is everything after /objects/, e.g. "uploads/<uuid>.png"
  app.get("/objects/{*objectPath}", (req, res) => {
    const pathParam = Array.isArray(req.params.objectPath)
      ? req.params.objectPath.join('/')
      : req.params.objectPath;
    if (!pathParam) return res.status(400).json({ error: 'Invalid path' });
    // Export ZIPs stored under uploads/exports/ — serve directly
    if (pathParam.startsWith('exports/')) {
      const fs = require('fs') as typeof import('fs');
      const nodePath = require('path') as typeof import('path');
      const { getUploadsDir } = require('./localFileStorage') as typeof import('./localFileStorage');
      const fname = pathParam.slice('exports/'.length);
      if (!fname || fname.includes('..')) return res.status(400).json({ error: 'Invalid path' });
      const fullPath = nodePath.join(getUploadsDir(), 'exports', fname);
      if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${fname}"`);
      return fs.createReadStream(fullPath).pipe(res);
    }
    serveUpload(`/objects/${pathParam}`, res);
  });

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

      let buffer: Buffer;
      try {
        buffer = readUpload(`/objects/uploads/${id}`);
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

      const [tenant, theme, sectionsList, testimonialsList, faqList, seo, domains] = await Promise.all([
        Promise.resolve(req.tenant),
        storage.getTheme(tenantId),
        storage.getSections(tenantId),
        storage.getTestimonials(tenantId),
        storage.getFaqItems(tenantId),
        storage.getSeoSettings(tenantId),
        storage.getTenantDomains(tenantId),
      ]);

      const primaryDomainRow = domains.find(d => d.isPrimary) || domains[0];
      const primaryDomain = primaryDomainRow?.domain || tenant.domain;
      const allDomains = Array.from(new Set([tenant.domain, ...domains.map(d => d.domain)]));

      const data = { tenant, theme, sections: sectionsList, testimonials: testimonialsList, faqItems: faqList, seoSettings: seo, primaryDomain, allDomains };
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

  app.post("/api/upload", uploadRateLimit, requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const objectPath = saveUpload(file.buffer, file.originalname);

      res.json({ objectPath, metadata: { name: file.originalname, size: file.size, contentType: file.mimetype } });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // ─── Admin Authentication ───────────────────────────────────────────────────
  app.post("/api/admin/login", loginRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const admin = await storage.getAdminByEmail(email);
      if (!admin) return res.status(401).json({ error: "Invalid credentials" });

      // Support both bcrypt hashes and legacy plain-text passwords during migration
      const isHashed = admin.passwordHash.startsWith('$2');
      const valid = isHashed
        ? await bcrypt.compare(password, admin.passwordHash)
        : admin.passwordHash === password;
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      req.session.adminId = admin.id;
      req.session.tenantId = admin.tenantId || undefined;
      // If plain-text password was accepted, upgrade to bcrypt hash now
      if (!admin.passwordHash.startsWith('$2')) {
        const newHash = await bcrypt.hash(password, 10);
        await storage.updateAdminPassword(admin.id, newHash, true);
      }

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        res.json({
          success: true,
          mustChangePassword: admin.mustChangePassword ?? false,
          admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, tenantId: admin.tenantId },
        });
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

  // ─── Change Password (first-login or voluntary) ─────────────────────────────
  app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "currentPassword and newPassword required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin) return res.status(401).json({ error: "Unauthorized" });

      const isHashed = admin.passwordHash.startsWith('$2');
      const valid = isHashed
        ? await bcrypt.compare(currentPassword, admin.passwordHash)
        : admin.passwordHash === currentPassword;
      if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

      const newHash = await bcrypt.hash(newPassword, 10);
      await storage.updateAdminPassword(admin.id, newHash, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
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
  app.get("/sitemap.xml", resolveTenant, requirePublished, async (req, res) => {
    try {
      const domains = await storage.getTenantDomains(req.tenantId);
      const primaryDomainRow = domains.find(d => d.isPrimary) || domains[0];
      const primaryDomain = primaryDomainRow?.domain || req.tenant.domain;
      const baseUrl = `https://${primaryDomain}`;
      const today = new Date().toISOString().split('T')[0];

      const allLangAlternates = [
        `<xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/" />`,
        ...SUPPORTED_LANGUAGES.map(l =>
          `<xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l === 'en' ? '' : l}" />`
        ),
      ].join('\n    ');

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${baseUrl}/</loc>
    ${allLangAlternates}
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`;

      SUPPORTED_LANGUAGES.filter(l => l !== 'en').forEach((lang) => {
        sitemap += `
  <url>
    <loc>${baseUrl}/${lang}</loc>
    ${allLangAlternates}
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
      });

      // ── Blog index pages ────────────────────────────────────────────────────
      const blogAlternates = [
        `<xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/blog" />`,
        ...SUPPORTED_LANGUAGES.map(l =>
          `<xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l === 'en' ? 'blog' : `${l}/blog`}" />`
        ),
      ].join('\n    ');

      sitemap += `
  <url>
    <loc>${baseUrl}/blog</loc>
    ${blogAlternates}
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;

      SUPPORTED_LANGUAGES.filter(l => l !== 'en').forEach((lang) => {
        sitemap += `
  <url>
    <loc>${baseUrl}/${lang}/blog</loc>
    ${blogAlternates}
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
      });

      // ── Individual blog posts ────────────────────────────────────────────────
      try {
        const publishedPosts = await storage.getPublishedBlogPosts(req.tenantId, 'en');
        for (const { post, translation: enTranslation } of publishedPosts) {
          const allTranslations = await storage.getBlogPostTranslations(post.id);
          const postAlternates = [
            `<xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/blog/${enTranslation.slug}" />`,
            ...allTranslations.map(t =>
              `<xhtml:link rel="alternate" hreflang="${t.lang}" href="${baseUrl}/${t.lang === 'en' ? 'blog' : `${t.lang}/blog`}/${t.slug}" />`
            ),
          ].join('\n    ');
          const postDate = post.publishAt
            ? new Date(post.publishAt).toISOString().split('T')[0]
            : today;

          sitemap += `
  <url>
    <loc>${baseUrl}/blog/${enTranslation.slug}</loc>
    ${postAlternates}
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;

          // Add non-EN lang-specific URLs
          for (const t of allTranslations.filter(t => t.lang !== 'en')) {
            sitemap += `
  <url>
    <loc>${baseUrl}/${t.lang}/blog/${t.slug}</loc>
    ${postAlternates}
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
          }
        }
      } catch { /* blog posts optional in sitemap */ }

      sitemap += '\n</urlset>';
      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600');
      res.send(sitemap);
    } catch (err) {
      console.error('Sitemap error:', err);
      res.status(500).send('Failed to generate sitemap');
    }
  });

  app.get("/robots.txt", resolveTenant, requirePublished, async (req, res) => {
    try {
      const domains = await storage.getTenantDomains(req.tenantId);
      const primaryDomainRow = domains.find(d => d.isPrimary) || domains[0];
      const primaryDomain = primaryDomainRow?.domain || req.tenant.domain;
      const baseUrl = `https://${primaryDomain}`;
      res.header('Content-Type', 'text/plain');
      res.header('Cache-Control', 'public, max-age=3600');
      res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/admin/\n\nSitemap: ${baseUrl}/sitemap.xml`);
    } catch (err) {
      res.header('Content-Type', 'text/plain');
      res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: https://${req.tenant.domain}/sitemap.xml`);
    }
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

  // ─── Admin Tenant Management ─────────────────────────────────────────────────
  app.get("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin) return res.status(401).json({ error: "Unauthorized" });
      if (admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/admin/tenants/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const tenant = await storage.getTenant(id);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json(tenant);
    } catch {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.post("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const { universityName, domain, languages } = req.body;
      if (!universityName || !domain) return res.status(400).json({ error: "universityName and domain are required" });
      const supportedLanguages = Array.isArray(languages) && languages.length > 0 ? languages : ['en'];
      const tenant = await storage.createTenant({ universityName, domain, status: 'taslak', supportedLanguages });
      // Create primary domain record
      await storage.createTenantDomain({ tenantId: tenant.id, domain, isPrimary: true });
      // Seed baseline sections for the new tenant
      const defaultSections: Array<{ tenantId: string; sectionKey: string; isEnabled: boolean; displayOrder: number; settings: Record<string, unknown> }> = [
        { tenantId: tenant.id, sectionKey: 'hero', isEnabled: true, displayOrder: 10, settings: {} },
        { tenantId: tenant.id, sectionKey: 'trust_badges', isEnabled: true, displayOrder: 20, settings: {} },
        { tenantId: tenant.id, sectionKey: 'steps', isEnabled: true, displayOrder: 30, settings: {} },
        { tenantId: tenant.id, sectionKey: 'testimonials', isEnabled: true, displayOrder: 40, settings: {} },
        { tenantId: tenant.id, sectionKey: 'faq', isEnabled: true, displayOrder: 50, settings: {} },
        { tenantId: tenant.id, sectionKey: 'contact', isEnabled: true, displayOrder: 60, settings: {} },
        { tenantId: tenant.id, sectionKey: 'footer', isEnabled: true, displayOrder: 70, settings: {} },
        { tenantId: tenant.id, sectionKey: 'disclaimer', isEnabled: true, displayOrder: 80, settings: {} },
      ];
      for (const section of defaultSections) {
        await storage.createSection(section as any);
      }
      res.json(tenant);
    } catch {
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  app.patch("/api/admin/tenants/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const body = req.body;
      const tenant = await storage.updateTenant(id, body);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      // Sync primary domain: on publish, or whenever domain changes, upsert primary domain record
      if (tenant.domain && (body.status === 'yayinda' || body.domain)) {
        const domains = await storage.getTenantDomains(id);
        const primaryDomain = domains.find(d => d.isPrimary);
        if (!primaryDomain) {
          await storage.createTenantDomain({ tenantId: id, domain: tenant.domain, isPrimary: true });
        } else if (primaryDomain.domain !== tenant.domain) {
          await storage.deleteTenantDomain(primaryDomain.id);
          await storage.createTenantDomain({ tenantId: id, domain: tenant.domain, isPrimary: true });
        }
      }
      res.json(tenant);
    } catch {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.delete("/api/admin/tenants/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      if (id === 'default') return res.status(400).json({ error: "Cannot delete default tenant" });
      const ok = await storage.deleteTenant(id);
      if (!ok) return res.status(404).json({ error: "Tenant not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete tenant" });
    }
  });

  app.post("/api/admin/tenants/:id/clone", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const { universityName, domain } = req.body;
      if (!universityName || !domain) return res.status(400).json({ error: "universityName and domain are required" });
      const newTenant = await storage.createTenant({ universityName, domain, status: 'taslak' });
      // Create primary domain record for the cloned tenant
      await storage.createTenantDomain({ tenantId: newTenant.id, domain, isPrimary: true });
      // Clone sections from source
      const srcSections = await storage.getSections(id);
      for (const s of srcSections) {
        const { id: _id, tenantId: _tid, ...rest } = s as any;
        await storage.createSection({ ...rest, tenantId: newTenant.id });
      }
      // Clone FAQ items from source
      const srcFaq = await storage.getFaqItems(id);
      for (const f of srcFaq) {
        const { id: _id, tenantId: _tid, ...rest } = f as any;
        await storage.createFaqItem({ ...rest, tenantId: newTenant.id });
      }
      // Clone testimonials from source
      const srcTestimonials = await storage.getTestimonials(id);
      for (const t of srcTestimonials) {
        const { id: _id, tenantId: _tid, ...rest } = t as any;
        await storage.createTestimonial({ ...rest, tenantId: newTenant.id });
      }
      // Clone theme from source
      const srcTheme = await storage.getTheme(id);
      if (srcTheme) {
        const { id: _id, tenantId: _tid, ...rest } = srcTheme as any;
        await storage.createTheme({ ...rest, tenantId: newTenant.id });
      }
      // Clone widgets from source
      const srcWidgets = await storage.getWidgets(id);
      for (const w of srcWidgets) {
        const { id: _id, tenantId: _tid, ...rest } = w as any;
        await storage.createWidget({ ...rest, tenantId: newTenant.id });
      }
      res.json(newTenant);
    } catch (error) {
      console.error('Clone error:', error);
      res.status(500).json({ error: "Failed to clone tenant" });
    }
  });

  // ─── Widget routes (admin) ────────────────────────────────────────────────────
  app.get("/api/admin/widgets", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const widgets = await storage.getWidgets(req.tenantId);
      res.json(widgets);
    } catch {
      res.status(500).json({ error: "Failed to fetch widgets" });
    }
  });

  app.post("/api/admin/widgets", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const widget = await storage.createWidget({ ...req.body, tenantId: req.tenantId });
      res.json(widget);
    } catch {
      res.status(500).json({ error: "Failed to create widget" });
    }
  });

  app.patch("/api/admin/widgets/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const id = req.params.id as string;
    try {
      const existing = await storage.getWidget(id);
      if (!existing) return res.status(404).json({ error: "Widget not found" });
      if (existing.tenantId !== req.tenantId) return res.status(403).json({ error: "Forbidden" });
      const widget = await storage.updateWidget(id, req.body);
      res.json(widget);
    } catch {
      res.status(500).json({ error: "Failed to update widget" });
    }
  });

  app.delete("/api/admin/widgets/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const id = req.params.id as string;
    try {
      const existing = await storage.getWidget(id);
      if (!existing) return res.status(404).json({ error: "Widget not found" });
      if (existing.tenantId !== req.tenantId) return res.status(403).json({ error: "Forbidden" });
      const ok = await storage.deleteWidget(id);
      if (!ok) return res.status(404).json({ error: "Widget not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete widget" });
    }
  });

  // ─── Widget route (public) ────────────────────────────────────────────────────
  app.get("/api/widgets", resolveTenant, requirePublished, async (req, res) => {
    try {
      const widgets = await storage.getWidgets(req.tenantId);
      res.json(widgets.filter(w => w.isEnabled));
    } catch {
      res.status(500).json({ error: "Failed to fetch widgets" });
    }
  });

  // ─── AI Settings ─────────────────────────────────────────────────────────────
  app.get("/api/admin/ai-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const settings = await storage.getAISettings(req.tenantId);
      if (!settings) return res.json(null);
      res.json({ provider: settings.provider, model: settings.model, hasApiKey: settings.hasApiKey });
    } catch {
      res.status(500).json({ error: "Failed to fetch AI settings" });
    }
  });

  app.post("/api/admin/ai-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { provider, model, apiKey } = req.body;
      if (!provider || !model) return res.status(400).json({ error: "provider and model are required" });
      const { encryptApiKey } = await import('./aiService');
      const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : undefined;
      await storage.saveAISettings(req.tenantId, { provider, model, encryptedApiKey });
      // Clean up legacy integration_settings entries for this tenant
      await db
        .delete(integrationSettings)
        .where(
          and(
            eq(integrationSettings.tenantId, req.tenantId),
            sql`${integrationSettings.integrationType} IN ('n8n', 'portal')`,
          ),
        );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to save AI settings" });
    }
  });

  app.post("/api/admin/ai/test", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { provider, model, apiKey } = req.body;
      if (!provider || !model) return res.status(400).json({ error: "provider and model are required" });
      let keyToTest = apiKey;
      if (!keyToTest) {
        const settings = await storage.getAISettings(req.tenantId);
        if (!settings?.encryptedApiKey) return res.status(400).json({ error: "No API key configured" });
        const { decryptApiKey } = await import('./aiService');
        keyToTest = decryptApiKey(settings.encryptedApiKey);
      }
      const { testAIConnection } = await import('./aiService');
      const success = await testAIConnection(provider, keyToTest, model);
      res.json({ success });
    } catch (err: any) {
      res.json({ success: false, error: err?.message || 'Connection failed' });
    }
  });

  app.post("/api/admin/ai/translate", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { sourceContent, sourceLang = 'en', targetLangs } = req.body;
      if (!sourceContent || !targetLangs) return res.status(400).json({ error: "sourceContent and targetLangs are required" });
      const { translateContentByLang } = await import('./aiTranslation');
      const result = await translateContentByLang(sourceContent, sourceLang, targetLangs, req.tenantId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Translation failed" });
    }
  });

  app.post("/api/admin/ai/generate-content", requireAdmin, resolveTenant, requireAdminTenantAccess, upload.single('file'), async (req, res) => {
    try {
      const { url, text } = req.body;
      const file = req.file;
      let sourceText = '';

      const { extractTextFromUrl, extractTextFromPdf, extractTextFromDocx, generateContent } = await import('./contentGenerator');

      if (url) {
        sourceText = await extractTextFromUrl(url);
      } else if (file) {
        const ext = file.originalname?.toLowerCase();
        if (ext?.endsWith('.pdf')) {
          sourceText = await extractTextFromPdf(file.buffer);
        } else if (ext?.endsWith('.docx')) {
          sourceText = await extractTextFromDocx(file.buffer);
        } else {
          return res.status(400).json({ error: "Unsupported file type. Use PDF or DOCX." });
        }
      } else if (text) {
        sourceText = text;
      } else {
        return res.status(400).json({ error: "Provide url, file, or text" });
      }

      if (!sourceText.trim()) return res.status(400).json({ error: "No text content found in source" });

      const content = await generateContent(sourceText, req.tenantId);
      res.json(content);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Content generation failed" });
    }
  });

  app.post("/api/admin/ai/apply-content", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { generatedContent } = req.body;
      if (!generatedContent) return res.status(400).json({ error: "generatedContent is required" });

      const { hero, about, faq, seo: seoData } = generatedContent;

      // Find or create hero section
      const existingSections = await storage.getSections(req.tenantId);
      const heroSection = existingSections.find(s => s.sectionKey === 'hero');

      const ALL_LANGS = ['en','ar','tr','fr','ru','fa','zh','hi','es','id'] as const;
      const TARGET_LANGS = ['ar','tr','fr','ru','fa','zh','hi','es','id'];
      const emptyLangMap = Object.fromEntries(ALL_LANGS.map(l => [l, ''])) as Record<typeof ALL_LANGS[number], string>;

      // ── Hero section: merge-safe write (preserve existing non-EN fields) ──────
      const heroEnContent = {
        title: hero?.title || '',
        subtitle: hero?.subtitle || '',
        body: hero?.body || '',
        ctaLabel: hero?.ctaLabel || '',
      };
      const heroExisting = (heroSection?.contentByLang as Record<string, any>) || {};
      // Merge: keep existing per-lang translations, overwrite only EN
      const heroMerged: Record<string, any> = { ...heroExisting, en: heroEnContent };

      if (heroSection) {
        await storage.updateSection(heroSection.id, { contentByLang: heroMerged });
      } else {
        await storage.createSection({
          tenantId: req.tenantId,
          sectionKey: 'hero',
          displayOrder: 0,
          isEnabled: true,
          contentByLang: heroMerged,
          settings: null,
        });
      }

      // ── About section: merge-safe write ──────────────────────────────────────
      let aboutSectionId: string | null = null;
      if (about?.title || about?.body) {
        const aboutSection = existingSections.find(s => s.sectionKey === 'about');
        const aboutEnContent = { title: about?.title || '', body: about?.body || '' };
        const aboutExisting = (aboutSection?.contentByLang as Record<string, any>) || {};
        const aboutMerged: Record<string, any> = { ...aboutExisting, en: aboutEnContent };
        if (aboutSection) {
          await storage.updateSection(aboutSection.id, { contentByLang: aboutMerged });
          aboutSectionId = aboutSection.id;
        } else {
          const created = await storage.createSection({
            tenantId: req.tenantId,
            sectionKey: 'about',
            displayOrder: 1,
            isEnabled: true,
            contentByLang: aboutMerged,
            settings: null,
          });
          aboutSectionId = created.id;
        }
      }

      // ── SEO settings ─────────────────────────────────────────────────────────
      if (seoData?.metaTitle || seoData?.metaDescription || seoData?.keywords) {
        const existingSeo = await storage.getSeoSettings(req.tenantId);
        const seoUpdate = {
          metaTitleByLang: { ...emptyLangMap, en: seoData.metaTitle || '' },
          metaDescriptionByLang: { ...emptyLangMap, en: seoData.metaDescription || '' },
          metaKeywordsByLang: { ...emptyLangMap, en: seoData.keywords || '' },
        };
        if (existingSeo) {
          await storage.updateSeoSettings(req.tenantId, seoUpdate);
        } else {
          await storage.createSeoSettings({ tenantId: req.tenantId, ...seoUpdate });
        }
      }

      // ── FAQ items ─────────────────────────────────────────────────────────────
      const createdFaqIds: string[] = [];
      if (Array.isArray(faq) && faq.length > 0) {
        const existingFaq = await storage.getFaqItems(req.tenantId);
        for (const item of faq) {
          if (!item.question) continue;
          const exists = existingFaq.find(f => (f.questionByLang?.en || '') === item.question);
          if (!exists) {
            const created = await storage.createFaqItem({
              tenantId: req.tenantId,
              questionByLang: { ...emptyLangMap, en: item.question },
              answerByLang: { ...emptyLangMap, en: item.answer },
              displayOrder: existingFaq.length + createdFaqIds.length,
              isEnabled: true,
            });
            createdFaqIds.push(created.id);
          }
        }
      }

      // ── Background translation: hero + about + FAQ + SEO ──────────────────────
      (async () => {
        try {
          const { translateContentByLang } = await import('./aiTranslation');

          // Hero translation
          if (hero?.title) {
            const heroTranslated = await translateContentByLang(
              { title: hero.title, subtitle: hero.subtitle || '', body: hero.body || '', ctaLabel: hero.ctaLabel || '' },
              'en', TARGET_LANGS, req.tenantId,
            );
            const heroFull: Record<string, any> = { en: heroEnContent };
            for (const [lang, content] of Object.entries(heroTranslated)) heroFull[lang] = content;
            const secs = await storage.getSections(req.tenantId);
            const heroSec = secs.find(s => s.sectionKey === 'hero');
            if (heroSec) await storage.updateSection(heroSec.id, { contentByLang: heroFull });
          }

          // About translation
          if (aboutSectionId && (about?.title || about?.body)) {
            const aboutTranslated = await translateContentByLang(
              { title: about.title || '', body: about.body || '' },
              'en', TARGET_LANGS, req.tenantId,
            );
            const aboutFull: Record<string, any> = { en: { title: about.title || '', body: about.body || '' } };
            for (const [lang, content] of Object.entries(aboutTranslated)) aboutFull[lang] = content;
            await storage.updateSection(aboutSectionId, { contentByLang: aboutFull });
          }

          // FAQ translation (translate each item question+answer)
          if (createdFaqIds.length > 0 && Array.isArray(faq)) {
            const newFaqItems = await storage.getFaqItems(req.tenantId);
            for (const itemId of createdFaqIds) {
              const faqRow = newFaqItems.find(f => f.id === itemId);
              if (!faqRow) continue;
              const enQ = faqRow.questionByLang?.en || '';
              const enA = faqRow.answerByLang?.en || '';
              if (!enQ) continue;
              const qTranslated = await translateContentByLang({ text: enQ }, 'en', TARGET_LANGS, req.tenantId);
              const aTranslated = await translateContentByLang({ text: enA }, 'en', TARGET_LANGS, req.tenantId);
              const newQ: Record<string, string> = { ...emptyLangMap, en: enQ };
              const newA: Record<string, string> = { ...emptyLangMap, en: enA };
              for (const lang of TARGET_LANGS) {
                newQ[lang] = (qTranslated[lang] as any)?.text || enQ;
                newA[lang] = (aTranslated[lang] as any)?.text || enA;
              }
              await storage.updateFaqItem(faqRow.id, { questionByLang: newQ as any, answerByLang: newA as any });
            }
          }

          // SEO translation
          if (seoData?.metaTitle) {
            const seoTranslated = await translateContentByLang(
              { metaTitle: seoData.metaTitle || '', metaDescription: seoData.metaDescription || '', keywords: seoData.keywords || '' },
              'en', TARGET_LANGS, req.tenantId,
            );
            const titleMap: Record<string, string> = { ...emptyLangMap, en: seoData.metaTitle || '' };
            const descMap: Record<string, string> = { ...emptyLangMap, en: seoData.metaDescription || '' };
            const kwMap: Record<string, string> = { ...emptyLangMap, en: seoData.keywords || '' };
            for (const lang of TARGET_LANGS) {
              titleMap[lang] = (seoTranslated[lang] as any)?.metaTitle || seoData.metaTitle || '';
              descMap[lang] = (seoTranslated[lang] as any)?.metaDescription || seoData.metaDescription || '';
              kwMap[lang] = (seoTranslated[lang] as any)?.keywords || seoData.keywords || '';
            }
            await storage.updateSeoSettings(req.tenantId, {
              metaTitleByLang: titleMap as any,
              metaDescriptionByLang: descMap as any,
              metaKeywordsByLang: kwMap as any,
            });
          }
        } catch {
          // background — ignore errors
        }
      })();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to apply content" });
    }
  });

  // ─── AI Localize SEO ──────────────────────────────────────────────────────
  app.post("/api/admin/ai/localize-seo", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { metaTitle, metaDescription, keywords } = req.body;
      if (!metaTitle) return res.status(400).json({ error: "metaTitle is required" });

      const { callAI } = await import('./aiService');
      const targetLangs = ['ar','tr','fr','ru','fa','zh','hi','es','id'];

      const systemPrompt = `You are an expert SEO consultant and multilingual copywriter. Create localized (not just translated) SEO meta content for a university landing page. Adapt culturally to be SEO-effective for each language/region.`;
      const prompt = `Given this English SEO metadata for a university landing page:
Title: ${metaTitle}
Description: ${metaDescription || ''}
Keywords: ${keywords || ''}

Create localized versions for these languages: ${targetLangs.join(', ')}

Return ONLY valid JSON with this exact structure:
{
  "ar": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "tr": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "fr": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "ru": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "fa": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "zh": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "hi": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "es": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." },
  "id": { "metaTitle": "...", "metaDescription": "...", "keywords": "..." }
}

Rules:
- Localize culturally, adapt for local search intent — not word-for-word translation
- Keep titles under 60 chars, descriptions under 160 chars
- Keywords should be comma-separated in the target language`;

      const raw = await callAI(prompt, req.tenantId, systemPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Invalid AI response format');
      const localized = JSON.parse(match[0]);
      res.json({ localized });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to localize SEO content' });
    }
  });

  // ─── Public Blog API ──────────────────────────────────────────────────────────
  app.get("/api/blog", resolveTenant, requirePublished, async (req, res) => {
    try {
      const lang = (req.query.lang as string) || 'en';
      const posts = await storage.getPublishedBlogPosts(req.tenantId, lang);
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch blog posts' });
    }
  });

  app.get("/api/blog/:slug", resolveTenant, requirePublished, async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const lang = (req.query.lang as string) || 'en';
      const result = await storage.getBlogPostTranslationBySlug(req.tenantId, lang, slug);
      if (!result) return res.status(404).json({ error: 'Post not found' });

      // Collect alternates (all available translations for this post)
      const translations = await storage.getBlogPostTranslations(result.post.id);
      const alternates: Record<string, string> = {};
      for (const t of translations) {
        alternates[t.lang] = t.slug;
      }

      res.json({ ...result, alternates });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch blog post' });
    }
  });

  // ─── Admin Blog API ──────────────────────────────────────────────────────────
  app.get("/api/admin/blog", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const posts = await storage.getBlogPosts(req.tenantId);
      const withTranslations = await Promise.all(posts.map(async (post) => {
        const translations = await storage.getBlogPostTranslations(post.id);
        return { ...post, translations };
      }));
      res.json(withTranslations);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch blog posts' });
    }
  });

  app.post("/api/admin/blog", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { keyword, backlinkSites, publishAt, status } = req.body;
      const post = await storage.createBlogPost({
        tenantId: req.tenantId,
        keyword: keyword || null,
        backlinkSites: backlinkSites || [],
        publishAt: publishAt ? new Date(publishAt) : null,
        status: status || 'taslak',
        isAiGenerated: false,
      });
      res.status(201).json(post);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create blog post' });
    }
  });

  app.patch("/api/admin/blog/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const id = req.params.id as string;
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const updated = await storage.updateBlogPost(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update blog post' });
    }
  });

  app.delete("/api/admin/blog/:id", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const id = req.params.id as string;
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      await storage.deleteBlogPost(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete blog post' });
    }
  });

  // ─── AI Generate blog post ────────────────────────────────────────────────────
  app.post("/api/admin/blog/:id/generate", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const id = req.params.id as string;
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const { generateBlogPost, translateBlogPost } = await import('./contentGenerator');
      const keyword = post.keyword || req.body.keyword || 'university education';
      const backlinkSites = post.backlinkSites || [];

      // Generate EN content
      const enContent = await generateBlogPost(keyword, backlinkSites, req.tenantId);

      // Save EN translation
      await storage.upsertBlogPostTranslation({
        postId: id,
        tenantId: req.tenantId,
        lang: 'en',
        title: enContent.title,
        slug: enContent.slug,
        content: enContent.content,
        metaTitle: enContent.metaTitle,
        metaDesc: enContent.metaDesc,
      });

      // Translate to all other languages
      const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en');
      const translations = await translateBlogPost(enContent, [...otherLangs], req.tenantId);

      for (const [lang, content] of Object.entries(translations)) {
        await storage.upsertBlogPostTranslation({
          postId: id,
          tenantId: req.tenantId,
          lang,
          title: content.title,
          slug: content.slug,
          content: content.content,
          metaTitle: content.metaTitle,
          metaDesc: content.metaDesc,
        });
      }

      await storage.updateBlogPost(id, { isAiGenerated: true });

      const allTranslations = await storage.getBlogPostTranslations(id);
      res.json({ success: true, translations: allTranslations });
    } catch (err: any) {
      console.error('Blog generate error:', err);
      res.status(500).json({ error: err?.message || 'Failed to generate blog post' });
    }
  });

  // ─── Approve blog post (onay mode) ───────────────────────────────────────────
  app.post("/api/admin/blog/:id/approve", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const id = req.params.id as string;
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const updated = await storage.updateBlogPost(id, { status: 'yayinda' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to approve blog post' });
    }
  });

  // ─── Excel Import ─────────────────────────────────────────────────────────────
  const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.post("/api/admin/blog/import", requireAdmin, resolveTenant, requireAdminTenantAccess, xlsxUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const xlsx = await import('xlsx');
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, any>[];

      const created: any[] = [];
      for (const row of rows) {
        const title = row['title'] || row['başlık'] || row['baslik'] || '';
        const keyword = row['keyword'] || row['anahtar_kelime'] || row['anahtar kelime'] || title;
        const backlinkRaw = row['backlink_siteleri'] || row['backlink_sites'] || row['backlinks'] || '';
        const backlinkSites = typeof backlinkRaw === 'string'
          ? backlinkRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
          : [];

        if (!keyword) continue;

        const post = await storage.createBlogPost({
          tenantId: req.tenantId,
          keyword,
          backlinkSites,
          publishAt: null,
          status: 'taslak',
          isAiGenerated: false,
        });

        // Save a draft EN translation with just the title
        if (title) {
          await storage.upsertBlogPostTranslation({
            postId: post.id,
            tenantId: req.tenantId,
            lang: 'en',
            title,
            slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 80),
            content: '',
            metaTitle: title,
            metaDesc: null,
          });
        }

        created.push(post);
      }

      res.json({ success: true, imported: created.length });
    } catch (err: any) {
      console.error('Excel import error:', err);
      res.status(500).json({ error: err?.message || 'Failed to import Excel file' });
    }
  });

  // ─── Blog Schedule API ───────────────────────────────────────────────────────
  app.get("/api/admin/blog/schedule", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const schedule = await storage.getBlogSchedule(req.tenantId);
      res.json(schedule || null);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch schedule' });
    }
  });

  app.post("/api/admin/blog/schedule", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { dailyLimit, weekdays, mode, isEnabled } = req.body;
      const schedule = await storage.upsertBlogSchedule(req.tenantId, {
        dailyLimit: dailyLimit ?? 1,
        weekdays: weekdays ?? ['1','2','3','4','5'],
        mode: mode ?? 'onay',
        isEnabled: isEnabled ?? false,
      });
      res.json(schedule);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save schedule' });
    }
  });

  // ─── Site Versions API ───────────────────────────────────────────────────────
  // List versions for a tenant (admin panel uses ?_tid= override)
  app.get("/api/admin/sites/:tenantId/versions", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const versions = await storage.getSiteVersions(req.tenantId);
      res.json(versions.map(v => ({ id: v.id, label: v.label, createdAt: v.createdAt })));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch versions' });
    }
  });

  // Create manual snapshot
  app.post("/api/admin/sites/:tenantId/versions", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const label = req.body?.label || `Manual — ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
      const snapshot = await captureSnapshot(req.tenantId);
      const version = await storage.createSiteVersion({ tenantId: req.tenantId, label, snapshotData: snapshot });
      await storage.pruneOldVersions(req.tenantId, 10);
      res.status(201).json({ id: version.id, label: version.label, createdAt: version.createdAt });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create version' });
    }
  });

  // Restore a version
  app.post("/api/admin/sites/:tenantId/versions/:versionId/restore", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const version = await storage.getSiteVersion(req.params.versionId as string);
      if (!version || version.tenantId !== req.tenantId) return res.status(404).json({ error: 'Version not found' });
      await restoreSnapshot(req.tenantId, version.snapshotData);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to restore version' });
    }
  });

  // Delete a version
  app.delete("/api/admin/sites/:tenantId/versions/:versionId", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const version = await storage.getSiteVersion(req.params.versionId as string);
      if (!version || version.tenantId !== req.tenantId) return res.status(404).json({ error: 'Version not found' });
      await storage.deleteSiteVersion(req.params.versionId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete version' });
    }
  });

  // ─── ZIP Export (async job-based) ────────────────────────────────────────────
  // Start export job — returns immediately with { jobId }
  app.post("/api/admin/sites/:tenantId/export-zip", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const job = startExportJob(req.tenantId);
      res.json({ jobId: job.id });
    } catch (err: any) {
      console.error('ZIP export start error:', err);
      res.status(500).json({ error: err?.message || 'Failed to start export' });
    }
  });

  // Poll export job status
  app.get("/api/admin/sites/:tenantId/export-zip/:jobId", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const job = getExportJob(req.params.jobId as string);
      if (!job || job.tenantId !== req.tenantId) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (job.status === 'ready') {
        return res.json({ status: 'ready', downloadUrl: job.downloadUrl });
      }
      if (job.status === 'error') {
        return res.json({ status: 'error', error: job.error });
      }
      return res.json({ status: 'pending' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get job status' });
    }
  });

  // Get version preview (snapshot summary)
  app.get("/api/admin/sites/:tenantId/versions/:versionId/preview", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const version = await storage.getSiteVersion(req.params.versionId as string);
      if (!version || version.tenantId !== req.tenantId) return res.status(404).json({ error: 'Version not found' });
      const snap = version.snapshotData as any;
      res.json({
        id: version.id,
        label: version.label,
        createdAt: version.createdAt,
        summary: {
          universityName: snap.tenant?.universityName || '—',
          domain: snap.tenant?.domain || '—',
          sections: (snap.sections || []).filter((s: any) => s.isEnabled).map((s: any) => s.sectionKey),
          faqCount: (snap.faqItems || []).length,
          testimonialCount: (snap.testimonials || []).length,
          capturedAt: snap.capturedAt,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get version preview' });
    }
  });

  // ─── Caddy on-demand TLS domain verification ─────────────────────────────────
  // Called by Caddy's `on_demand_tls ask` before issuing a certificate.
  // Returns 200 for domains registered in tenant_domains, 403 otherwise.
  // This prevents certificate issuance for unknown/rogue domains.
  app.get("/api/internal/verify-domain", async (req, res) => {
    try {
      const domain = typeof req.query.domain === 'string' ? req.query.domain.trim().toLowerCase() : '';
      if (!domain) return res.status(400).send('domain parameter required');

      const tenant = await storage.getTenantByHostDomain(domain);
      if (tenant) {
        return res.status(200).send('OK');
      }
      return res.status(403).send('Forbidden');
    } catch (err) {
      console.error('verify-domain error:', err);
      return res.status(500).send('Internal Server Error');
    }
  });

  // ─── Start blog scheduler ────────────────────────────────────────────────────
  startBlogScheduler();

  return httpServer;
}
