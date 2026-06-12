/**
 * Test app factory — creates a minimal Express app that faithfully
 * re-implements the production middleware (resolveTenant, requirePublished,
 * requireAdmin, requireAdminTenantAccess) with injectable mock storage.
 *
 * This avoids connecting to PostgreSQL (connect-pg-simple) while still
 * testing the exact same behavioral contracts.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import type { IStorage } from '../../server/storage';

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    tenantId?: string;
  }
}

function isDevHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.replit.dev') ||
    host.endsWith('.picard.replit.dev') ||
    host.endsWith('.repl.co')
  );
}

export function createTestApp(mockStorage: IStorage) {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);

  app.use(session({
    secret: 'test-secret-key',
    resave: false,
    saveUninitialized: false,
  }));

  async function resolveTenant(req: Request & { tenant?: any; tenantId?: string }, res: Response, next: NextFunction) {
    const rawHost = req.headers.host || '';
    const host = rawHost.replace(/^www\./, '').replace(/:\d+$/, '').toLowerCase();

    const tenant = await mockStorage.getTenantByHostDomain(host);
    if (tenant) {
      (req as any).tenant = tenant;
      (req as any).tenantId = tenant.id;
      return next();
    }

    if (isDevHost(host)) {
      const defaultTenant = await mockStorage.getTenant('default');
      if (defaultTenant) {
        (req as any).tenant = defaultTenant;
        (req as any).tenantId = defaultTenant.id;
        return next();
      }
    }

    return res.status(404).json({ error: 'Tenant not found' });
  }

  function requirePublished(req: Request, res: Response, next: NextFunction) {
    if ((req.session as any)?.adminId) return next();
    if ((req as any).tenant?.status === 'yayinda') return next();
    return res.status(404).json({ status: 'coming_soon', message: 'Bu site henüz yayında değil.' });
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!(req.session as any)?.adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  async function requireAdminTenantAccess(req: Request, res: Response, next: NextFunction) {
    const admin = await mockStorage.getAdminById((req.session as any).adminId || '');
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    if (admin.role === 'super_admin') return next();
    if (!(req.session as any).tenantId || (req.session as any).tenantId !== (req as any).tenantId) {
      return res.status(403).json({ error: 'Forbidden: tenant mismatch' });
    }
    next();
  }

  app.get('/api/sections', resolveTenant, requirePublished, async (req, res) => {
    const sections = await mockStorage.getSections((req as any).tenantId);
    res.json(sections);
  });

  app.get('/api/blog', resolveTenant, requirePublished, async (req, res) => {
    const lang = (req.query.lang as string) || 'en';
    const posts = await mockStorage.getPublishedBlogPosts((req as any).tenantId, lang);
    res.json(posts);
  });

  app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const admin = await mockStorage.getAdminByEmail(email);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isHashed = admin.passwordHash.startsWith('$2');
    const valid = isHashed
      ? await bcrypt.compare(password, admin.passwordHash)
      : admin.passwordHash === password;

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    (req.session as any).adminId = admin.id;
    (req.session as any).tenantId = admin.tenantId || undefined;

    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session save failed' });
      res.json({
        success: true,
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, tenantId: admin.tenantId },
      });
    });
  });

  app.get('/api/admin/me', requireAdmin, async (req, res) => {
    const admin = await mockStorage.getAdminById((req.session as any).adminId || '');
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, tenantId: admin.tenantId });
  });

  app.get('/api/admin/stats', requireAdmin, resolveTenant, requireAdminTenantAccess, async (req, res) => {
    res.json({ tenantId: (req as any).tenantId });
  });

  app.get('/api/img/:id', async (req, res) => {
    const { id } = req.params;
    res.json({ id, accessible: true });
  });

  return app;
}
