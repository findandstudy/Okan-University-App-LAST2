import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/aiService', () => ({
  callAI: vi.fn(),
}));

import { callAI } from '../server/aiService';
import { translateText, translateContentByLang } from '../server/aiTranslation';
import { translateBlogPost, toSlug, type BlogContent } from '../server/contentGenerator';

describe('translateText — crash protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when callAI throws — process does not crash', async () => {
    (callAI as any).mockRejectedValue(new Error('AI service unavailable'));

    const result = await translateText('Hello world', 'en', ['tr', 'ar'], 'tenant-1');

    expect(result).toEqual({});
  });

  it('returns empty object when AI response contains no JSON', async () => {
    (callAI as any).mockResolvedValue('I am unable to translate at this time.');

    const result = await translateText('Hello world', 'en', ['tr'], 'tenant-1');

    expect(result).toEqual({});
  });

  it('returns translations when AI responds with valid JSON', async () => {
    (callAI as any).mockResolvedValue('{"tr":"Merhaba dünya","ar":"مرحبا بالعالم"}');

    const result = await translateText('Hello world', 'en', ['tr', 'ar'], 'tenant-1');

    expect(result).toMatchObject({ tr: 'Merhaba dünya', ar: 'مرحبا بالعالم' });
  });
});

describe('translateBlogPost — partial failure resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes without crashing when all translations fail; falls back to English content', async () => {
    (callAI as any).mockRejectedValue(new Error('AI quota exceeded'));

    const enContent: BlogContent = {
      title: 'How to Apply',
      slug: 'how-to-apply',
      content: 'Full article content here.',
      metaTitle: 'How to Apply | University',
      metaDesc: 'Learn how to apply',
    };

    const results = await translateBlogPost(enContent, ['tr', 'fr'], 'tenant-1');

    expect(results).toBeDefined();
    expect(results['tr']).toBeDefined();
    expect(results['fr']).toBeDefined();

    expect(results['tr'].title).toBe('How to Apply');
    expect(results['tr'].content).toBe('Full article content here.');
  });

  it('uses translated values for fields that succeed while keeping originals for failed fields', async () => {
    let callCount = 0;
    (callAI as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve('{"tr":"Nasıl Başvurulur"}');
      return Promise.reject(new Error('Quota'));
    });

    const enContent: BlogContent = {
      title: 'How to Apply',
      slug: 'how-to-apply',
      content: 'Full content.',
      metaTitle: 'How to Apply',
      metaDesc: 'Meta description',
    };

    const results = await translateBlogPost(enContent, ['tr'], 'tenant-1');

    expect(results['tr'].title).toBe('Nasıl Başvurulur');
    expect(results['tr'].content).toBe('Full content.');
  });
});

describe('toSlug utility', () => {
  it('converts a title to a URL-safe slug', () => {
    expect(toSlug('How to Apply for University 2025')).toBe('how-to-apply-for-university-2025');
  });

  it('handles special characters gracefully', () => {
    const slug = toSlug('Üniversiteye Başvuru Rehberi!');
    expect(slug).not.toContain(' ');
    expect(slug).not.toContain('!');
  });

  it('truncates slugs longer than 80 chars', () => {
    const longTitle = 'A'.repeat(100);
    expect(toSlug(longTitle).length).toBeLessThanOrEqual(80);
  });
});
