import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertProgramSchema, insertLeadSchema, insertApplicationSchema, insertMediaAssetSchema, insertTestimonialSchema, insertDocumentSchema, insertFaqItemSchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

const SessionStore = MemoryStore(session);

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    tenantId?: string;
  }
}

const DEFAULT_TENANT_ID = 'default';

function getTenantId(req: Request): string {
  const host = req.headers.host || '';
  return DEFAULT_TENANT_ID;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for Replit's HTTPS termination
  app.set('trust proxy', 1);
  
  // Allow embedding for /embed/* routes
  app.use('/embed', (_req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    next();
  });
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'university-platform-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000
    }),
    cookie: {
      secure: 'auto',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // Register Object Storage routes
  registerObjectStorageRoutes(app);

  // Server-side file upload endpoint
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Get a presigned URL for the upload
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      
      // Upload the file from server to GCS
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file.buffer,
        headers: {
          "Content-Type": file.mimetype || "application/octet-stream",
        },
      });

      if (!response.ok) {
        console.error("GCS upload failed:", response.status, await response.text());
        return res.status(500).json({ error: "Failed to upload to storage" });
      }

      res.json({ 
        objectPath,
        metadata: {
          name: file.originalname,
          size: file.size,
          contentType: file.mimetype,
        }
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Admin Authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const admin = await storage.getAdminByEmail(email);
      if (!admin || admin.passwordHash !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      req.session.adminId = admin.id;
      req.session.tenantId = admin.tenantId || undefined;
      
      // Explicitly save session to ensure cookie is set
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        res.json({ 
          success: true, 
          admin: { 
            id: admin.id, 
            email: admin.email, 
            name: admin.name,
            role: admin.role
          } 
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdminById(req.session.adminId || '');
      if (!admin) {
        return res.status(404).json({ error: "Admin not found" });
      }
      res.json({ 
        id: admin.id, 
        email: admin.email, 
        name: admin.name,
        role: admin.role,
        tenantId: admin.tenantId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get admin info" });
    }
  });

  // Dashboard Stats API (protected)
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const [programsList, leadsList, applicationsList] = await Promise.all([
        storage.getPrograms(tenantId),
        storage.getLeads(tenantId),
        storage.getApplications(tenantId)
      ]);
      
      const submittedApps = applicationsList.filter(a => a.status === 'submitted');
      const processingApps = applicationsList.filter(a => a.status === 'processing');
      const approvedApps = applicationsList.filter(a => a.status === 'approved');
      
      res.json({
        programs: programsList.length,
        leads: leadsList.length,
        applications: applicationsList.length,
        submitted: submittedApps.length,
        processing: processingApps.length,
        approved: approvedApps.length,
        recentApplications: applicationsList.slice(0, 5),
        recentLeads: leadsList.slice(0, 5)
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Programs API
  app.get("/api/programs", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const programsList = await storage.getPrograms(tenantId);
      res.json(programsList);
    } catch (error) {
      console.error("Error fetching programs:", error);
      res.status(500).json({ error: "Failed to fetch programs" });
    }
  });

  app.get("/api/programs/:id", async (req, res) => {
    try {
      const program = await storage.getProgram(req.params.id as string);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Error fetching program:", error);
      res.status(500).json({ error: "Failed to fetch program" });
    }
  });

  app.post("/api/programs", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const validated = insertProgramSchema.parse({ ...req.body, tenantId });
      const program = await storage.createProgram(validated);
      res.status(201).json(program);
    } catch (error) {
      console.error("Error creating program:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create program" });
    }
  });

  app.patch("/api/programs/:id", requireAdmin, async (req, res) => {
    try {
      const program = await storage.updateProgram(req.params.id as string, req.body);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Error updating program:", error);
      res.status(500).json({ error: "Failed to update program" });
    }
  });

  app.delete("/api/programs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProgram(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting program:", error);
      res.status(500).json({ error: "Failed to delete program" });
    }
  });

  // Leads API (GET is admin-only, POST is public for lead capture)
  app.get("/api/leads", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const leadsList = await storage.getLeads(tenantId);
      res.json(leadsList);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const validated = insertLeadSchema.parse({ ...req.body, tenantId });
      const lead = await storage.createLead(validated);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // Applications API (GET is admin-only, POST is public for application submission)
  app.get("/api/applications", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const applicationsList = await storage.getApplications(tenantId);
      res.json(applicationsList);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.get("/api/applications/:id", requireAdmin, async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id as string);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });

  app.post("/api/applications", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const validated = insertApplicationSchema.parse({ ...req.body, tenantId });
      const application = await storage.createApplication(validated);
      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create application" });
    }
  });

  app.patch("/api/applications/:id", requireAdmin, async (req, res) => {
    try {
      const application = await storage.updateApplication(req.params.id as string, req.body);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.delete("/api/applications/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteApplication(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ error: "Failed to delete application" });
    }
  });

  // Get documents for an application
  app.get("/api/applications/:id/documents", requireAdmin, async (req, res) => {
    try {
      const documents = await storage.getDocumentsByApplication(req.params.id as string);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Create document record
  app.post("/api/documents", async (req, res) => {
    try {
      const parsed = insertDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid document data", details: parsed.error });
      }
      const document = await storage.createDocument(parsed.data);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Tenants API
  app.get("/api/tenant", async (req, res) => {
    try {
      const tenant = await storage.getTenantByDomain("okanuniversity.app");
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.patch("/api/tenant", requireAdmin, async (req, res) => {
    try {
      const tenant = await storage.getTenantByDomain("okanuniversity.app");
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      const updated = await storage.updateTenant(tenant.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tenant:", error);
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // Theme API
  app.get("/api/theme", async (req, res) => {
    try {
      const tenant = await storage.getTenantByDomain("okanuniversity.app");
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      let theme = await storage.getTheme(tenant.id);
      if (!theme) {
        theme = await storage.createTheme({ tenantId: tenant.id });
      }
      res.json(theme);
    } catch (error) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  });

  app.patch("/api/theme", requireAdmin, async (req, res) => {
    try {
      const tenant = await storage.getTenantByDomain("okanuniversity.app");
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      let theme = await storage.getTheme(tenant.id);
      if (!theme) {
        theme = await storage.createTheme({ tenantId: tenant.id, ...req.body });
      } else {
        theme = await storage.updateTheme(tenant.id, req.body);
      }
      res.json(theme);
    } catch (error) {
      console.error("Error updating theme:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  });

  // Sections API
  app.get("/api/sections", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const sectionsList = await storage.getSections(tenantId);
      res.json(sectionsList);
    } catch (error) {
      console.error("Error fetching sections:", error);
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  app.post("/api/sections", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { sectionKey, displayOrder, isEnabled, contentByLang, settings } = req.body;
      
      if (!sectionKey) {
        return res.status(400).json({ error: "sectionKey is required" });
      }
      
      const section = await storage.createSection({
        tenantId,
        sectionKey,
        displayOrder: displayOrder ?? 0,
        isEnabled: isEnabled ?? true,
        contentByLang: contentByLang ?? null,
        settings: settings ?? null,
      });
      
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating section:", error);
      res.status(500).json({ error: "Failed to create section" });
    }
  });

  app.delete("/api/sections/:id", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteSection(req.params.id as string, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Section not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting section:", error);
      res.status(500).json({ error: "Failed to delete section" });
    }
  });

  app.patch("/api/sections/:id", requireAdmin, async (req, res) => {
    try {
      const section = await storage.updateSection(req.params.id as string, req.body);
      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error updating section:", error);
      res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.patch("/api/sections", requireAdmin, async (req, res) => {
    try {
      const updates = req.body.sections as Array<{ id: string; isEnabled: boolean }>;
      const sections = await storage.updateSections(updates);
      res.json(sections);
    } catch (error) {
      console.error("Error updating sections:", error);
      res.status(500).json({ error: "Failed to update sections" });
    }
  });

  // SEO Routes
  app.get("/sitemap.xml", (req, res) => {
    const baseUrl = "https://okanuniversity.app";
    const languages = ["en", "ar", "tr", "fr", "ru", "fa"];
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;
    
    languages.forEach((lang) => {
      sitemap += `
  <url>
    <loc>${baseUrl}/${lang}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en" />
    <xhtml:link rel="alternate" hreflang="ar" href="${baseUrl}/ar" />
    <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/tr" />
    <xhtml:link rel="alternate" hreflang="fr" href="${baseUrl}/fr" />
    <xhtml:link rel="alternate" hreflang="ru" href="${baseUrl}/ru" />
    <xhtml:link rel="alternate" hreflang="fa" href="${baseUrl}/fa" />
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`;
    });
    
    sitemap += "\n</urlset>";
    
    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  });

  app.get("/robots.txt", (req, res) => {
    const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://okanuniversity.app/sitemap.xml`;
    
    res.header("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  // Media Assets API
  app.get("/api/media", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const media = await storage.getMediaAssets(tenantId);
      res.json(media);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  app.post("/api/media", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertMediaAssetSchema.safeParse({ ...req.body, tenantId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid media data", details: parsed.error });
      }
      
      const media = await storage.createMediaAsset(parsed.data);
      res.json(media);
    } catch (error) {
      console.error("Error creating media:", error);
      res.status(500).json({ error: "Failed to create media" });
    }
  });

  app.delete("/api/media/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const success = await storage.deleteMediaAsset(id);
      if (!success) {
        return res.status(404).json({ error: "Media not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting media:", error);
      res.status(500).json({ error: "Failed to delete media" });
    }
  });

  // ==================== TESTIMONIALS ====================
  app.get("/api/testimonials", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const testimonialsList = await storage.getTestimonials(tenantId);
      res.json(testimonialsList);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  app.get("/api/testimonials/:id", async (req, res) => {
    try {
      const testimonial = await storage.getTestimonial(req.params.id as string);
      if (!testimonial) {
        return res.status(404).json({ error: "Testimonial not found" });
      }
      res.json(testimonial);
    } catch (error) {
      console.error("Error fetching testimonial:", error);
      res.status(500).json({ error: "Failed to fetch testimonial" });
    }
  });

  app.post("/api/testimonials", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertTestimonialSchema.safeParse({ ...req.body, tenantId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid testimonial data", details: parsed.error });
      }
      
      const testimonial = await storage.createTestimonial(parsed.data);
      res.json(testimonial);
    } catch (error) {
      console.error("Error creating testimonial:", error);
      res.status(500).json({ error: "Failed to create testimonial" });
    }
  });

  app.patch("/api/testimonials/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = getTenantId(req);
      
      const existing = await storage.getTestimonial(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Testimonial not found" });
      }
      
      const { tenantId: _, id: __, ...updateData } = req.body;
      const testimonial = await storage.updateTestimonial(id, updateData);
      res.json(testimonial);
    } catch (error) {
      console.error("Error updating testimonial:", error);
      res.status(500).json({ error: "Failed to update testimonial" });
    }
  });

  app.delete("/api/testimonials/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = getTenantId(req);
      
      const existing = await storage.getTestimonial(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Testimonial not found" });
      }
      
      const success = await storage.deleteTestimonial(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      res.status(500).json({ error: "Failed to delete testimonial" });
    }
  });

  // FAQ Items
  app.get("/api/faq", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const faqList = await storage.getFaqItems(tenantId);
      res.json(faqList);
    } catch (error) {
      console.error("Error fetching FAQ items:", error);
      res.status(500).json({ error: "Failed to fetch FAQ items" });
    }
  });

  app.get("/api/faq/:id", async (req, res) => {
    try {
      const faq = await storage.getFaqItem(req.params.id as string);
      if (!faq) {
        return res.status(404).json({ error: "FAQ item not found" });
      }
      res.json(faq);
    } catch (error) {
      console.error("Error fetching FAQ item:", error);
      res.status(500).json({ error: "Failed to fetch FAQ item" });
    }
  });

  app.post("/api/faq", requireAdmin, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertFaqItemSchema.safeParse({ ...req.body, tenantId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid FAQ data", details: parsed.error });
      }
      
      const faq = await storage.createFaqItem(parsed.data);
      res.json(faq);
    } catch (error) {
      console.error("Error creating FAQ item:", error);
      res.status(500).json({ error: "Failed to create FAQ item" });
    }
  });

  app.patch("/api/faq/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = getTenantId(req);
      
      const existing = await storage.getFaqItem(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "FAQ item not found" });
      }
      
      const { tenantId: _, id: __, ...updateData } = req.body;
      const faq = await storage.updateFaqItem(id, updateData);
      res.json(faq);
    } catch (error) {
      console.error("Error updating FAQ item:", error);
      res.status(500).json({ error: "Failed to update FAQ item" });
    }
  });

  app.delete("/api/faq/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = getTenantId(req);
      
      const existing = await storage.getFaqItem(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "FAQ item not found" });
      }
      
      const success = await storage.deleteFaqItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting FAQ item:", error);
      res.status(500).json({ error: "Failed to delete FAQ item" });
    }
  });

  return httpServer;
}
