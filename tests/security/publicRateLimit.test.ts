/**
 * Regression tests for public API rate limiting.
 *
 * Verifies that:
 *  - Public GET endpoints allow up to 120 requests per minute per IP
 *  - The 121st request from the same IP receives a 429 response
 *  - Admin sessions bypass the rate limiter entirely
 *
 * Tests in this file are order-dependent within each describe block
 * because they intentionally exhaust the rate limit counter.
 * vi.resetAllMocks() is NOT used in beforeEach — mocks are set once
 * in beforeAll and must remain stable across the sequential test flow.
 *
 * Each describe block creates its own fresh Express app so rate limit
 * state is isolated between the two test scenarios.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';

// ─── Mocks ──────────────────────────────────────────────────────────────────

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
    doesImageBelongToTenant: vi.fn(),
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
vi.mock('../../server/aiTranslation', () => ({ translateText: vi.fn(), translateContentByLang: vi.fn() }));
vi.mock('../../server/blogImageService', () => ({ generateBlogImage: vi.fn() }));
vi.mock('../../server/aiService', () => ({ callAI: vi.fn(), getAISettings: vi.fn(), decryptApiKey: vi.fn() }));

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

const ADMIN_A = {
  id: 'admin-a', tenantId: 'tenant-a', email: 'admin@uni-a.edu',
  passwordHash: 'admin-secret', name: 'Admin A', role: 'admin',
  isActive: true, mustChangePassword: false, createdAt: new Date(),
};

// ─── App factory ─────────────────────────────────────────────────────────────
async function buildApp(): Promise<express.Application> {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
    }
  });
  return app;
}

// ─── Suite 1: Rate limit enforcement ────────────────────────────────────────
// Tests run in order and share accumulated rate-limit state across the 3 assertions.
describe('Public API rate limit enforcement', () => {
  let testApp: express.Application;

  beforeAll(async () => {
    testApp = await buildApp();

    // Storage mocks — set once, not reset between tests
    vi.mocked(storage.getTenantByHostDomain).mockResolvedValue(TENANT_A as any);
    vi.mocked(storage.getTenant).mockResolvedValue(TENANT_A as any);
    vi.mocked(storage.getTenantDomains).mockResolvedValue([]);
    vi.mocked(storage.getSections).mockResolvedValue([]);
    vi.mocked(storage.getAdminByEmail).mockResolvedValue(ADMIN_A as any);
    vi.mocked(storage.getAdminById).mockResolvedValue(ADMIN_A as any);
    vi.mocked(storage.updateAdminPassword).mockResolvedValue(undefined);
  });

  it('allows up to 120 requests per minute (120th still returns 200)', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 120; i++) {
      const res = await request(testApp)
        .get('/api/sections')
        .set('Host', 'uni-a.edu');
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(200);
  });

  it('returns 429 on the 121st request (limit exceeded)', async () => {
    const res = await request(testApp)
      .get('/api/sections')
      .set('Host', 'uni-a.edu');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many requests/i);
  });

  it('admin session bypasses the rate limit (200 even after limit is hit)', async () => {
    // Login to get an admin session cookie
    const loginRes = await request(testApp)
      .post('/api/admin/login')
      .send({ email: 'admin@uni-a.edu', password: 'admin-secret' });
    expect(loginRes.status, `Login failed: ${JSON.stringify(loginRes.body)}`).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    const adminCookie = Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');

    // Rate limit is already exhausted for anonymous IP.
    // Admin session should bypass publicReadRateLimit (skip returns true).
    const res = await request(testApp)
      .get('/api/sections')
      .set('Host', 'uni-a.edu')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });
});
