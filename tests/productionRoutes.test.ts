/**
 * Production routes integration tests.
 *
 * These tests import and exercise the ACTUAL server/routes.ts with all
 * external dependencies mocked. This verifies the real middleware composition
 * and route wiring — not a re-implementation.
 *
 * Key design choices:
 * - connect-pg-simple returns express-session's own MemoryStore so session
 *   serialisation/deserialisation is handled correctly.
 * - vi.resetAllMocks() in beforeEach guarantees clean state even if vitest's
 *   version-specific clearAllMocks behaviour differs.
 * - A catch-all JSON error handler is appended to the test app so that errors
 *   that bubble past route try-catches (e.g. unhandled async middleware throws)
 *   still produce JSON responses, making assertions stable.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';

// ─── 1. connect-pg-simple → express-session MemoryStore ───────────────────
// This avoids JSON serialisation issues with cookie Date objects.
vi.mock('connect-pg-simple', () => ({
  default: (expressSession: any) => expressSession.MemoryStore,
}));

// ─── 2. Database connection ────────────────────────────────────────────────
vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

// ─── 3. Storage singleton ──────────────────────────────────────────────────
vi.mock('../server/storage', () => ({
  storage: {
    getTenantByHostDomain: vi.fn(),
    getTenant: vi.fn(),
    getTenantDomains: vi.fn(),
    getAdminById: vi.fn(),
    getAdminByEmail: vi.fn(),
    updateAdminPassword: vi.fn(),
    getSections: vi.fn(),
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
    createSection: vi.fn(),
    getSection: vi.fn(),
    updateSection: vi.fn(),
    updateSections: vi.fn(),
    deleteSection: vi.fn(),
  },
}));

// ─── 4. Blog scheduler ─────────────────────────────────────────────────────
vi.mock('../server/blogScheduler', () => ({
  startBlogScheduler: vi.fn(),
}));

// ─── 5. Zip exporter ───────────────────────────────────────────────────────
vi.mock('../server/zipExporter', () => ({
  startExportJob: vi.fn(),
  getExportJob: vi.fn(),
  captureSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
}));

// ─── 6. Local file storage ─────────────────────────────────────────────────
vi.mock('../server/localFileStorage', () => ({
  saveUpload: vi.fn(),
  readUpload: vi.fn(),
  serveUpload: vi.fn(),
  getUploadsDir: vi.fn().mockReturnValue('/tmp/test-uploads'),
  deleteUpload: vi.fn(),
}));

// ─── 7. Sharp ──────────────────────────────────────────────────────────────
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('compressed')),
  }),
}));

// ─── 8. Content generator ──────────────────────────────────────────────────
vi.mock('../server/contentGenerator', () => ({
  generateBlogPost: vi.fn(),
  toSlug: (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80),
  fetchLinkTitle: vi.fn(),
  generateContent: vi.fn(),
  extractTextFromUrl: vi.fn(),
  extractTextFromPdf: vi.fn(),
  extractTextFromDocx: vi.fn(),
  translateBlogPost: vi.fn(),
}));

// ─── 9. AI translation ─────────────────────────────────────────────────────
vi.mock('../server/aiTranslation', () => ({
  translateText: vi.fn(),
  translateContentByLang: vi.fn(),
}));

// ─── 10. Blog image service (dynamic import in route handler) ──────────────
vi.mock('../server/blogImageService', () => ({
  generateBlogImage: vi.fn(),
}));

// ─── 11. AI service ────────────────────────────────────────────────────────
vi.mock('../server/aiService', () => ({
  callAI: vi.fn(),
  getAISettings: vi.fn(),
  decryptApiKey: vi.fn(),
}));

// ─── Import production code AFTER all vi.mock() declarations ───────────────
import { registerRoutes } from '../server/routes';
import { storage } from '../server/storage';
import { generateBlogPost } from '../server/contentGenerator';

// ─── Fixtures ──────────────────────────────────────────────────────────────
const TENANT_A = {
  id: 'tenant-a',
  domain: 'uni-a.edu',
  universityName: 'University A',
  status: 'yayinda',
  logoUrl: null,
  faviconUrl: null,
  googleAnalyticsId: null,
  googleSearchConsoleCode: null,
  googleTagManagerId: null,
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  youtubeUrl: null,
  contactFormEmbed: null,
  heroVideoUrl: null,
  supportedLanguages: ['en'],
  nameByLang: null,
  isActive: true,
  createdAt: new Date(),
};

const ADMIN_A = {
  id: 'admin-a',
  tenantId: 'tenant-a',
  email: 'admin@uni-a.edu',
  passwordHash: 'plain-secret',
  name: 'Admin A',
  role: 'admin',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date(),
};

// ─── App factory ───────────────────────────────────────────────────────────
// One app instance shared across all tests in this file.
// A catch-all JSON error handler is appended so that async middleware errors
// (which Express 5 passes to next(err)) produce JSON instead of HTML,
// making response body assertions stable.
let testApp: express.Application;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Catch-all fallback: turn unhandled Express errors into JSON responses
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
    }
  });

  testApp = app;
});

// ─── Shared mock setup ─────────────────────────────────────────────────────
// Reset ALL mocks before each test so that stale return values from a previous
// test do not bleed through. Then re-establish the safe defaults needed for
// the middleware stack (resolveTenant, requireAdminTenantAccess, login).
beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(storage.getTenantByHostDomain).mockResolvedValue(TENANT_A as any);
  vi.mocked(storage.getTenant).mockResolvedValue(TENANT_A as any);
  vi.mocked(storage.getTenantDomains).mockResolvedValue([]);
  vi.mocked(storage.getAdminByEmail).mockResolvedValue(ADMIN_A as any);
  vi.mocked(storage.getAdminById).mockResolvedValue(ADMIN_A as any);
  vi.mocked(storage.updateAdminPassword).mockResolvedValue(undefined);
  vi.mocked(storage.getBlogPosts).mockResolvedValue([]);
  vi.mocked(storage.getBlogPostTranslations).mockResolvedValue([]);
  vi.mocked(storage.updateBlogPost).mockResolvedValue({ id: 'post-1' } as any);
  vi.mocked(storage.upsertBlogPostTranslation).mockResolvedValue({ id: 'tr-1' } as any);
  vi.mocked(storage.getBlogSchedule).mockResolvedValue(null);
  vi.mocked(storage.getSections).mockResolvedValue([]);
  vi.mocked(storage.getMediaAssets).mockResolvedValue([]);
  vi.mocked(storage.getTestimonials).mockResolvedValue([]);
  vi.mocked(storage.getFaqItems).mockResolvedValue([]);
});

// Helper: log in and return the session cookie string
async function loginAsAdminA(): Promise<string> {
  const res = await request(testApp)
    .post('/api/admin/login')
    .send({ email: 'admin@uni-a.edu', password: 'plain-secret' });
  expect(res.status, `Login failed: ${JSON.stringify(res.body)}`).toBe(200);
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');
}

// ─── Suite 1: Blog generation crash path ─────────────────────────────────
describe('Blog generation crash path — production routes', () => {
  it('returns 500 and calls updateBlogPost({status:"failed"}) when generateBlogPost throws', async () => {
    const postId = 'post-crash-1';
    vi.mocked(storage.getBlogPost).mockResolvedValue({
      id: postId,
      tenantId: 'tenant-a',
      status: 'taslak',
      keyword: 'university application',
      backlinkSites: [],
      isAiGenerated: false,
      featuredImageUrl: null,
      publishAt: null,
      createdAt: new Date(),
    } as any);
    vi.mocked(generateBlogPost).mockRejectedValue(new Error('AI quota exceeded'));

    const cookie = await loginAsAdminA();

    const res = await request(testApp)
      .post(`/api/admin/blog/${postId}/generate`)
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(500);
    expect(storage.updateBlogPost).toHaveBeenCalledWith(postId, { status: 'failed' });
  });

  it('returns 404 (not 500) when post belongs to a different tenant', async () => {
    vi.mocked(storage.getBlogPost).mockResolvedValue({
      id: 'post-other',
      tenantId: 'tenant-b',
      status: 'taslak',
      keyword: 'test',
      backlinkSites: [],
      isAiGenerated: false,
      featuredImageUrl: null,
      publishAt: null,
      createdAt: new Date(),
    } as any);

    const cookie = await loginAsAdminA();

    const res = await request(testApp)
      .post('/api/admin/blog/post-other/generate')
      .set('Host', 'uni-a.edu')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(404);
    expect(storage.updateBlogPost).not.toHaveBeenCalledWith('post-other', { status: 'failed' });
  });
});

// ─── Suite 2: Middleware composition ─────────────────────────────────────
describe('Middleware composition — production routes', () => {
  it('GET /api/sections → 404 coming_soon for draft tenant (resolveTenant + requirePublished)', async () => {
    vi.mocked(storage.getTenantByHostDomain).mockResolvedValue({
      ...TENANT_A,
      status: 'taslak',
    } as any);

    const res = await request(testApp)
      .get('/api/sections')
      .set('Host', 'uni-a.edu');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'coming_soon' });
  });

  it('GET /api/sections → 200 for published tenant (requirePublished pass)', async () => {
    vi.mocked(storage.getSections).mockResolvedValue([
      { id: 's1', sectionKey: 'hero', isEnabled: true } as any,
    ]);

    const res = await request(testApp)
      .get('/api/sections')
      .set('Host', 'uni-a.edu');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/admin/me → 401 when unauthenticated (requireAdmin gate)', async () => {
    const res = await request(testApp).get('/api/admin/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('POST /api/admin/login + GET /api/admin/me → 200 round-trip (session persistence)', async () => {
    const cookie = await loginAsAdminA();

    const meRes = await request(testApp)
      .get('/api/admin/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('admin@uni-a.edu');
  });

  it('Admin from tenant-a is denied access to tenant-b resources → 403 (requireAdminTenantAccess)', async () => {
    const tenantB = { ...TENANT_A, id: 'tenant-b', domain: 'uni-b.edu' };
    vi.mocked(storage.getTenantByHostDomain).mockResolvedValue(tenantB as any);

    const cookie = await loginAsAdminA();

    const res = await request(testApp)
      .get('/api/admin/blog')
      .set('Host', 'uni-b.edu')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });
});
