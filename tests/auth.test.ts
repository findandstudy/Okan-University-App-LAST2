import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createTestApp } from './helpers/appFactory';
import { createMockStorage, makeTenant, makeAdmin } from './helpers/mockStorage';

describe('authentication flow', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    app = createTestApp(mockStorage);
  });

  it('login succeeds with valid bcrypt password and returns admin info', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    const admin = makeAdmin({ passwordHash: hash });
    (mockStorage.getAdminByEmail as any).mockResolvedValue(admin);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: admin.email, password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.admin.email).toBe(admin.email);
  });

  it('login succeeds with legacy plain-text password', async () => {
    const admin = makeAdmin({ passwordHash: 'plain-secret' });
    (mockStorage.getAdminByEmail as any).mockResolvedValue(admin);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: admin.email, password: 'plain-secret' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('login fails with incorrect password → 401', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    const admin = makeAdmin({ passwordHash: hash });
    (mockStorage.getAdminByEmail as any).mockResolvedValue(admin);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: admin.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('login fails for non-existent email → 401', async () => {
    (mockStorage.getAdminByEmail as any).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'ghost@nowhere.com', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('requireAdmin returns 401 on unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
  });

  it('requireAdmin allows access after successful login (session cookie)', async () => {
    const hash = await bcrypt.hash('secret', 10);
    const admin = makeAdmin({ passwordHash: hash });
    (mockStorage.getAdminByEmail as any).mockResolvedValue(admin);
    (mockStorage.getAdminById as any).mockResolvedValue(admin);

    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/admin/login')
      .send({ email: admin.email, password: 'secret' });
    expect(loginRes.status).toBe(200);

    const meRes = await agent.get('/api/admin/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(admin.email);
  });
});

describe('admin tenant access guard (requireAdminTenantAccess)', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    app = createTestApp(mockStorage);
  });

  it('regular admin can access their own tenant stats', async () => {
    const adminUser = makeAdmin({ id: 'admin-a', tenantId: 'tenant-a', role: 'admin' });
    const tenant = makeTenant({ id: 'tenant-a', domain: 'uni-a.edu', status: 'yayinda' });

    (mockStorage.getAdminByEmail as any).mockResolvedValue(adminUser);
    (mockStorage.getAdminById as any).mockResolvedValue(adminUser);
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);

    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ email: adminUser.email, password: 'plain-secret' });

    const res = await agent
      .get('/api/admin/stats')
      .set('Host', 'uni-a.edu');

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('tenant-a');
  });

  it('regular admin cannot access a different tenant → 403', async () => {
    const adminUser = makeAdmin({ id: 'admin-a', tenantId: 'tenant-a', role: 'admin' });
    const tenantB = makeTenant({ id: 'tenant-b', domain: 'uni-b.edu', status: 'yayinda' });

    (mockStorage.getAdminByEmail as any).mockResolvedValue(adminUser);
    (mockStorage.getAdminById as any).mockResolvedValue(adminUser);
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenantB);

    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ email: adminUser.email, password: 'plain-secret' });

    const res = await agent
      .get('/api/admin/stats')
      .set('Host', 'uni-b.edu');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  it('super_admin can access any tenant', async () => {
    const superAdmin = makeAdmin({ id: 'super-1', tenantId: null, role: 'super_admin' });
    const tenantB = makeTenant({ id: 'tenant-b', domain: 'uni-b.edu', status: 'yayinda' });

    (mockStorage.getAdminByEmail as any).mockResolvedValue(superAdmin);
    (mockStorage.getAdminById as any).mockResolvedValue(superAdmin);
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenantB);

    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ email: superAdmin.email, password: 'plain-secret' });

    const res = await agent
      .get('/api/admin/stats')
      .set('Host', 'uni-b.edu');

    expect(res.status).toBe(200);
  });
});
