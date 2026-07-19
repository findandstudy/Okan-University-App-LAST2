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

// ─── Translate-everything job store (DB-backed, survives restarts) ───────────
// Jobs are persisted in the translate_jobs table via storage.createTranslateJob /
// storage.updateTranslateJob / storage.getTranslateJob.
// Prune old rows once per hour.
setInterval(() => { storage.pruneOldTranslateJobs().catch(() => {}); }, 60 * 60 * 1000);
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

  // Public read endpoints: 120 req/min per IP; admin sessions are exempt.
  // Session middleware runs globally before routes, so req.session is available.
  const publicReadRateLimit = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !!req.session?.adminId,
    message: { error: "Too many requests. Please slow down and try again." },
  });

  // Images: higher limit (240/min) because a single page load fetches many images.
  const publicImgRateLimit = rateLimit({
    windowMs: 60_000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !!req.session?.adminId,
    message: { error: "Too many image requests. Please slow down." },
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
  app.get("/objects/{*objectPath}", async (req, res) => {
    const pathParam = Array.isArray(req.params.objectPath)
      ? req.params.objectPath.join('/')
      : req.params.objectPath;
    if (!pathParam) return res.status(400).json({ error: 'Invalid path' });
    // Export ZIPs stored under uploads/exports/ — admin-only
    if (pathParam.startsWith('exports/')) {
      if (!(req.session as any)?.adminId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const fs = require('fs') as typeof import('fs');
      const nodePath = require('path') as typeof import('path');
      const { getUploadsDir } = require('./localFileStorage') as typeof import('./localFileStorage');
      const fname = pathParam.slice('exports/'.length);
      if (!fname || fname.includes('..') || fname.includes('/')) return res.status(400).json({ error: 'Invalid path' });
      // Verify the file was legitimately created (job must exist in DB)
      const job = await storage.getExportJobByFilename(fname);
      if (!job) return res.status(404).json({ error: 'Export not found' });
      const fullPath = nodePath.join(getUploadsDir(), 'exports', fname);
      if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${fname}"`);
      return fs.createReadStream(fullPath).pipe(res);
    }
    serveUpload(`/objects/${pathParam}`, res);
  });

  // ─── Optimized image endpoint ───────────────────────────────────────────────
  app.get("/api/img/:id", publicImgRateLimit, resolveTenant, async (req, res) => {
    try {
      const id = req.params.id as string;
      const width = parseInt(req.query.w as string) || 160;
      const height = req.query.h ? parseInt(req.query.h as string) : undefined;
      const format = (req.query.fmt as string) || 'webp';
      const quality = parseInt(req.query.q as string) || 75;

      // Authorization runs BEFORE the cache check so that a superadmin
      // warming the cache for a cross-tenant image cannot make it visible
      // to subsequent non-admin requests from the same tenant context.
      let isSuperAdmin = false;
      if (req.session?.adminId) {
        const admin = await storage.getAdminById(req.session.adminId as string);
        isSuperAdmin = admin?.role === 'super_admin';
      }
      if (!isSuperAdmin) {
        const belongs = await storage.doesImageBelongToTenant(id, req.tenantId as string);
        if (!belongs) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      // Cache key is tenant-scoped to prevent cross-tenant cache key collisions
      const cacheKey = `${req.tenantId}_${id}_${width}_${height || 'auto'}_${format}_${quality}`;
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
  app.get("/api/bootstrap", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
  app.get("/api/tenant", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
    res.json(req.tenant);
  });

  app.patch("/api/tenant", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const newDomain: string | undefined = req.body.domain?.trim();

      // Domain uniqueness check — skip if domain unchanged or not provided
      if (newDomain) {
        const existing = await storage.getTenantByDomain(newDomain);
        if (existing && existing.id !== tenantId) {
          return res.status(409).json({ error: `Domain "${newDomain}" is already in use by another site.` });
        }
      }

      const updated = await storage.updateTenant(tenantId, req.body);
      if (!updated) return res.status(404).json({ error: "Tenant not found" });

      // Sync primary domain record when domain changes
      if (newDomain) {
        const domains = await storage.getTenantDomains(tenantId);
        const primaryDomain = domains.find(d => d.isPrimary);
        if (!primaryDomain) {
          await storage.createTenantDomain({ tenantId, domain: newDomain, isPrimary: true });
        } else if (primaryDomain.domain !== newDomain) {
          await storage.deleteTenantDomain(primaryDomain.id);
          await storage.createTenantDomain({ tenantId, domain: newDomain, isPrimary: true });
        }
      }

      bootstrapCache.delete(tenantId);
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
  app.get("/api/theme", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
  app.get("/api/sections", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
      const existing = await storage.getSection(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "Section not found" });
      const section = await storage.updateSection(req.params.id as string, req.tenantId, req.body);
      if (!section) return res.status(404).json({ error: "Section not found" });
      bootstrapCache.delete(req.tenantId);
      res.json(section);
    } catch (error) {
      res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.patch("/api/sections", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const updates = req.body.sections as Array<{ id: string; isEnabled?: boolean; displayOrder?: number }>;
      const result = await storage.updateSections(req.tenantId, updates);
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
  app.get("/api/media", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
  app.get("/api/testimonials", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
    try {
      res.json(await storage.getTestimonials(req.tenantId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  app.get("/api/testimonials/:id", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
  app.get("/api/faq", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
    try {
      res.json(await storage.getFaqItems(req.tenantId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch FAQ items" });
    }
  });

  app.get("/api/faq/:id", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
  app.get("/api/seo-settings", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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
      // Check domain availability before insert to give a clear error
      const existing = await storage.getTenantByDomain(domain);
      if (existing) return res.status(409).json({ error: `Domain "${domain}" is already in use by another site.` });
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
    } catch (err: any) {
      console.error('Create tenant error:', err);
      res.status(500).json({ error: err?.message || "Failed to create tenant" });
    }
  });

  // ─── Tenant bulk operations ──────────────────────────────────────────────────
  app.post("/api/admin/tenants/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
      const deletable = ids.filter(id => id !== 'default');
      await Promise.all(deletable.map(id => storage.deleteTenant(id)));
      res.json({ deleted: deletable.length });
    } catch {
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  });

  // ── Shared helper: upsert the primary domain record for a tenant ──────────────
  const syncPrimaryDomain = async (tenantId: string, domain: string): Promise<void> => {
    const domains = await storage.getTenantDomains(tenantId);
    const primaryDomain = domains.find(d => d.isPrimary);
    if (!primaryDomain) {
      await storage.createTenantDomain({ tenantId, domain, isPrimary: true });
    } else if (primaryDomain.domain !== domain) {
      await storage.deleteTenantDomain(primaryDomain.id);
      await storage.createTenantDomain({ tenantId, domain, isPrimary: true });
    }
  };

  app.post("/api/admin/tenants/bulk-status", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const { ids, status } = req.body as { ids: string[]; status: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
      if (!status) return res.status(400).json({ error: 'status required' });
      await Promise.all(ids.map(id => storage.updateTenant(id, { status })));
      // When publishing, ensure every tenant has its primary domain record (required for Caddy TLS)
      if (status === 'yayinda') {
        await Promise.all(ids.map(async (id) => {
          const t = await storage.getTenant(id);
          if (t?.domain) await syncPrimaryDomain(id, t.domain);
        }));
      }
      res.json({ updated: ids.length });
    } catch {
      res.status(500).json({ error: 'Bulk status update failed' });
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
        await syncPrimaryDomain(id, tenant.domain);
      }
      res.json(tenant);
    } catch {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // FAZ 3B: Domain health diagnostic endpoint (super_admin only, no DNS queries — DB state only)
  app.get("/api/admin/tenants/:id/domain-health", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const id = req.params.id as string;
      const tenant = await storage.getTenant(id);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      const domains = await storage.getTenantDomains(id);
      const primaryDomain = domains.find(d => d.isPrimary);
      const domainInTable = domains.find(d => d.domain === tenant.domain);
      const isPublished = tenant.status === 'yayinda';

      const diagnostics: Array<{ ok: boolean; message: string }> = [];

      if (!isPublished) {
        diagnostics.push({ ok: false, message: `Tenant durumu '${tenant.status}' — yayında değilse public istekler 404 döner` });
      } else {
        diagnostics.push({ ok: true, message: `Tenant yayında (status: ${tenant.status})` });
      }

      if (!tenant.domain) {
        diagnostics.push({ ok: false, message: 'tenant.domain boş — domain atanmamış' });
      } else if (!domainInTable) {
        diagnostics.push({ ok: false, message: `Domain '${tenant.domain}' tenant_domains tablosunda kayıtlı değil — Caddy sertifika veremez` });
      } else {
        diagnostics.push({ ok: true, message: `Domain '${tenant.domain}' tenant_domains tablosunda mevcut` });
      }

      if (!primaryDomain) {
        diagnostics.push({ ok: false, message: 'Birincil (primary) domain kaydı yok — Caddy hangi domain için TLS alacağını bilemez' });
      } else if (primaryDomain.domain !== tenant.domain) {
        diagnostics.push({ ok: false, message: `Birincil domain '${primaryDomain.domain}' ile tenant.domain '${tenant.domain}' uyuşmuyor` });
      } else {
        diagnostics.push({ ok: true, message: `Birincil domain kaydı doğru: '${primaryDomain.domain}'` });
      }

      // Simulate verify-domain logic (same logic as the actual endpoint, no HTTP call)
      const verifyDomainStatus = domainInTable ? 200 : 403;
      if (verifyDomainStatus === 403) {
        diagnostics.push({ ok: false, message: `verify-domain '${tenant.domain}' için 403 döndürür — Caddy on-demand TLS sertifika almayı reddeder` });
      } else {
        diagnostics.push({ ok: true, message: `verify-domain '${tenant.domain}' için 200 döndürür — Caddy sertifika alabilir` });
      }

      res.json({
        tenantId: id,
        universityName: tenant.universityName,
        status: tenant.status,
        isPublished,
        domain: tenant.domain,
        domainRecords: domains,
        primaryDomain: primaryDomain || null,
        domainInTenantDomains: !!domainInTable,
        domainConsistency: {
          isConsistent: !!primaryDomain && primaryDomain.domain === tenant.domain && !!domainInTable,
          description: primaryDomain
            ? primaryDomain.domain === tenant.domain
              ? `Eşleşiyor: tenant.domain = primaryDomain.domain = '${tenant.domain}'`
              : `Uyuşmazlık: tenant.domain='${tenant.domain}', primaryDomain.domain='${primaryDomain.domain}'`
            : 'Birincil domain kaydı yok',
        },
        verifyDomainSimulation: { domain: tenant.domain, expectedStatus: verifyDomainStatus, caddyWillAccept: verifyDomainStatus === 200 },
        diagnostics,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get domain health' });
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

  // FAZ 4A: Block inventory — cross-tenant section usage (super_admin only, read-only)
  app.get("/api/admin/blocks/inventory", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });

      // Fetch all tenants and all sections in two queries (no N+1)
      const [allTenants, allSections] = await Promise.all([
        storage.getAllTenants(),
        storage.getAllSections(),
      ]);

      const tenantMap = new Map(allTenants.map(t => [t.id, t]));

      const byKey: Record<string, {
        sectionKey: string;
        totalTenants: number;
        activeCount: number;
        inactiveCount: number;
        tenants: Array<{
          tenantId: string;
          universityName: string;
          domain: string;
          status: string;
          isEnabled: boolean;
          displayOrder: number;
          langsWithContent: string[];
        }>;
      }> = {};

      for (const section of allSections) {
        const tenant = tenantMap.get(section.tenantId);
        if (!tenant) continue;
        if (!byKey[section.sectionKey]) {
          byKey[section.sectionKey] = { sectionKey: section.sectionKey, totalTenants: 0, activeCount: 0, inactiveCount: 0, tenants: [] };
        }
        const entry = byKey[section.sectionKey];
        entry.totalTenants++;
        if (section.isEnabled) entry.activeCount++;
        else entry.inactiveCount++;

        // Detect languages that have at least one non-empty string field in contentByLang
        const cbl = (section.contentByLang as Record<string, Record<string, string>>) || {};
        const langsWithContent = Object.entries(cbl)
          .filter(([, content]) => content && typeof content === 'object' && Object.values(content).some(v => typeof v === 'string' && v.trim()))
          .map(([lang]) => lang);

        entry.tenants.push({
          tenantId: tenant.id,
          universityName: tenant.universityName,
          domain: tenant.domain,
          status: tenant.status,
          isEnabled: section.isEnabled ?? false,
          displayOrder: section.displayOrder ?? 0,
          langsWithContent,
        });
      }

      const inventory = Object.values(byKey).sort((a, b) => b.totalTenants - a.totalTenants);
      res.json({ inventory });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get block inventory' });
    }
  });

  app.post("/api/admin/tenants/:id/clone", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const admin = await storage.getAdminById(req.session.adminId!);
      if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });
      const { universityName, domain, languages } = req.body;
      if (!universityName || !domain) return res.status(400).json({ error: "universityName and domain are required" });

      // Check domain availability before insert to give a clear error
      const existingDomain = await storage.getTenantByDomain(domain);
      if (existingDomain) return res.status(409).json({ error: `Domain "${domain}" is already in use by another site.` });

      // Resolve source tenant (supports literal 'default' id)
      const srcTenant = await storage.getTenant(id);
      if (!srcTenant) return res.status(404).json({ error: "Source tenant not found" });

      const supportedLanguages = Array.isArray(languages) && languages.length > 0
        ? languages
        : (srcTenant.supportedLanguages || ['en']);

      const newTenant = await storage.createTenant({ universityName, domain, status: 'taslak', supportedLanguages });
      await storage.createTenantDomain({ tenantId: newTenant.id, domain, isPrimary: true });

      // ── Copy branding from source (logo, favicon, social links, video) ──
      const brandingPatch: Record<string, unknown> = {};
      if (srcTenant.logoUrl)       brandingPatch.logoUrl = srcTenant.logoUrl;
      if (srcTenant.faviconUrl)    brandingPatch.faviconUrl = srcTenant.faviconUrl;
      if (srcTenant.facebookUrl)   brandingPatch.facebookUrl = srcTenant.facebookUrl;
      if (srcTenant.instagramUrl)  brandingPatch.instagramUrl = srcTenant.instagramUrl;
      if (srcTenant.linkedinUrl)   brandingPatch.linkedinUrl = srcTenant.linkedinUrl;
      if (srcTenant.youtubeUrl)    brandingPatch.youtubeUrl = srcTenant.youtubeUrl;
      if (srcTenant.heroVideoUrl)  brandingPatch.heroVideoUrl = srcTenant.heroVideoUrl;
      if (Object.keys(brandingPatch).length > 0) {
        await storage.updateTenant(newTenant.id, brandingPatch);
      }

      // ── Clone sections (core — must succeed) ──
      const srcSections = await storage.getSections(id);
      for (const s of srcSections) {
        const { id: _id, tenantId: _tid, ...rest } = s as any;
        await storage.createSection({ ...rest, tenantId: newTenant.id });
      }

      // ── Clone FAQ items ──
      const srcFaq = await storage.getFaqItems(id);
      for (const f of srcFaq) {
        const { id: _id, tenantId: _tid, ...rest } = f as any;
        await storage.createFaqItem({ ...rest, tenantId: newTenant.id });
      }

      // ── Clone testimonials ──
      const srcTestimonials = await storage.getTestimonials(id);
      for (const t of srcTestimonials) {
        const { id: _id, tenantId: _tid, ...rest } = t as any;
        await storage.createTestimonial({ ...rest, tenantId: newTenant.id });
      }

      // ── Clone theme (optional — skip if table missing on older installs) ──
      try {
        const srcTheme = await storage.getTheme(id);
        if (srcTheme) {
          const { id: _id, tenantId: _tid, ...rest } = srcTheme as any;
          await storage.createTheme({ ...rest, tenantId: newTenant.id });
        }
      } catch (e) { console.warn('Clone: skipping theme —', (e as any)?.message); }

      // ── Clone SEO settings (optional) ──
      try {
        const srcSeo = await storage.getSeoSettings(id);
        if (srcSeo) {
          const { id: _id, tenantId: _tid, ...rest } = srcSeo as any;
          await storage.createSeoSettings({ ...rest, tenantId: newTenant.id });
        }
      } catch (e) { console.warn('Clone: skipping SEO —', (e as any)?.message); }

      // ── Clone widgets (optional — table may not exist on older installs) ──
      try {
        const srcWidgets = await storage.getWidgets(id);
        for (const w of srcWidgets) {
          const { id: _id, tenantId: _tid, ...rest } = w as any;
          await storage.createWidget({ ...rest, tenantId: newTenant.id });
        }
      } catch (e) { console.warn('Clone: skipping widgets —', (e as any)?.message); }

      res.json(newTenant);
    } catch (error: any) {
      console.error('Clone error:', error);
      res.status(500).json({ error: error?.message || "Failed to clone tenant" });
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
  app.get("/api/widgets", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
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

  // ─── Master: Translate Everything ────────────────────────────────────────────
  // ─── Translate-everything job status polling ──────────────────────────────
  app.get("/api/admin/ai/translate-job/:id", requireAdmin, async (req, res) => {
    const job = await storage.getTranslateJob(req.params.id as string);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({
      status: job.status,
      step: job.step,
      steps: job.steps,
      failedFields: job.failedFields,
      error: job.error,
    });
  });

  app.post("/api/admin/ai/translate-everything", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const { enName } = req.body;
    const tenantId = req.tenantId;

    // Create persistent DB record — survives process restarts
    const jobRow = await storage.createTranslateJob(tenantId);
    const jobId = jobRow.id;

    // Local state tracked during the background run
    let step = 'Starting…';
    const steps: string[] = [];
    const failedFields: string[] = [];

    // Persist current state to DB and clear bootstrap cache so landing page reflects changes immediately
    const save = async (overrides: { status?: string; error?: string; completedAt?: Date } = {}) => {
      await storage.updateTranslateJob(jobId, { step, steps, failedFields, ...overrides });
      bootstrapCache.delete(tenantId);
    };

    // Respond immediately so the HTTP connection is freed
    res.json({ jobId });

    // ── Background processing ─────────────────────────────────────────────
    (async () => {
      try {
        const TARGET_LANGS = ['ar','tr','fr','ru','fa','zh','hi','es','id'];
        const { translateText, translateContentByLang } = await import('./aiTranslation');
        const stepErr = (label: string, err: any) => console.error(`[translate-everything] step "${label}" failed:`, err?.message);

        // Helper: push failed field:lang pairs into failedFields
        const pushFailed = (label: string, langs: string[]) => {
          failedFields.push(...langs.map(l => `${label}:${l}`));
        };
        // Helper: check translateText result and push missing langs as failures
        const checkTextFailures = (label: string, result: Record<string, string>) => {
          const missing = TARGET_LANGS.filter(l => !result[l]);
          if (missing.length) pushFailed(label, missing);
        };

        // 1. University name
        try {
          if (enName) {
            step = 'Translating university name…'; await save();
            const existingTenant = await storage.getTenant(tenantId);
            const existingNameByLang = (existingTenant?.nameByLang as Record<string, string>) || {};
            const nameTranslations = await translateText(enName, 'en', TARGET_LANGS, tenantId);
            checkTextFailures('university_name', nameTranslations);
            const mergedNameByLang: Record<string, string> = { ...existingNameByLang, en: enName };
            for (const lang of TARGET_LANGS) {
              if (nameTranslations[lang]) mergedNameByLang[lang] = nameTranslations[lang];
            }
            await storage.updateTenant(tenantId, { universityName: enName, nameByLang: mergedNameByLang });
            steps.push('university_name'); await save();
          }
        } catch (e) { stepErr('university_name', e); }

        // 2. Sections (contentByLang)
        let sections: any[] = [];
        try {
          step = 'Translating sections…'; await save();
          sections = await storage.getSections(tenantId);
          let sectionsCount = 0;
          for (const section of sections) {
            try {
              const enContent = (section.contentByLang as any)?.['en'];
              if (!enContent) continue;
              const sourceContent: Record<string, string> = {};
              for (const [field, val] of Object.entries(enContent)) {
                if (typeof val === 'string' && val.trim()) sourceContent[field] = val;
              }
              if (Object.keys(sourceContent).length === 0) continue;
              const translated = await translateContentByLang(sourceContent, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`section_${section.sectionKey}_${field}`, langs));
              const existingCBL = (section.contentByLang as Record<string, Record<string, string>>) || {};
              const newCBL: Record<string, Record<string, string>> = { ...existingCBL, en: enContent };
              for (const [lang, content] of Object.entries(translated)) {
                newCBL[lang] = { ...(existingCBL[lang] || {}), ...content };
              }
              await storage.updateSection(section.id, tenantId, { contentByLang: newCBL });
              sectionsCount++;
            } catch (e) { stepErr(`section:${section.id}`, e); }
          }
          steps.push(`sections:${sectionsCount}`); await save();
        } catch (e) { stepErr('sections', e); }

        // 3. FAQ
        try {
          step = 'Translating FAQ…'; await save();
          const faqItems = await storage.getFaqItems(tenantId);
          let faqCount = 0;
          for (const item of faqItems) {
            try {
              const enQ = (item.questionByLang as any)?.en;
              const enA = (item.answerByLang as any)?.en;
              const source: Record<string, string> = {};
              if (enQ?.trim()) source.question = enQ;
              if (enA?.trim()) source.answer = enA;
              if (Object.keys(source).length === 0) continue;
              const result = await translateContentByLang(source, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`faq_${item.id}_${field}`, langs));
              const newQ: Record<string, string> = { ...((item.questionByLang as any) || {}) };
              const newA: Record<string, string> = { ...((item.answerByLang as any) || {}) };
              for (const [lang, content] of Object.entries(result)) {
                if ((content as any).question) newQ[lang] = (content as any).question;
                if ((content as any).answer) newA[lang] = (content as any).answer;
              }
              await storage.updateFaqItem(item.id, { questionByLang: newQ as any, answerByLang: newA as any });
              faqCount++;
            } catch (e) { stepErr(`faq:${item.id}`, e); }
          }
          steps.push(`faq:${faqCount}`); await save();
        } catch (e) { stepErr('faq', e); }

        // 4. Testimonials
        try {
          step = 'Translating testimonials…'; await save();
          const testimonials = await storage.getTestimonials(tenantId);
          let testimonialCount = 0;
          for (const t of testimonials) {
            try {
              const enContent = (t.contentByLang as any)?.en;
              if (!enContent?.trim()) continue;
              const result = await translateText(enContent, 'en', TARGET_LANGS, tenantId);
              checkTextFailures(`testimonial_${t.id}`, result);
              await storage.updateTestimonial(t.id, { contentByLang: { ...((t.contentByLang as any) || {}), ...result } as any });
              testimonialCount++;
            } catch (e) { stepErr(`testimonial:${t.id}`, e); }
          }
          steps.push(`testimonials:${testimonialCount}`); await save();
        } catch (e) { stepErr('testimonials', e); }

        // 5. SEO meta tags
        try {
          step = 'Translating SEO metadata…'; await save();
          const seoRow = await storage.getSeoSettings(tenantId);
          if (seoRow) {
            const metaTitleByLang = (seoRow.metaTitleByLang || {}) as Record<string, string>;
            const metaDescByLang = (seoRow.metaDescriptionByLang || {}) as Record<string, string>;
            const metaKwByLang = (seoRow.metaKeywordsByLang || {}) as Record<string, string>;
            const enTitle = metaTitleByLang.en || '';
            const enDesc = metaDescByLang.en || '';
            const enKw = metaKwByLang.en || '';
            const seoSource: Record<string, string> = {};
            if (enTitle.trim()) seoSource.metaTitle = enTitle;
            if (enDesc.trim()) seoSource.metaDescription = enDesc;
            if (enKw.trim()) seoSource.keywords = enKw;
            if (Object.keys(seoSource).length > 0) {
              const translated = await translateContentByLang(seoSource, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`seo_${field}`, langs));
              const newTitle = { ...metaTitleByLang };
              const newDesc = { ...metaDescByLang };
              const newKw = { ...metaKwByLang };
              for (const [lang, content] of Object.entries(translated)) {
                const c = content as Record<string, string>;
                if (c.metaTitle) newTitle[lang] = c.metaTitle;
                if (c.metaDescription) newDesc[lang] = c.metaDescription;
                if (c.keywords) newKw[lang] = c.keywords;
              }
              await storage.updateSeoSettings(tenantId, { metaTitleByLang: newTitle, metaDescriptionByLang: newDesc, metaKeywordsByLang: newKw } as any);
              steps.push('seo'); await save();
            }
          }
        } catch (e) { stepErr('seo', e); }

        // 6. Footer section
        try {
          step = 'Translating footer…'; await save();
          const footerSection = sections.find((s: any) => s.sectionKey === 'footer');
          if (footerSection?.settings) {
            const fs = footerSection.settings as Record<string, any>;
            const enDesc = (typeof fs.description === 'object' ? fs.description?.en : fs.description) || '';
            const enContactTitle = (typeof fs.contactTitle === 'object' ? fs.contactTitle?.en : fs.contactTitle) || '';
            const enContactAddress = (typeof fs.contactAddress === 'object' ? fs.contactAddress?.en : fs.contactAddress) || '';
            const sourceFooter: Record<string, string> = {};
            if (enDesc.trim()) sourceFooter.description = enDesc;
            if (enContactTitle.trim()) sourceFooter.contactTitle = enContactTitle;
            if (enContactAddress.trim()) sourceFooter.contactAddress = enContactAddress;
            if (Object.keys(sourceFooter).length > 0) {
              const translated = await translateContentByLang(sourceFooter, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`footer_${field}`, langs));
              const newSettings = { ...fs };
              newSettings.description = typeof fs.description === 'object' ? { ...fs.description } : { en: enDesc };
              newSettings.contactTitle = typeof fs.contactTitle === 'object' ? { ...fs.contactTitle } : { en: enContactTitle };
              newSettings.contactAddress = typeof fs.contactAddress === 'object' ? { ...fs.contactAddress } : { en: enContactAddress };
              for (const [lang, content] of Object.entries(translated)) {
                const c = content as Record<string, string>;
                if (c.description) newSettings.description[lang] = c.description;
                if (c.contactTitle) newSettings.contactTitle[lang] = c.contactTitle;
                if (c.contactAddress) newSettings.contactAddress[lang] = c.contactAddress;
              }
              await storage.updateSection(footerSection.id, tenantId, { settings: newSettings });
              steps.push('footer'); await save();
            }
          }
        } catch (e) { stepErr('footer', e); }

        // 7. Contact section
        try {
          step = 'Translating contact section…'; await save();
          const contactSection = sections.find((s: any) => s.sectionKey === 'contact');
          if (contactSection?.settings) {
            const cs = contactSection.settings as Record<string, any>;
            const enTitle = (typeof cs.sectionTitle === 'object' ? cs.sectionTitle?.en : cs.sectionTitle) || '';
            const enSubtitle = (typeof cs.sectionSubtitle === 'object' ? cs.sectionSubtitle?.en : cs.sectionSubtitle) || '';
            const items: Array<{ icon: string; label: any; value: string }> = cs.items || [];
            const sourceContact: Record<string, string> = {};
            if (enTitle.trim()) sourceContact.sectionTitle = enTitle;
            if (enSubtitle.trim()) sourceContact.sectionSubtitle = enSubtitle;
            for (let i = 0; i < items.length; i++) {
              const rawLabel = items[i]?.label;
              const enLabel = (typeof rawLabel === 'object' ? rawLabel?.en : rawLabel) || '';
              if (enLabel.trim()) sourceContact[`item_${i}_label`] = enLabel;
            }
            if (Object.keys(sourceContact).length > 0) {
              const translated = await translateContentByLang(sourceContact, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`contact_${field}`, langs));
              const newSettings = { ...cs };
              newSettings.sectionTitle = typeof cs.sectionTitle === 'object' ? { ...cs.sectionTitle } : { en: enTitle };
              newSettings.sectionSubtitle = typeof cs.sectionSubtitle === 'object' ? { ...cs.sectionSubtitle } : { en: enSubtitle };
              const newItems = [...items].map(it => ({
                ...it,
                label: typeof it.label === 'object' ? { ...it.label } : { en: it.label || '' },
              }));
              for (const [lang, content] of Object.entries(translated)) {
                const c = content as Record<string, string>;
                if (c.sectionTitle) newSettings.sectionTitle[lang] = c.sectionTitle;
                if (c.sectionSubtitle) newSettings.sectionSubtitle[lang] = c.sectionSubtitle;
                for (let i = 0; i < newItems.length; i++) {
                  if (c[`item_${i}_label`]) newItems[i].label[lang] = c[`item_${i}_label`];
                }
              }
              newSettings.items = newItems;
              await storage.updateSection(contactSection.id, tenantId, { settings: newSettings });
              steps.push('contact'); await save();
            }
          }
        } catch (e) { stepErr('contact', e); }

        // 8. Trust badges section (settings.badges array inside section)
        try {
          step = 'Translating trust badges section…'; await save();
          const trustSection = sections.find((s: any) => s.sectionKey === 'trust_badges');
          if (trustSection?.settings) {
            const ts = trustSection.settings as Record<string, any>;
            const badges: Array<{ icon: string; title: Record<string, string>; description: Record<string, string> }> = ts.badges || [];
            const sourceTrust: Record<string, string> = {};
            if (ts.sectionTitle?.en?.trim()) sourceTrust.sectionTitle = ts.sectionTitle.en;
            if (ts.sectionSubtitle?.en?.trim()) sourceTrust.sectionSubtitle = ts.sectionSubtitle.en;
            for (let i = 0; i < badges.length; i++) {
              if (badges[i]?.title?.en?.trim()) sourceTrust[`badge_${i}_title`] = badges[i].title.en;
              if (badges[i]?.description?.en?.trim()) sourceTrust[`badge_${i}_description`] = badges[i].description.en;
            }
            if (Object.keys(sourceTrust).length > 0) {
              const translated = await translateContentByLang(sourceTrust, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`trust_section_${field}`, langs));
              const newSettings = { ...ts };
              const newBadges = badges.map(b => ({ ...b, title: { ...b.title }, description: { ...b.description } }));
              for (const [lang, content] of Object.entries(translated)) {
                const c = content as Record<string, string>;
                if (c.sectionTitle) newSettings.sectionTitle = { ...newSettings.sectionTitle, [lang]: c.sectionTitle };
                if (c.sectionSubtitle) newSettings.sectionSubtitle = { ...newSettings.sectionSubtitle, [lang]: c.sectionSubtitle };
                for (let i = 0; i < newBadges.length; i++) {
                  if (c[`badge_${i}_title`]) newBadges[i].title[lang] = c[`badge_${i}_title`];
                  if (c[`badge_${i}_description`]) newBadges[i].description[lang] = c[`badge_${i}_description`];
                }
              }
              newSettings.badges = newBadges;
              await storage.updateSection(trustSection.id, tenantId, { settings: newSettings });
              steps.push('trust_badges_section'); await save();
            }
          }
        } catch (e) { stepErr('trust_badges_section', e); }

        // 9. Hero section
        try {
          step = 'Translating hero section…'; await save();
          const heroSection = sections.find((s: any) => s.sectionKey === 'hero');
          if (heroSection?.settings) {
            const hs = heroSection.settings as Record<string, any>;
            const sourceHero: Record<string, string> = {};
            if (hs.badge?.en?.trim()) sourceHero.badge = hs.badge.en;
            if (hs.title?.en?.trim()) sourceHero.title = hs.title.en;
            if (hs.subtitle?.en?.trim()) sourceHero.subtitle = hs.subtitle.en;
            if (hs.stats?.stat1Label?.en?.trim()) sourceHero.stat1Label = hs.stats.stat1Label.en;
            if (hs.stats?.stat1Sublabel?.en?.trim()) sourceHero.stat1Sublabel = hs.stats.stat1Sublabel.en;
            if (hs.stats?.stat2Label?.en?.trim()) sourceHero.stat2Label = hs.stats.stat2Label.en;
            if (hs.stats?.stat2Sublabel?.en?.trim()) sourceHero.stat2Sublabel = hs.stats.stat2Sublabel.en;
            const enFeatures: string[] = hs.features?.en || [];
            for (let i = 0; i < enFeatures.length; i++) {
              if (enFeatures[i]?.trim()) sourceHero[`feature_${i}`] = enFeatures[i];
            }
            if (Object.keys(sourceHero).length > 0) {
              const translated = await translateContentByLang(sourceHero, 'en', TARGET_LANGS, tenantId,
                (field, langs) => pushFailed(`hero_${field}`, langs));
              const newSettings = { ...hs };
              newSettings.badge = { ...hs.badge };
              newSettings.title = { ...hs.title };
              newSettings.subtitle = { ...hs.subtitle };
              newSettings.stats = {
                ...hs.stats,
                stat1Label: { ...(hs.stats?.stat1Label || {}) },
                stat1Sublabel: { ...(hs.stats?.stat1Sublabel || {}) },
                stat2Label: { ...(hs.stats?.stat2Label || {}) },
                stat2Sublabel: { ...(hs.stats?.stat2Sublabel || {}) },
              };
              const newFeatures: Record<string, string[]> = { ...(hs.features || {}) };
              for (const [lang, content] of Object.entries(translated)) {
                const c = content as Record<string, string>;
                if (c.badge) newSettings.badge[lang] = c.badge;
                if (c.title) newSettings.title[lang] = c.title;
                if (c.subtitle) newSettings.subtitle[lang] = c.subtitle;
                if (c.stat1Label) newSettings.stats.stat1Label[lang] = c.stat1Label;
                if (c.stat1Sublabel) newSettings.stats.stat1Sublabel[lang] = c.stat1Sublabel;
                if (c.stat2Label) newSettings.stats.stat2Label[lang] = c.stat2Label;
                if (c.stat2Sublabel) newSettings.stats.stat2Sublabel[lang] = c.stat2Sublabel;
                if (enFeatures.length > 0) {
                  const langFeatures: string[] = [];
                  for (let i = 0; i < enFeatures.length; i++) {
                    langFeatures.push(c[`feature_${i}`] || enFeatures[i]);
                  }
                  newFeatures[lang] = langFeatures;
                }
              }
              newSettings.features = newFeatures;
              await storage.updateSection(heroSection.id, tenantId, { settings: newSettings });
              steps.push('hero'); await save();
            }
          }
        } catch (e) { stepErr('hero', e); }

        // 10. Trust badges TABLE (titleByLang — standalone table rows)
        try {
          step = 'Translating trust badge records…'; await save();
          const tbItems = await storage.getTrustBadgesByTenant(tenantId);
          let tbCount = 0;
          for (const badge of tbItems) {
            try {
              const enTitle = (badge.titleByLang as any)?.en;
              if (!enTitle?.trim()) continue;
              const result = await translateText(enTitle, 'en', TARGET_LANGS, tenantId);
              checkTextFailures(`trust_badge_${badge.id}_title`, result);
              await storage.updateTrustBadge(badge.id, {
                titleByLang: { ...((badge.titleByLang as any) || {}), en: enTitle, ...result } as any,
              });
              tbCount++;
            } catch (e) { stepErr(`trust_badge:${badge.id}`, e); }
          }
          if (tbCount > 0) { steps.push(`trust_badges_table:${tbCount}`); await save(); }
        } catch (e) { stepErr('trust_badges_table', e); }

        // 11. Menu items TABLE (labelByLang — standalone table rows)
        try {
          step = 'Translating menu items…'; await save();
          const mItems = await storage.getMenuItemsByTenant(tenantId);
          let miCount = 0;
          for (const item of mItems) {
            try {
              const enLabel = (item.labelByLang as any)?.en;
              if (!enLabel?.trim()) continue;
              const result = await translateText(enLabel, 'en', TARGET_LANGS, tenantId);
              checkTextFailures(`menu_item_${item.id}_label`, result);
              await storage.updateMenuItem(item.id, {
                labelByLang: { ...((item.labelByLang as any) || {}), en: enLabel, ...result } as any,
              });
              miCount++;
            } catch (e) { stepErr(`menu_item:${item.id}`, e); }
          }
          if (miCount > 0) { steps.push(`menu_items:${miCount}`); await save(); }
        } catch (e) { stepErr('menu_items', e); }

        step = `Complete — ${failedFields.length ? `${failedFields.length} field(s) failed` : 'all translations successful'}`;
        await save({ status: 'done', completedAt: new Date() });
      } catch (err: any) {
        console.error('[translate-everything] job error:', err?.message);
        step = 'Error';
        await save({ status: 'error', error: err?.message || 'Translation failed', completedAt: new Date() });
      }
    })();
  });

  app.post("/api/admin/ai/translate-all-sections", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { targetLangs } = req.body;
      if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
        return res.status(400).json({ error: "targetLangs array is required" });
      }
      const { translateContentByLang } = await import('./aiTranslation');

      const sections = await storage.getSections(req.tenantId);
      const results: Array<{ id: string; sectionKey: string; translated: Record<string, Record<string, string>> }> = [];

      for (const section of sections) {
        const enContent = (section.contentByLang as any)?.['en'];
        if (!enContent) continue;

        // Only translate non-empty fields
        const sourceContent: Record<string, string> = {};
        for (const [field, val] of Object.entries(enContent)) {
          if (typeof val === 'string' && val.trim()) {
            sourceContent[field] = val;
          }
        }
        if (Object.keys(sourceContent).length === 0) continue;

        const translated = await translateContentByLang(sourceContent, 'en', targetLangs, req.tenantId);

        // Merge translations into existing contentByLang
        const existingCBL = (section.contentByLang as Record<string, Record<string, string>>) || {};
        const newCBL: Record<string, Record<string, string>> = { ...existingCBL, en: enContent };
        for (const [lang, content] of Object.entries(translated)) {
          newCBL[lang] = { ...(existingCBL[lang] || {}), ...content };
        }

        await storage.updateSection(section.id, req.tenantId, { contentByLang: newCBL });
        results.push({ id: section.id, sectionKey: section.sectionKey, translated });
      }

      bootstrapCache.delete(req.tenantId);
      res.json({ ok: true, sectionsTranslated: results.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Translation failed" });
    }
  });

  app.post("/api/admin/ai/translate-university-name", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { enName, targetLangs } = req.body;
      if (!enName) return res.status(400).json({ error: "enName is required" });
      if (!Array.isArray(targetLangs) || targetLangs.length === 0) return res.status(400).json({ error: "targetLangs is required" });
      const { translateText } = await import('./aiTranslation');
      const translations = await translateText(enName, 'en', targetLangs, req.tenantId);
      res.json({ ok: true, translations });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Translation failed" });
    }
  });

  app.post("/api/admin/ai/translate-all-faq", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { targetLangs } = req.body;
      if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
        return res.status(400).json({ error: "targetLangs array is required" });
      }
      const { translateContentByLang } = await import('./aiTranslation');
      const faqItems = await storage.getFaqItems(req.tenantId);
      let translated = 0;
      for (const item of faqItems) {
        const enQ = (item.questionByLang as any)?.en;
        const enA = (item.answerByLang as any)?.en;
        const source: Record<string, string> = {};
        if (enQ?.trim()) source.question = enQ;
        if (enA?.trim()) source.answer = enA;
        if (Object.keys(source).length === 0) continue;
        const result = await translateContentByLang(source, 'en', targetLangs, req.tenantId);
        const existingQ = (item.questionByLang as Record<string, string>) || {};
        const existingA = (item.answerByLang as Record<string, string>) || {};
        const newQ: Record<string, string> = { ...existingQ };
        const newA: Record<string, string> = { ...existingA };
        for (const [lang, content] of Object.entries(result)) {
          if ((content as any).question) newQ[lang] = (content as any).question;
          if ((content as any).answer) newA[lang] = (content as any).answer;
        }
        await storage.updateFaqItem(item.id, { questionByLang: newQ as any, answerByLang: newA as any });
        translated++;
      }
      bootstrapCache.delete(req.tenantId);
      res.json({ ok: true, itemsTranslated: translated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Translation failed" });
    }
  });

  app.post("/api/admin/ai/translate-all-testimonials", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { targetLangs } = req.body;
      if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
        return res.status(400).json({ error: "targetLangs array is required" });
      }
      const { translateText } = await import('./aiTranslation');
      const testimonials = await storage.getTestimonials(req.tenantId);
      let translated = 0;
      for (const t of testimonials) {
        const enContent = (t.contentByLang as any)?.en;
        if (!enContent?.trim()) continue;
        const result = await translateText(enContent, 'en', targetLangs, req.tenantId);
        const existing = (t.contentByLang as Record<string, string>) || {};
        const newCBL: Record<string, string> = { ...existing, ...result };
        await storage.updateTestimonial(t.id, { contentByLang: newCBL as any });
        translated++;
      }
      bootstrapCache.delete(req.tenantId);
      res.json({ ok: true, itemsTranslated: translated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Translation failed" });
    }
  });

  app.post("/api/admin/ai/generate-content", requireAdmin, resolveTenant, requireAdminTenantAccess, upload.single('file'), async (req, res) => {
    try {
      const { url, text } = req.body;
      const file = req.file;
      const parts: string[] = [];

      const { extractTextFromUrl, extractTextFromPdf, extractTextFromDocx, generateContent } = await import('./contentGenerator');

      // Collect text from every provided source (any combination is valid)
      if (url) {
        const urlText = await extractTextFromUrl(url);
        if (urlText.trim()) parts.push(`[Source: URL]\n${urlText}`);
      }
      if (file) {
        const ext = file.originalname?.toLowerCase();
        if (ext?.endsWith('.pdf')) {
          const pdfText = await extractTextFromPdf(file.buffer);
          if (pdfText.trim()) parts.push(`[Source: PDF]\n${pdfText}`);
        } else if (ext?.endsWith('.docx')) {
          const docxText = await extractTextFromDocx(file.buffer);
          if (docxText.trim()) parts.push(`[Source: Document]\n${docxText}`);
        } else {
          return res.status(400).json({ error: "Unsupported file type. Use PDF or DOCX." });
        }
      }
      if (text) {
        parts.push(`[Source: Text]\n${text}`);
      }
      if (parts.length === 0) {
        return res.status(400).json({ error: "Provide at least one source: url, file, or text" });
      }
      // Cap combined text at 10 000 chars
      const sourceText = parts.join('\n\n---\n\n').substring(0, 10000);

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

      // ── Hero section: write to settings.title/subtitle (what Hero component reads) ──
      // Hero component reads heroSection.settings.title[lang] / .subtitle[lang]
      const heroExistingSettings = (heroSection?.settings as Record<string, any>) || {};
      const heroNewSettings = {
        ...heroExistingSettings,
        title: { ...(heroExistingSettings.title || {}), en: hero?.title || '' },
        subtitle: { ...(heroExistingSettings.subtitle || {}), en: hero?.subtitle || '' },
      };

      if (heroSection) {
        await storage.updateSection(heroSection.id, req.tenantId, { settings: heroNewSettings });
      } else {
        await storage.createSection({
          tenantId: req.tenantId,
          sectionKey: 'hero',
          displayOrder: 0,
          isEnabled: true,
          contentByLang: {},
          settings: heroNewSettings,
        });
      }

      // ── Footer section: write about.body → footer description ───────────────
      // 'about' sectionKey has no renderer in Landing.tsx; footer.settings.description IS displayed.
      if (about?.body) {
        const footerSection = existingSections.find(s => s.sectionKey === 'footer');
        const footerExistingSettings = (footerSection?.settings as Record<string, any>) || {};
        const footerNewSettings = {
          ...footerExistingSettings,
          description: { ...(footerExistingSettings.description || {}), en: about.body },
        };
        if (footerSection) {
          await storage.updateSection(footerSection.id, req.tenantId, { settings: footerNewSettings });
        } else {
          await storage.createSection({
            tenantId: req.tenantId,
            sectionKey: 'footer',
            displayOrder: 999,
            isEnabled: true,
            contentByLang: {},
            settings: footerNewSettings,
          });
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

      // Clear bootstrap cache so landing page gets fresh data immediately
      bootstrapCache.delete(req.tenantId);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to apply content" });
    }
  });

  // ─── AI Localize SEO ──────────────────────────────────────────────────────
  // ─── AI: Generate English SEO from existing site content ─────────────────────
  app.post("/api/admin/ai/generate-seo", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { callAI } = await import('./aiService');
      const tenantId = req.tenantId;

      // Gather existing site content
      const tenant = await storage.getTenant(tenantId);
      const sections = await storage.getSections(tenantId);
      const faqItems = await storage.getFaqItems(tenantId);

      const uniName = tenant?.universityName || '';

      // Pull EN content from sections
      const sectionSummaries: string[] = [];
      for (const s of sections) {
        const en = (s.contentByLang as any)?.en;
        if (!en) continue;
        const parts: string[] = [];
        if (en.title) parts.push(`Title: ${en.title}`);
        if (en.subtitle) parts.push(`Subtitle: ${en.subtitle}`);
        if (en.body) parts.push(`Body: ${String(en.body).slice(0, 300)}`);
        if (parts.length > 0) sectionSummaries.push(`[${s.sectionKey}] ${parts.join(' | ')}`);
      }

      // Pull sample FAQ questions
      const faqSample = faqItems
        .slice(0, 6)
        .map(f => (f.questionByLang as any)?.en)
        .filter(Boolean)
        .join('; ');

      const context = [
        `University: ${uniName}`,
        sectionSummaries.length > 0 ? `Site content:\n${sectionSummaries.join('\n')}` : '',
        faqSample ? `FAQ topics: ${faqSample}` : '',
      ].filter(Boolean).join('\n\n');

      if (!uniName && sectionSummaries.length === 0) {
        return res.status(400).json({ error: 'No site content found. Please add content to sections first.' });
      }

      const prompt = `You are an SEO expert. Based on the following university landing page content, generate optimized English SEO meta tags.

${context}

Return ONLY valid JSON with exactly this structure:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": "..."
}

Rules:
- metaTitle: max 60 characters, include university name, compelling
- metaDescription: max 160 characters, clear value proposition, include a call to action
- keywords: 8-12 comma-separated keywords relevant to the university and its programs
- Write only in English
- Do not include explanations, only the JSON`;

      const raw = await callAI(prompt, tenantId, 'You are an SEO expert. Return only valid JSON.');
      const match = raw.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('Invalid AI response');
      const result = JSON.parse(match[0]) as { metaTitle: string; metaDescription: string; keywords: string };
      bootstrapCache.delete(tenantId);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate SEO' });
    }
  });

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
      bootstrapCache.delete(req.tenantId);
      res.json({ localized });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to localize SEO content' });
    }
  });

  // ─── Public Blog API ──────────────────────────────────────────────────────────
  app.get("/api/blog", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
    try {
      const lang = (req.query.lang as string) || 'en';
      const posts = await storage.getPublishedBlogPosts(req.tenantId, lang);
      res.set('Cache-Control', 'no-store');
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch blog posts' });
    }
  });

  app.get("/api/blog/:slug", publicReadRateLimit, resolveTenant, requirePublished, async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const lang = (req.query.lang as string) || 'en';
      const isAdmin = !!req.session?.adminId;
      const result = await storage.getBlogPostTranslationBySlug(req.tenantId, lang, slug, isAdmin);
      if (!result) return res.status(404).json({ error: 'Post not found' });
      res.set('Cache-Control', 'no-store');

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

  // ─── Bulk operations ─────────────────────────────────────────────────────────
  app.post("/api/admin/blog/bulk-delete", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
      // Verify all posts belong to this tenant
      const posts = await Promise.all(ids.map(id => storage.getBlogPost(id)));
      const owned = posts.filter(p => p && p.tenantId === req.tenantId);
      await Promise.all(owned.map(p => storage.deleteBlogPost(p!.id)));
      res.json({ deleted: owned.length });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Bulk delete failed' });
    }
  });

  app.post("/api/admin/blog/bulk-status", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { ids, status } = req.body as { ids: string[]; status: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
      if (!status) return res.status(400).json({ error: 'status required' });
      const posts = await Promise.all(ids.map(id => storage.getBlogPost(id)));
      const owned = posts.filter(p => p && p.tenantId === req.tenantId);
      await Promise.all(owned.map(p => storage.updateBlogPost(p!.id, { status })));
      res.json({ updated: owned.length });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Bulk status update failed' });
    }
  });

  // ─── Suggest Blog Topics from source (URL / text / file) ────────────────────
  app.post("/api/admin/blog/suggest-topics", requireAdmin, resolveTenant, requireAdminTenantAccess, upload.single('file'), async (req, res) => {
    try {
      const { sourceType, url, text } = req.body as { sourceType?: string; url?: string; text?: string };
      const { callAI, getAIConfig } = await import('./aiService');
      const aiConfig = await getAIConfig(req.tenantId);
      if (!aiConfig) return res.status(400).json({ error: 'AI not configured. Add your OpenAI key in AI Settings.' });

      let sourceText = '';
      if (sourceType === 'url' && url) {
        const { extractTextFromUrl } = await import('./contentGenerator');
        sourceText = await extractTextFromUrl(url);
      } else if (sourceType === 'text' && text) {
        sourceText = text.trim();
      } else if (req.file) {
        if (req.file.mimetype === 'application/pdf' || req.file.originalname?.endsWith('.pdf')) {
          const { extractTextFromPdf } = await import('./contentGenerator');
          sourceText = await extractTextFromPdf(req.file.buffer);
        } else {
          const { extractTextFromDocx } = await import('./contentGenerator');
          sourceText = await extractTextFromDocx(req.file.buffer);
        }
      }

      if (!sourceText || sourceText.length < 50) {
        return res.status(400).json({ error: 'Could not extract enough text from the source. Please try a different source.' });
      }

      const truncated = sourceText.substring(0, 8000);
      const systemPrompt = `You are an SEO expert and content strategist for a university recruitment website. 
Analyze the provided source content and suggest 8 high-value blog post topics that would:
1. Attract prospective international students via organic search
2. Target specific search intents (informational, navigational, commercial)
3. Have realistic ranking potential (not overly competitive keywords)
4. Be directly relevant to the university or education topic in the source

Return a JSON object with a "suggestions" array of 8 objects, each with:
- title: Compelling, SEO-optimized English blog post title (include numbers or power words where natural)
- keyword: Primary target keyword phrase (2-5 words, the actual search query)
- searchIntent: one of "informational" | "navigational" | "commercial"
- description: 1-2 sentence summary of what the article should cover and why it's valuable for SEO

Return ONLY valid JSON, no markdown.`;

      const raw = await callAI(`Analyze this content and suggest 8 SEO blog topics:\n\n${truncated}`, req.tenantId, systemPrompt);
      let suggestions: any[] = [];
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON in response');
        const parsed = JSON.parse(match[0]);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.topics || Object.values(parsed)[0] || []);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch {
        return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
      }

      res.json({ suggestions });
    } catch (err: any) {
      console.error('[SuggestTopics]', err?.message);
      res.status(500).json({ error: err?.message || 'Failed to suggest topics' });
    }
  });

  // ─── Generate blog posts from selected topic suggestions ─────────────────────
  app.post("/api/admin/blog/generate-from-suggestions", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { suggestions } = req.body as { suggestions: Array<{ title: string; keyword: string; description?: string }> };
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return res.status(400).json({ error: 'suggestions array required' });
      }

      const { generateBlogPost, toSlug } = await import('./contentGenerator');
      const created: any[] = [];

      for (const suggestion of suggestions) {
        try {
          const post = await storage.createBlogPost({
            tenantId: req.tenantId,
            keyword: suggestion.keyword || suggestion.title,
            status: 'generating',
            isAiGenerated: true,
            backlinkSites: [],
          });

          created.push({ id: post.id, keyword: suggestion.keyword, status: 'generating' });

          (async () => {
            try {
              // Auto-collect internal links from existing published posts
              const allP = await storage.getBlogPosts(req.tenantId);
              const intLinks: { url: string; title: string }[] = [];
              for (const p of allP.filter(p => p.status === 'yayinda').slice(0, 6)) {
                const tr = await storage.getBlogPostTranslations(p.id);
                const en = tr.find(t => t.lang === 'en');
                if (en?.slug && en?.title) intLinks.push({ url: `/blog/${en.slug}`, title: en.title });
              }
              const enContent = await generateBlogPost(suggestion.keyword || suggestion.title, [], intLinks, req.tenantId);
              await storage.upsertBlogPostTranslation({
                postId: post.id, tenantId: req.tenantId, lang: 'en',
                title: suggestion.title || enContent.title,
                slug: toSlug(suggestion.title || enContent.title),
                content: enContent.content,
                metaTitle: enContent.metaTitle,
                metaDesc: enContent.metaDesc,
              });
              await storage.updateBlogPost(post.id, { status: 'taslak' });
              console.log(`[GenerateFromSuggestion] ✓ post=${post.id} keyword="${suggestion.keyword}"`);
            } catch (genErr: any) {
              console.error(`[GenerateFromSuggestion] ✗ post=${post.id}:`, genErr?.message);
              await storage.updateBlogPost(post.id, { status: 'failed' }).catch(() => {});
            }
          })();
        } catch (itemErr: any) {
          console.error('[GenerateFromSuggestion] item error:', itemErr?.message);
        }
      }

      res.json({ created, message: `${created.length} posts are being generated in English. Check the list in a few moments.` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate from suggestions' });
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

  app.patch("/api/admin/blog/:id/translation", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const id = req.params.id as string;
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const { lang, title, content, metaTitle, metaDesc } = req.body;
      if (!lang || !title || !content) {
        return res.status(400).json({ error: 'lang, title, and content are required' });
      }

      // Use provided slug or auto-generate from title
      const rawSlug = (req.body.slug as string | undefined)?.trim();
      const { toSlug } = await import('./contentGenerator');
      const slug = rawSlug || toSlug(title) + (lang !== 'en' ? `-${lang}` : '');

      const translation = await storage.upsertBlogPostTranslation({
        postId: id,
        tenantId: req.tenantId,
        lang,
        title,
        slug,
        content,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
      });
      res.json(translation);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update translation' });
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
    const id = req.params.id as string;
    try {
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const { generateBlogPost, toSlug, fetchLinkTitle } = await import('./contentGenerator');
      const { translateText } = await import('./aiTranslation');
      const keyword = post.keyword || req.body.keyword || 'university education';
      const rawLinks: string[] = post.backlinkSites || [];

      // ── Resolve external link titles ─────────────────────────────────────────
      const externalLinks = await Promise.all(
        rawLinks
          .filter(l => l.startsWith('http'))
          .map(async url => ({ url, title: await fetchLinkTitle(url) }))
      );
      // plain domain hints (no http) kept as simple anchor text hints
      const domainHints = rawLinks.filter(l => !l.startsWith('http'));
      if (domainHints.length > 0) {
        externalLinks.push(...domainHints.map(d => ({ url: `https://${d}`, title: d })));
      }

      // ── Collect internal links: other published posts of this tenant ──────────
      const allPosts = await storage.getBlogPosts(req.tenantId);
      const publishedOthers = allPosts.filter(p => p.id !== id && p.status === 'yayinda');
      const internalLinks: { url: string; title: string }[] = [];
      for (const p of publishedOthers.slice(0, 6)) {
        const translations = await storage.getBlogPostTranslations(p.id);
        const en = translations.find(t => t.lang === 'en');
        if (en?.slug && en?.title) {
          internalLinks.push({ url: `/blog/${en.slug}`, title: en.title });
        }
      }

      // ── Step 1: Generate EN content (synchronous) ────────────────────────────
      const enContent = await generateBlogPost(keyword, externalLinks, internalLinks, req.tenantId);

      // ── Step 2: Save EN translation immediately ──────────────────────────────
      await storage.upsertBlogPostTranslation({
        postId: id, tenantId: req.tenantId, lang: 'en',
        title: enContent.title, slug: enContent.slug,
        content: enContent.content,
        metaTitle: enContent.metaTitle, metaDesc: enContent.metaDesc,
      });
      await storage.updateBlogPost(id, { isAiGenerated: true, status: 'generating' });

      // ── Step 3: Respond immediately — client doesn't block on translations ───
      const enTranslations = await storage.getBlogPostTranslations(id);
      res.json({ success: true, translations: enTranslations, backgroundTranslating: true });

      // ── Step 4 (background): Translate 9 other langs + generate image ────────
      (async () => {
        const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en');
        let langSuccessCount = 0;

        for (const lang of otherLangs) {
          try {
            const fields = ['title', 'content', 'metaTitle', 'metaDesc'] as const;
            const translated: Record<string, string> = {};

            for (const field of fields) {
              try {
                const src = enContent[field];
                if (!src) { translated[field] = ''; continue; }
                const result = await translateText(src, 'en', [lang], req.tenantId);
                translated[field] = result[lang] || src; // fallback to EN on empty
                if (!result[lang]) {
                  console.warn(`[BlogGenerate] translateText returned no "${lang}" key for field="${field}", using EN fallback`);
                }
              } catch (fieldErr: any) {
                console.error(`[BlogGenerate] Field "${field}" → "${lang}" THREW: ${fieldErr?.message}`);
                translated[field] = enContent[field]; // fallback to EN text
              }
            }

            const langSlug = toSlug(translated['title'] || enContent.title) + `-${lang}`;
            await storage.upsertBlogPostTranslation({
              postId: id, tenantId: req.tenantId, lang,
              title: translated['title'] || enContent.title,
              slug: langSlug,
              content: translated['content'] || enContent.content,
              metaTitle: translated['metaTitle'] || enContent.metaTitle,
              metaDesc: translated['metaDesc'] || enContent.metaDesc,
            });

            langSuccessCount++;
            console.log(`[BlogGenerate] ✓ lang=${lang} (${langSuccessCount}/${otherLangs.length})`);
          } catch (langErr) {
            console.warn(`[BlogGenerate] ✗ lang=${lang} skipped:`, (langErr as any)?.message);
          }
        }

        // Update final status
        try {
          const finalStatus = langSuccessCount > 0 ? 'taslak' : 'failed';
          await storage.updateBlogPost(id, { status: finalStatus });
          console.log(`[BlogGenerate] Done. status=${finalStatus} langs=${langSuccessCount}/${otherLangs.length}`);
        } catch (statusErr) {
          console.warn('[BlogGenerate] Status update failed:', (statusErr as any)?.message);
        }

        // Image generation — runs only if autoGenerateImages is enabled in schedule (default: true)
        try {
          const scheduleSettings = await storage.getBlogSchedule(req.tenantId);
          const shouldAutoImage = scheduleSettings?.autoGenerateImages !== false;
          if (shouldAutoImage) {
            const { generateBlogImage } = await import('./blogImageService');
            const generated = await generateBlogImage(enContent.title, keyword, req.tenantId);
            if (generated) {
              const freshPost = await storage.getBlogPost(id);
              if (freshPost && !freshPost.featuredImageUrl) {
                await storage.addBlogPostImage({
                  postId: id, tenantId: req.tenantId,
                  url: generated.url, altByLang: generated.altByLang as any,
                  attribution: generated.attribution || null,
                  source: generated.source, position: 0,
                });
                await storage.updateBlogPostFeaturedImage(id, generated.url, generated.altByLang as any);
                console.log('[BlogGenerate] ✓ featured image saved');
              }
            }
          } else {
            console.log('[BlogGenerate] Auto-image generation disabled in schedule settings — skipping');
          }
        } catch (imgErr) {
          console.warn('[BlogGenerate] Image generation skipped:', (imgErr as any)?.message);
        }
      })().catch(err => console.error('[BlogGenerate] Background fatal error:', err));

    } catch (err: any) {
      console.error('[BlogGenerate] Error:', err);
      try { await storage.updateBlogPost(id, { status: 'failed' }); } catch {}
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to generate blog post' });
      }
    }
  });

  // ─── Translate-all: take EN translation → translate to 9 other langs ─────────
  app.post("/api/admin/blog/:id/translate-all", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const id = req.params.id as string;
    try {
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const translations = await storage.getBlogPostTranslations(id);
      const en = translations.find(t => t.lang === 'en');
      if (!en || !en.content) return res.status(400).json({ error: 'No English content found. Generate or write English content first.' });

      const { translateText } = await import('./aiTranslation');
      const { getAIConfig } = await import('./aiService');
      if (!await getAIConfig(req.tenantId)) return res.status(400).json({ error: 'AI not configured. Add your OpenAI key in AI Settings.' });

      const { toSlug } = await import('./contentGenerator');

      await storage.updateBlogPost(id, { status: 'generating' });
      res.json({ success: true, message: 'Translation started in background for 9 languages.' });

      (async () => {
        const SUPPORTED_LANGUAGES = ['en','tr','ar','fr','ru','fa','zh','hi','es','id'];
        const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en');
        let langSuccessCount = 0;
        for (const lang of otherLangs) {
          try {
            const fields = ['title', 'content', 'metaTitle', 'metaDesc'] as const;
            const translated: Record<string, string> = {};
            for (const field of fields) {
              try {
                const src = (en as any)[field];
                if (!src) { translated[field] = ''; continue; }
                const result = await translateText(src, 'en', [lang], req.tenantId);
                translated[field] = result[lang] || src;
              } catch {
                translated[field] = (en as any)[field] || '';
              }
            }
            const langSlug = toSlug(translated['title'] || en.title) + `-${lang}`;
            await storage.upsertBlogPostTranslation({
              postId: id, tenantId: req.tenantId, lang,
              title: translated['title'] || en.title,
              slug: langSlug,
              content: translated['content'] || en.content,
              metaTitle: translated['metaTitle'] || en.metaTitle || null,
              metaDesc: translated['metaDesc'] || en.metaDesc || null,
            });
            langSuccessCount++;
            console.log(`[TranslateAll] ✓ lang=${lang} (${langSuccessCount}/${otherLangs.length})`);
          } catch (langErr) {
            console.warn(`[TranslateAll] ✗ lang=${lang}:`, (langErr as any)?.message);
          }
        }
        const currentPost = await storage.getBlogPost(id);
        const finalStatus = currentPost?.status === 'generating' ? (langSuccessCount > 0 ? 'taslak' : 'failed') : currentPost?.status || 'taslak';
        await storage.updateBlogPost(id, { status: finalStatus }).catch(() => {});
        console.log(`[TranslateAll] Done. langs=${langSuccessCount}/${otherLangs.length}`);
      })();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to translate' });
    }
  });

  // ─── Fill SEO fields with AI (EN only) ───────────────────────────────────────
  app.post("/api/admin/blog/:id/fill-seo", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const id = req.params.id as string;
    try {
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const translations = await storage.getBlogPostTranslations(id);
      const en = translations.find(t => t.lang === 'en');
      if (!en || !en.content) return res.status(400).json({ error: 'No English content found. Generate or write English content first.' });

      const { callAI, getAIConfig } = await import('./aiService');
      if (!await getAIConfig(req.tenantId)) return res.status(400).json({ error: 'AI not configured.' });

      const keyword = post.keyword || '';
      const titleSnippet = en.title.substring(0, 100);
      const contentSnippet = en.content.substring(0, 2000);

      const seoSystemPrompt = `You are an SEO specialist. Generate optimized meta tags for a university blog post.
Return JSON with these fields:
- metaTitle: SEO title, 50-60 chars, include keyword naturally, compelling
- metaDesc: Meta description, 140-155 chars, include keyword, has a call-to-action
- focusKeyword: The best target keyword phrase extracted from the content (2-5 words)
Return ONLY valid JSON, no markdown.`;

      const rawSeo = await callAI(
        `Post title: ${titleSnippet}\nTarget keyword: ${keyword}\n\nContent excerpt:\n${contentSnippet}`,
        req.tenantId,
        seoSystemPrompt,
      );

      let seoData: any = {};
      try {
        const match = rawSeo.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON');
        seoData = JSON.parse(match[0]);
      } catch {
        return res.status(500).json({ error: 'AI returned invalid JSON' });
      }

      res.json({
        metaTitle: seoData.metaTitle || '',
        metaDesc: seoData.metaDesc || '',
        focusKeyword: seoData.focusKeyword || keyword,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate SEO fields' });
    }
  });

  // ─── AI Power: rewrite existing content to higher quality ────────────────────
  app.post("/api/admin/blog/:id/ai-power", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    const id = req.params.id as string;
    try {
      const post = await storage.getBlogPost(id);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

      const { callAI, getAIConfig } = await import('./aiService');
      if (!await getAIConfig(req.tenantId)) return res.status(400).json({ error: 'AI not configured.' });

      const { toSlug, fetchLinkTitle } = await import('./contentGenerator');
      const { translateText } = await import('./aiTranslation');

      const keyword = post.keyword || 'university education';
      const translations = await storage.getBlogPostTranslations(id);
      const existing = translations.find(t => t.lang === 'en');

      // Resolve backlinks
      const rawLinks: string[] = post.backlinkSites || [];
      const externalLinks = await Promise.all(
        rawLinks.filter(l => l.startsWith('http'))
          .map(async url => ({ url, title: await fetchLinkTitle(url) }))
      );
      rawLinks.filter(l => !l.startsWith('http')).forEach(d =>
        externalLinks.push({ url: `https://${d}`, title: d })
      );

      const allPosts = await storage.getBlogPosts(req.tenantId);
      const internalLinks: { url: string; title: string }[] = [];
      for (const p of allPosts.filter(p => p.id !== id && p.status === 'yayinda').slice(0, 6)) {
        const tr = await storage.getBlogPostTranslations(p.id);
        const en = tr.find(t => t.lang === 'en');
        if (en?.slug && en?.title) internalLinks.push({ url: `/blog/${en.slug}`, title: en.title });
      }

      const externalBlock = externalLinks.length > 0
        ? `\nEXTERNAL LINKS TO INCLUDE (embed naturally as Markdown hyperlinks):\n${externalLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`
        : '';
      const internalBlock = internalLinks.length > 0
        ? `\nINTERNAL LINKS (embed at least ${Math.min(2, internalLinks.length)} naturally):\n${internalLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`
        : '';

      const existingContext = existing?.content
        ? `\nEXISTING DRAFT (use as a reference for topic/angle, but fully rewrite for quality):\n${existing.content.substring(0, 1500)}\n`
        : '';

      const systemPrompt = `You are a senior SEO content strategist for a university recruitment platform.
Rewrite or generate authoritative, in-depth articles for international students.
Rules:
- Never fabricate statistics or unverifiable facts.
- Use precise language — no vague filler.
- Embed links naturally as Markdown hyperlinks — never list them at the bottom.
- Every H2 must contain a keyword variant or strong supporting topic.
- Return ONLY valid JSON. No markdown fences, no extra text.`;

      const prompt = `Rewrite and significantly improve this blog article targeting the keyword: "${keyword}"
${existingContext}${externalBlock}${internalBlock}
REQUIRED STRUCTURE:
1. # H1 Title — compelling, keyword-rich, under 65 chars
2. Strong introduction: hook + keyword in first sentence + reader benefit
3. At least 4 ## H2 sections (200-300 words each), headings contain keyword variants
4. ### H3 sub-headings inside at least 2 H2 sections
5. At least 2 bullet or numbered lists
6. ## Conclusion section with keyword + clear call-to-action
7. ## Frequently Asked Questions with exactly 5 Q&A pairs (2-4 sentences each)

TOTAL LENGTH: 1500-2000 words (body only, not counting FAQ)

KEYWORD RULES:
- Keyword in first sentence
- Keyword or variant in at least 3 H2 headings
- Keyword in conclusion

Return ONLY this JSON:
{
  "title": "H1 title under 65 chars",
  "content": "Full Markdown article starting with # H1 through FAQ",
  "metaTitle": "50-60 chars, keyword near start",
  "metaDesc": "140-155 chars, keyword + benefit + CTA"
}`;

      const raw = await callAI(prompt, req.tenantId, systemPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI returned invalid JSON');
      const parsed = JSON.parse(match[0]) as { title: string; content: string; metaTitle: string; metaDesc: string };

      const slug = toSlug(parsed.title);

      // Save EN immediately
      await storage.upsertBlogPostTranslation({
        postId: id, tenantId: req.tenantId, lang: 'en',
        title: parsed.title, slug,
        content: parsed.content,
        metaTitle: parsed.metaTitle, metaDesc: parsed.metaDesc,
      });
      await storage.updateBlogPost(id, { isAiGenerated: true, status: 'generating' });

      const enTranslations = await storage.getBlogPostTranslations(id);
      res.json({ success: true, translations: enTranslations, backgroundTranslating: true });

      // Background: translate to 9 other languages
      (async () => {
        const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en');
        let ok = 0;
        for (const lang of otherLangs) {
          try {
            const fields = ['title', 'content', 'metaTitle', 'metaDesc'] as const;
            const translated: Record<string, string> = {};
            for (const field of fields) {
              try {
                const src = parsed[field];
                if (!src) { translated[field] = ''; continue; }
                const r = await translateText(src, 'en', [lang], req.tenantId);
                translated[field] = r[lang] || src;
              } catch { translated[field] = parsed[field]; }
            }
            const langSlug = toSlug(translated['title'] || parsed.title) + `-${lang}`;
            await storage.upsertBlogPostTranslation({
              postId: id, tenantId: req.tenantId, lang,
              title: translated['title'] || parsed.title, slug: langSlug,
              content: translated['content'] || parsed.content,
              metaTitle: translated['metaTitle'] || parsed.metaTitle,
              metaDesc: translated['metaDesc'] || parsed.metaDesc,
            });
            ok++;
          } catch (e) { console.warn(`[AIPower] lang=${lang} failed:`, (e as any)?.message); }
        }
        const finalStatus = ok > 0 ? 'taslak' : 'failed';
        await storage.updateBlogPost(id, { status: finalStatus }).catch(() => {});
        console.log(`[AIPower] Done. status=${finalStatus} langs=${ok}/${otherLangs.length}`);
      })().catch(e => console.error('[AIPower] Background error:', e));

    } catch (err: any) {
      try { await storage.updateBlogPost(id, { status: 'failed' }); } catch {}
      if (!res.headersSent) res.status(500).json({ error: err?.message || 'AI Power failed' });
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

  // ─── Sample Excel template download ─────────────────────────────────────────
  app.get("/api/admin/blog/sample-excel", requireAdmin, resolveTenant, requireAdminTenantAccess, async (_req, res) => {
    try {
      const xlsx = await import('xlsx');
      const rows = [
        {
          title: 'Why You Should Study Medicine in Turkey',
          keyword: 'study medicine turkey',
          backlink_siteleri: 'partner1.edu, partner2.org',
          auto_gorsel: 1,
          yayinlanma_tarihi: '2026-07-01 09:00',
          durum: 'zamanli',
        },
        {
          title: 'Top Engineering Programs in Istanbul',
          keyword: 'engineering programs istanbul',
          backlink_siteleri: 'techpartner.com',
          auto_gorsel: 1,
          yayinlanma_tarihi: '2026-07-03 09:00',
          durum: 'zamanli',
        },
        {
          title: 'How to Get a Student Visa for Turkey',
          keyword: 'turkey student visa guide',
          backlink_siteleri: '',
          auto_gorsel: 0,
          yayinlanma_tarihi: '',
          durum: 'taslak',
        },
      ];
      const ws = xlsx.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 50 }, { wch: 35 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
      ];
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Blog Posts');
      const buffer: Buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="blog-import-template.xlsx"');
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate template' });
    }
  });

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
        const autoGorselRaw = row['auto_gorsel'] ?? row['auto_image'] ?? row['görsel'] ?? '';
        const shouldAutoImage = ['1', 'true', 'evet', 'yes'].includes(String(autoGorselRaw).toLowerCase().trim());
        const durumRaw = (row['durum'] || row['status'] || 'taslak').toString().trim();
        const status = ['taslak','zamanli','yayinda'].includes(durumRaw) ? durumRaw : 'taslak';
        const publishAtRaw = row['yayinlanma_tarihi'] || row['publish_at'] || '';
        const publishAt = publishAtRaw ? new Date(publishAtRaw).toISOString() : null;

        if (!keyword) continue;

        const post = await storage.createBlogPost({
          tenantId: req.tenantId,
          keyword,
          backlinkSites,
          publishAt: publishAt as any,
          status,
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

        // Auto-generate image in background if column says so
        if (shouldAutoImage) {
          (async () => {
            try {
              const { generateBlogImage } = await import('./blogImageService');
              const generated = await generateBlogImage(title || keyword, keyword, req.tenantId);
              if (generated) {
                await storage.addBlogPostImage({
                  postId: post.id, tenantId: req.tenantId,
                  url: generated.url, altByLang: generated.altByLang as any,
                  attribution: generated.attribution || null,
                  source: generated.source, position: 0,
                });
                await storage.updateBlogPostFeaturedImage(post.id, generated.url, generated.altByLang as any);
              }
            } catch (imgErr) {
              console.warn('[ExcelImport] Image generation skipped for', post.id, (imgErr as any)?.message);
            }
          })();
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
      const { dailyLimit, weekdays, mode, isEnabled, autoGenerateImages } = req.body;
      const schedule = await storage.upsertBlogSchedule(req.tenantId, {
        dailyLimit: dailyLimit ?? 1,
        weekdays: weekdays ?? ['1','2','3','4','5'],
        mode: mode ?? 'onay',
        isEnabled: isEnabled ?? false,
        autoGenerateImages: autoGenerateImages ?? true,
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
      const job = await startExportJob(req.tenantId);
      res.json({ jobId: job.id });
    } catch (err: any) {
      console.error('ZIP export start error:', err);
      res.status(500).json({ error: err?.message || 'Failed to start export' });
    }
  });

  // Poll export job status
  app.get("/api/admin/sites/:tenantId/export-zip/:jobId", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const job = await getExportJob(req.params.jobId as string);
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

  // List recent export jobs for a tenant
  app.get("/api/admin/sites/:tenantId/exports", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const jobs = await storage.listExportJobs(req.tenantId, 10);
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list exports' });
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
  // Returns 200 ONLY for domains explicitly registered in the tenant_domains
  // table — no fallback to tenants.domain — so only panel-added domains can
  // ever receive a Let's Encrypt certificate (abuse prevention).
  app.get("/api/internal/verify-domain", async (req, res) => {
    try {
      const domain = typeof req.query.domain === 'string' ? req.query.domain.trim().toLowerCase() : '';
      if (!domain) return res.status(400).send('domain parameter required');

      // Query tenant_domains directly — intentionally no legacy tenants.domain fallback.
      const { tenantDomains } = await import('@shared/schema');
      const rows = await db.select({ id: tenantDomains.id })
        .from(tenantDomains)
        .where(eq(tenantDomains.domain, domain))
        .limit(1);

      if (rows.length > 0) {
        return res.status(200).send('OK');
      }
      console.warn(`[verify-domain] 403 Forbidden — domain not registered in tenant_domains: "${domain}"`);
      return res.status(403).send('Forbidden');
    } catch (err) {
      console.error('verify-domain error:', err);
      return res.status(500).send('Internal Server Error');
    }
  });

  // ─── Image Settings (source: ai_openai | stock_unsplash | stock_pexels | media_library) ─────
  app.get("/api/admin/image-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { getImageConfig } = await import('./blogImageService');
      const config = await getImageConfig(req.tenantId);
      if (!config) return res.json({ source: 'media_library', hasApiKey: false });
      res.json({ source: config.source, model: config.model, hasApiKey: !!config.encryptedApiKey });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.post("/api/admin/image-settings", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const { source, model, apiKey } = req.body;
      if (!source) return res.status(400).json({ error: 'source is required' });
      const { getImageConfig, saveImageConfig } = await import('./blogImageService');
      const { encryptApiKey } = await import('./aiService');
      const existing = await getImageConfig(req.tenantId);
      const encryptedApiKey = apiKey
        ? encryptApiKey(apiKey)
        : (existing?.encryptedApiKey || undefined);
      await saveImageConfig(req.tenantId, { source, model: model || 'gpt-image-1', encryptedApiKey });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // ─── Blog Post Images ─────────────────────────────────────────────────────────
  app.get("/api/admin/blog/:id/images", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id as string);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const images = await storage.getBlogPostImages(post.id);
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.post("/api/admin/blog/:id/generate-images", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id as string);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const { generateBlogImage } = await import('./blogImageService');
      const keyword = post.keyword || 'university education';
      const translations = await storage.getBlogPostTranslations(post.id);
      const enTitle = translations.find(t => t.lang === 'en')?.title || keyword;
      // Check config first so we can return a helpful "not configured" message
      const { getImageConfig } = await import('./blogImageService');
      const imgConfig = await getImageConfig(req.tenantId);
      if (!imgConfig || imgConfig.source === 'media_library') {
        return res.status(400).json({ error: 'Image generation not configured. Set a source (DALL-E / Unsplash / Pexels) in AI Settings → Image Source.' });
      }

      const generated = await generateBlogImage(enTitle, keyword, req.tenantId);
      if (!generated) return res.status(400).json({ error: 'Image generation returned no result (check API key and source configuration).' });
      const image = await storage.addBlogPostImage({
        postId: post.id,
        tenantId: req.tenantId,
        url: generated.url,
        altByLang: generated.altByLang as any,
        attribution: generated.attribution || null,
        source: generated.source,
        position: 0,
      });
      // Auto-set as featured if none set
      if (!post.featuredImageUrl) {
        await storage.updateBlogPostFeaturedImage(post.id, generated.url, generated.altByLang as any);
      }
      res.json(image);
    } catch (err: any) {
      console.error('Blog image generation error:', err);
      res.status(500).json({ error: err?.message || 'Image generation failed' });
    }
  });

  app.post("/api/admin/blog/:id/images/upload", requireAdmin, resolveTenant, requireAdminTenantAccess, upload.single('file'), async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id as string);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const webpBuffer = await sharp(req.file.buffer)
        .resize({ width: 1200, height: 630, fit: 'cover', position: 'center' })
        .webp({ quality: 82 })
        .toBuffer();
      const url = saveUpload(webpBuffer, req.file.originalname.replace(/\.[^.]+$/, '') + '.webp');
      const keyword = post.keyword || 'university education';
      const altFallback: Record<string, string> = {};
      SUPPORTED_LANGUAGES.forEach(l => { altFallback[l] = keyword; });
      const image = await storage.addBlogPostImage({
        postId: post.id,
        tenantId: req.tenantId,
        url,
        altByLang: altFallback as any,
        attribution: null,
        source: 'media_library',
        position: 0,
      });
      if (!post.featuredImageUrl) {
        await storage.updateBlogPostFeaturedImage(post.id, url, altFallback);
      }
      res.json(image);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.patch("/api/admin/blog/:id/featured-image", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id as string);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const { url, altByLang } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      const updated = await storage.updateBlogPostFeaturedImage(post.id, url, altByLang || {});
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.delete("/api/admin/blog/:postId/images/:imgId", requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.postId as string);
      if (!post || post.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      const ok = await storage.deleteBlogPostImage(req.params.imgId as string);
      // If deleted image was the featured image, clear it
      const deletedImages = await storage.getBlogPostImages(post.id);
      if (post.featuredImageUrl && deletedImages.every(i => i.url !== post.featuredImageUrl)) {
        const next = deletedImages[0];
        if (next) {
          await storage.updateBlogPostFeaturedImage(post.id, next.url, (next.altByLang as any) || {});
        } else {
          await storage.updateBlogPostFeaturedImage(post.id, '', {});
        }
      }
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // ─── Start blog scheduler ────────────────────────────────────────────────────
  startBlogScheduler();

  return httpServer;
}
