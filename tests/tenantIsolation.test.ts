import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/appFactory';
import { createMockStorage, makeTenant } from './helpers/mockStorage';

describe('tenant data isolation', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    app = createTestApp(mockStorage);
  });

  it('GET /api/sections only returns data for the resolved tenant, not a different one', async () => {
    const tenantA = makeTenant({ id: 'tenant-a', domain: 'uni-a.edu', status: 'yayinda' });
    const tenantB = makeTenant({ id: 'tenant-b', domain: 'uni-b.edu', status: 'yayinda' });

    const sectionsA = [{ id: 'sa1', tenantId: 'tenant-a', sectionKey: 'hero' }];
    const sectionsB = [{ id: 'sb1', tenantId: 'tenant-b', sectionKey: 'contact' }];

    (mockStorage.getTenantByHostDomain as any).mockImplementation((host: string) => {
      if (host === 'uni-a.edu') return Promise.resolve(tenantA);
      if (host === 'uni-b.edu') return Promise.resolve(tenantB);
      return Promise.resolve(undefined);
    });

    (mockStorage.getSections as any).mockImplementation((tenantId: string) => {
      if (tenantId === 'tenant-a') return Promise.resolve(sectionsA);
      if (tenantId === 'tenant-b') return Promise.resolve(sectionsB);
      return Promise.resolve([]);
    });

    const resA = await request(app)
      .get('/api/sections')
      .set('Host', 'uni-a.edu');

    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].tenantId).toBe('tenant-a');
    expect(resA.body[0].sectionKey).toBe('hero');

    const resB = await request(app)
      .get('/api/sections')
      .set('Host', 'uni-b.edu');

    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].tenantId).toBe('tenant-b');
    expect(resB.body[0].sectionKey).toBe('contact');
  });

  it('GET /api/blog scopes published posts to the resolved tenant', async () => {
    const tenantA = makeTenant({ id: 'tenant-a', domain: 'uni-a.edu', status: 'yayinda' });
    const tenantB = makeTenant({ id: 'tenant-b', domain: 'uni-b.edu', status: 'yayinda' });

    (mockStorage.getTenantByHostDomain as any).mockImplementation((host: string) => {
      if (host === 'uni-a.edu') return Promise.resolve(tenantA);
      if (host === 'uni-b.edu') return Promise.resolve(tenantB);
      return Promise.resolve(undefined);
    });

    (mockStorage.getPublishedBlogPosts as any).mockImplementation((tenantId: string) => {
      if (tenantId === 'tenant-a') return Promise.resolve([{ post: { id: 'pa1', tenantId: 'tenant-a' }, translation: { lang: 'en' } }]);
      if (tenantId === 'tenant-b') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const resA = await request(app)
      .get('/api/blog')
      .set('Host', 'uni-a.edu');

    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].post.tenantId).toBe('tenant-a');

    const resB = await request(app)
      .get('/api/blog')
      .set('Host', 'uni-b.edu');

    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });

  /**
   * IDOR DOCUMENTATION TEST
   *
   * The /api/img/:id endpoint in production (server/routes.ts:217) does NOT
   * check whether the requested image UUID belongs to the resolved tenant.
   * Any client that knows (or guesses) a UUID can access it from any host.
   *
   * This test documents the current behavior — it passes because the production
   * code intentionally serves the file without a tenant check.
   *
   * See: tests/FINDINGS.md — FINDING-001
   */
  it('[IDOR-DOC] /api/img/:id is accessible without tenant ownership check', async () => {
    const res = await request(app)
      .get('/api/img/some-uuid-from-another-tenant');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('some-uuid-from-another-tenant');
  });
});
