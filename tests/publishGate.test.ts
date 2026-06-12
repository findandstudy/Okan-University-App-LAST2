import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/appFactory';
import { createMockStorage, makeTenant, makeAdmin } from './helpers/mockStorage';

describe('publish gate (requirePublished)', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    app = createTestApp(mockStorage);
  });

  it('blocks public access to a draft tenant with 404 + coming_soon', async () => {
    const tenant = makeTenant({ id: 'draft-1', domain: 'draft.uni.com', status: 'taslak' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'draft.uni.com');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'coming_soon' });
  });

  it('blocks public access to a suspended tenant with 404 + coming_soon', async () => {
    const tenant = makeTenant({ id: 'suspended-1', domain: 'susp.uni.com', status: 'durduruldu' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'susp.uni.com');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'coming_soon' });
  });

  it('serves public content for a published tenant', async () => {
    const tenant = makeTenant({ id: 'live-1', domain: 'live.uni.com', status: 'yayinda' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);
    (mockStorage.getSections as any).mockResolvedValue([
      { id: 's1', sectionKey: 'hero', isEnabled: true },
    ]);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'live.uni.com');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('allows an authenticated admin to preview a draft tenant', async () => {
    const tenant = makeTenant({ id: 'draft-1', domain: 'draft.uni.com', status: 'taslak' });
    const admin = makeAdmin({ id: 'admin-1', tenantId: 'draft-1' });

    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);
    (mockStorage.getSections as any).mockResolvedValue([{ id: 's1', sectionKey: 'hero' }]);
    (mockStorage.getAdminByEmail as any).mockResolvedValue(admin);

    const agent = request.agent(app);

    await agent
      .post('/api/admin/login')
      .send({ email: admin.email, password: 'plain-secret' });

    const res = await agent
      .get('/api/sections')
      .set('Host', 'draft.uni.com');

    expect(res.status).toBe(200);
  });
});
