import { vi } from 'vitest';
import type { IStorage } from '../../server/storage';

export function createMockStorage(): IStorage {
  return {
    getTenant: vi.fn().mockResolvedValue(undefined),
    getTenantByDomain: vi.fn().mockResolvedValue(undefined),
    getTenantByHostDomain: vi.fn().mockResolvedValue(undefined),
    getAllTenants: vi.fn().mockResolvedValue([]),
    createTenant: vi.fn(),
    updateTenant: vi.fn(),
    deleteTenant: vi.fn(),

    getTenantDomains: vi.fn().mockResolvedValue([]),
    createTenantDomain: vi.fn(),
    deleteTenantDomain: vi.fn(),

    getAdminById: vi.fn().mockResolvedValue(undefined),
    getAdminByEmail: vi.fn().mockResolvedValue(undefined),
    createAdminUser: vi.fn(),
    updateAdminPassword: vi.fn().mockResolvedValue(undefined),

    getSections: vi.fn().mockResolvedValue([]),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    updateSections: vi.fn().mockResolvedValue([]),
    deleteSection: vi.fn(),

    getTheme: vi.fn().mockResolvedValue(undefined),
    createTheme: vi.fn(),
    updateTheme: vi.fn(),

    getMediaAssets: vi.fn().mockResolvedValue([]),
    getMediaAsset: vi.fn().mockResolvedValue(undefined),
    createMediaAsset: vi.fn(),
    deleteMediaAsset: vi.fn(),

    getTestimonials: vi.fn().mockResolvedValue([]),
    getTestimonial: vi.fn().mockResolvedValue(undefined),
    createTestimonial: vi.fn(),
    updateTestimonial: vi.fn(),
    deleteTestimonial: vi.fn(),

    getFaqItems: vi.fn().mockResolvedValue([]),
    getFaqItem: vi.fn().mockResolvedValue(undefined),
    createFaqItem: vi.fn(),
    updateFaqItem: vi.fn(),
    deleteFaqItem: vi.fn(),

    getSeoSettings: vi.fn().mockResolvedValue(undefined),
    createSeoSettings: vi.fn(),
    updateSeoSettings: vi.fn(),

    getWidgets: vi.fn().mockResolvedValue([]),
    getWidget: vi.fn().mockResolvedValue(undefined),
    createWidget: vi.fn(),
    updateWidget: vi.fn(),
    deleteWidget: vi.fn(),

    getAISettings: vi.fn().mockResolvedValue(null),
    saveAISettings: vi.fn().mockResolvedValue(undefined),

    getBlogPosts: vi.fn().mockResolvedValue([]),
    getBlogPost: vi.fn().mockResolvedValue(undefined),
    createBlogPost: vi.fn(),
    updateBlogPost: vi.fn().mockResolvedValue(undefined),
    deleteBlogPost: vi.fn(),

    getBlogPostTranslations: vi.fn().mockResolvedValue([]),
    getBlogPostTranslationBySlug: vi.fn().mockResolvedValue(undefined),
    getPublishedBlogPosts: vi.fn().mockResolvedValue([]),
    upsertBlogPostTranslation: vi.fn(),
    deleteBlogPostTranslations: vi.fn().mockResolvedValue(undefined),

    getBlogPostImages: vi.fn().mockResolvedValue([]),
    addBlogPostImage: vi.fn(),
    deleteBlogPostImage: vi.fn(),
    updateBlogPostFeaturedImage: vi.fn(),

    getBlogSchedule: vi.fn().mockResolvedValue(undefined),
    upsertBlogSchedule: vi.fn(),

    getSiteVersions: vi.fn().mockResolvedValue([]),
    getSiteVersion: vi.fn().mockResolvedValue(undefined),
    createSiteVersion: vi.fn(),
    deleteSiteVersion: vi.fn(),
    pruneOldVersions: vi.fn().mockResolvedValue(undefined),
  } as unknown as IStorage;
}

export function makeTenant(overrides: Partial<{
  id: string; domain: string; universityName: string; status: string;
}> = {}) {
  return {
    id: overrides.id ?? 'tenant-a',
    domain: overrides.domain ?? 'uni-a.edu',
    universityName: overrides.universityName ?? 'University A',
    status: overrides.status ?? 'yayinda',
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
}

export function makeAdmin(overrides: Partial<{
  id: string; tenantId: string | null; email: string; passwordHash: string; role: string;
}> = {}) {
  return {
    id: overrides.id ?? 'admin-1',
    tenantId: overrides.tenantId ?? 'tenant-a',
    email: overrides.email ?? 'admin@uni-a.edu',
    passwordHash: overrides.passwordHash ?? 'plain-secret',
    name: 'Test Admin',
    role: overrides.role ?? 'admin',
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
  };
}
