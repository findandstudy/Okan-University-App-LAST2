/**
 * Regression tests for Section PATCH IDOR vulnerability fix.
 *
 * Verifies that:
 *  - Admin from tenant-a cannot overwrite a section belonging to tenant-b
 *  - Admin from tenant-a can still update their own section
 *  - Bulk PATCH passes the correct tenantId to storage (DB-level isolation)
 *  - Superadmin using ?_tid= override can edit any tenant's section
 *
 * All tests exercise the REAL server/routes.ts (not a re-implementation).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';

// ─── Mocks (must be declared before any import of production code) ──────────

vi.mock('connect-pg-simple', () => ({
  default: (expressSession: any) => expressSession.MemoryStore,
}));

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  },
}));

vi.mock('../../server/storage', () => ({
  storage: {
    getTenantByHostDomain: vi.fn(),
    getTenant: vi.fn(),
    getTenantDomains: vi.fn(),
    getAdminById: vi.fn(),
    getAdminByEmail: vi.fn(),
    updateAdminPassword: vi.fn(),
    getSections: vi.fn(),
    getSection: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    updateSections: vi.fn(),
    deleteSection: vi.fn(),
    getSeoSettings: vi.fn(),
    getTheme: vi.fn(),
    getFaqItems: vi.fn(),
    getTestimonials: vi.fn(),
    getTrustBadges: vi.fn(),
    getWidgets: vi.fn(),
    getPrograms: vi.fn(),
    getMediaAssets: vi.fn(),
    getMediaAsset: vi.fn(),
    getAllTenants: vi.fn(),
    createTenant: vi.fn(),
    updateTenant: vi.fn(),
    deleteTenant: vi.fn(),
    getAdminUsers: vi.fn(),
    createAdminUser: vi.fn(),
    getBlogPost: vi.fn(),
    getBlogPosts: vi.fn(),
    createBlogPost: vi.fn(),
    updateBlogPost: vi.fn(),
    deleteBlogPost: vi.fn(),
    getBlogPostTranslations: vi.fn(),
    getBlogPostTranslationBySlug: vi.fn(),
    getPublishedBlogPosts: vi.fn(),
    upsertBlogPostTranslation: vi.fn(),
    deleteBlogPostTranslations: vi.fn(),
    getBlogPostImages: vi.fn(),
    addBlogPostImage: vi.fn(),
    updateBlogPostFeaturedImage: vi.fn(),
    deleteBlogPostImage: vi.fn(),
    getBlogSchedule: vi.fn(),
    upsertBlogSchedule: vi.fn(),
    getSiteVersions: vi.fn(),
    getSiteVersion: vi.fn(),
    createSiteVersion: vi.fn(),
    deleteSiteVersion: vi.fn(),
    pruneOldVersions: vi.fn(),
    getAISettings: vi.fn(),
    saveAISettings: vi.fn(),
    getLeads: vi.fn(),
    createLead: vi.fn(),
    updateLead: vi.fn(),
  },
}));

vi.mock('../../server/blogScheduler', () => ({ startBlogScheduler: vi.fn() }));
vi.mock('../../server/zipExporter', () => ({
  startExportJob: vi.fn(), getExportJob: vi.fn(),
  captureSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
}));
vi.mock('../../server/localFileStorage', () => ({
  saveUpload: vi.fn(), readUpload: vi.fn(), serveUpload: vi.fn(),
  getUploadsDir: vi.fn().mockReturnValue('/tmp/test-uploads'), deleteUpload: vi.fn(),
}));
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(), webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(), png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('img')),
  }),
}));
vi.mock('../../server/contentGenerator', () => ({
  generateBlogPost: vi.fn(),
  toSlug: (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80),
  fetchLinkTitle: vi.fn(), generateContent: vi.fn(),
  extractTextFromUrl: vi.fn(), extractTextFromPdf: vi.fn(),
  extractTextFromDocx: vi.fn(), translateBlogPost: vi.fn(),
}));
vi.mock('../../server/aiTranslation', () => ({
  translateText: vi.fn(), translateContentByLang: vi.fn(),
}));
vi.mock('../../server/blogImageService', () => ({ generateBlogImage: vi.fn() }));
vi.mock('../../server/aiService', () => ({
  callAI: vi.fn(), getAISettings: vi.fn(), decryptApiKey: vi.fn(),
}));

// ─── Production code imports ─────────────────────────────────────────────────
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const TENANT_A = {
  id: 'tenant-a', domain: 'uni-a.edu', universityName: 'University A',
  status: 'yayinda', logoUrl: null, faviconUrl: null,
  googleAnalyticsId: null, googleSearchConsoleCode: null, googleTagManagerId: null,
  facebookUrl: null, instagramUrl: null, linkedinUrl: null, youtubeUrl: null,
  contactFormEmbed: null, heroVideoUrl: null, supportedLanguages: ['en'],
  nameByLang: null, isActive: true, createdAt: new Date(),
};

const TENANT_B = { ...TENANT_A, id: 'tenant-b', domain: 'uni-b.edu', universityName: 'University B' };

const ADMIN_A = {
  id: 'admin-a', tenantId: 'tenant-a', email: 'admin@uni-a.edu',
  passwordHash: 'secret-a', name: 'Admin A', role: 'admin',
  isActive: true, mustChangePassword: false, createdAt: new Date(),
};

const SUPER_ADMIN = {
  id: 'super-1', tenantId: null, email: 'super@platform.com',
  passwordHash: 'secret-super', name: 'Super', role: 'super_admin',
  isActive: true, mustChangePassword: false, createdAt: new Date(),
};

const SECTION_A = {
  id: 'sec-a', tenantId: 'tenant-a', sectionKey: 'hero',
  isEnabled: true, displayOrder: 0, contentByLang: {}, settings: null, createdAt: new Date(),
};

const SECTION_B = {
  id: 'sec-b', tenantId: 'tenant-b', sectionKey: 'hero',
  isEnabled: true, displayOrder: 0, contentByLang: {}, settings: null, createdAt: new Date(),
};

// ─── App (shared for all tests in file) ──────────────────────────────────────
let testApp: express.Application;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
    }
  });
  testApp = app;
});

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(storage.getTenantByHostDomain).mockResolvedValue(TENANT_A as any);
  vi.mocked(storage.getTenant).mockImplementation(async (id: string) =>
    id === 'tenant-b' ? (TENANT_B as any) : (TENANT_A as any)
  );
  vi.mocked(storage.getTenantDomains).mockResolvedValue([]);
  vi.mocked(storage.getAdminByEmail).mockImplementation(async (email: string) => {
    if (email === SUPER_ADMIN.email) return SUPER_ADMIN as any;
    return ADMIN_A as any;
  });
  vi.mocked(storage.getAdminById).mockImplementation(async (id: string) => {
    if (id === SUPER_ADMIN.id) return SUPER_ADMIN as any;
    return ADMIN_A as any;
  });
  vi.mocked(storage.getSections).mockResolvedValue([]);
  vi.mocked(storage.getSection).mockResolvedValue(SECTION_A as any);
  vi.mocked(storage.updateSection).mockResolvedValue({ ...SECTION_A, isEnabled: false } as any);
  vi.mocked(storage.updateSections).mockResolvedValue([SECTION_A] as any);
  vi.mocked(storage.getBlogPosts).mockResolvedValue([]);
  vi.mocked(storage.getBlogPostTranslations).mockResolvedValue([]);
  vi.mocked(storage.getBlogSchedule).mockResolvedValue(null);
  vi.mocked(storage.getMediaAssets).mockResolvedValue([]);
  vi.mocked(storage.getTestimonials).mockResolvedValue([]);
  vi.mocked(storage.getFaqItems).mockResolvedValue([]);
});

// Helper: login and return session cookie
async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(testApp)
    .post('/api/admin/login')
    .send({ email, password });
  expect(res.status, `Login failed (${email}): ${JSON.stringify(res.body)}`).toBe(200);
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Section PATCH IDOR — production routes', () => {
  it('PATCH /api/sections/:id → 404 when section belongs to a different tenant (IDOR blocked)', async () => {
    // Section belongs to tenant-b; admin-a is logged in on tenant-a
    vi.mocked(storage.getSection).mockResolvedValue(SECTION_B as any);

    const cookie = await loginAs('admin@uni-a.edu', 'secret-a');

    const res = await request(testApp)
      .patch(`/api/sections/${SECTION_B.id}`)
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({ isEnabled: false });

    expect(res.status).toBe(404);
    expect(storage.updateSection).not.toHaveBeenCalled();
  });

  it('PATCH /api/sections/:id → 200 when section belongs to the same tenant (normal flow)', async () => {
    // Section belongs to tenant-a; admin-a is logged in on tenant-a
    vi.mocked(storage.getSection).mockResolvedValue(SECTION_A as any);
    vi.mocked(storage.updateSection).mockResolvedValue({ ...SECTION_A, isEnabled: false } as any);

    const cookie = await loginAs('admin@uni-a.edu', 'secret-a');

    const res = await request(testApp)
      .patch(`/api/sections/${SECTION_A.id}`)
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({ isEnabled: false });

    expect(res.status).toBe(200);
    expect(storage.updateSection).toHaveBeenCalledWith(SECTION_A.id, 'tenant-a', expect.anything());
  });

  it('PATCH /api/sections (bulk) → updateSections called with req.tenantId as first arg', async () => {
    const cookie = await loginAs('admin@uni-a.edu', 'secret-a');

    const res = await request(testApp)
      .patch('/api/sections')
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({ sections: [{ id: SECTION_A.id, isEnabled: true }] });

    expect(res.status).toBe(200);
    expect(storage.updateSections).toHaveBeenCalledWith(
      'tenant-a',
      expect.arrayContaining([expect.objectContaining({ id: SECTION_A.id })])
    );
  });

  it('Superadmin with ?_tid=tenant-b can PATCH a tenant-b section (bypass)', async () => {
    // Superadmin is logged in; resolveTenant uses _tid to set tenantId=tenant-b
    vi.mocked(storage.getAdminByEmail).mockResolvedValue(SUPER_ADMIN as any);
    vi.mocked(storage.getAdminById).mockResolvedValue(SUPER_ADMIN as any);
    vi.mocked(storage.getTenantByHostDomain).mockResolvedValue(TENANT_A as any);
    vi.mocked(storage.getSection).mockResolvedValue(SECTION_B as any);
    vi.mocked(storage.updateSection).mockResolvedValue(SECTION_B as any);

    const cookie = await loginAs(SUPER_ADMIN.email, 'secret-super');

    const res = await request(testApp)
      .patch(`/api/sections/${SECTION_B.id}?_tid=tenant-b`)
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({ isEnabled: true });

    expect(res.status).toBe(200);
    // storage.updateSection must be called with tenant-b as tenantId
    expect(storage.updateSection).toHaveBeenCalledWith(SECTION_B.id, 'tenant-b', expect.anything());
  });
});
