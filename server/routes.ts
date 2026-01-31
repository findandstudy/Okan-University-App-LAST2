import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertProgramSchema, insertLeadSchema, insertApplicationSchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";

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
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.set('trust proxy', 1);
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'university-platform-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000
    }),
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

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
      
      res.json({ 
        success: true, 
        admin: { 
          id: admin.id, 
          email: admin.email, 
          name: admin.name,
          role: admin.role
        } 
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

  return httpServer;
}
