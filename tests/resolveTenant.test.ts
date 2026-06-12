import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/appFactory';
import { createMockStorage, makeTenant } from './helpers/mockStorage';

describe('resolveTenant middleware', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    app = createTestApp(mockStorage);
  });

  it('resolves the correct tenant from a known host', async () => {
    const tenant = makeTenant({ id: 'okan-1', domain: 'okan.edu.tr', status: 'yayinda' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);
    (mockStorage.getSections as any).mockResolvedValue([{ id: 's1', sectionKey: 'hero' }]);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'okan.edu.tr');

    expect(res.status).toBe(200);
    expect(mockStorage.getTenantByHostDomain).toHaveBeenCalledWith('okan.edu.tr');
    expect(mockStorage.getSections).toHaveBeenCalledWith('okan-1');
  });

  it('strips www. prefix before resolving tenant', async () => {
    const tenant = makeTenant({ id: 'okan-1', domain: 'okan.edu.tr', status: 'yayinda' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);
    (mockStorage.getSections as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'www.okan.edu.tr');

    expect(res.status).toBe(200);
    expect(mockStorage.getTenantByHostDomain).toHaveBeenCalledWith('okan.edu.tr');
  });

  it('strips port number before resolving tenant', async () => {
    const tenant = makeTenant({ id: 'okan-1', domain: 'okan.edu.tr', status: 'yayinda' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(tenant);
    (mockStorage.getSections as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'www.okan.edu.tr:3000');

    expect(res.status).toBe(200);
    expect(mockStorage.getTenantByHostDomain).toHaveBeenCalledWith('okan.edu.tr');
  });

  it('falls back to default tenant on localhost (dev host)', async () => {
    const defaultTenant = makeTenant({ id: 'default', domain: 'localhost', status: 'yayinda' });
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(undefined);
    (mockStorage.getTenant as any).mockResolvedValue(defaultTenant);
    (mockStorage.getSections as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'localhost');

    expect(res.status).toBe(200);
    expect(mockStorage.getTenant).toHaveBeenCalledWith('default');
  });

  it('returns 404 for completely unknown production domain', async () => {
    (mockStorage.getTenantByHostDomain as any).mockResolvedValue(undefined);

    const res = await request(app)
      .get('/api/sections')
      .set('Host', 'unknown-university.com');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Tenant not found' });
  });
});
