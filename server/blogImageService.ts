/**
 * Blog Image Service — Faz 10
 * Sources: ai_openai (DALL-E), stock_unsplash, stock_pexels, media_library
 * All images are downloaded, WebP-optimised (1200×630), and stored locally.
 * GUARDRAIL: AI prompts never request real campus / university building / logo images.
 */
import { db } from './db';
import { integrationSettings } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { decryptApiKey } from './aiService';
import { translateText } from './aiTranslation';
import { saveUpload } from './localFileStorage';
import { SUPPORTED_LANGUAGES } from '@shared/schema';
import type { SupportedLanguage } from '@shared/schema';

// ── Types ──────────────────────────────────────────────────────────────────

export type ImageSource = 'ai_openai' | 'stock_unsplash' | 'stock_pexels' | 'media_library';

export interface ImageConfig {
  source: ImageSource;
  encryptedApiKey?: string;
  model?: string;
}

export interface GeneratedImage {
  url: string;
  altByLang: Record<SupportedLanguage, string>;
  source: ImageSource;
  attribution?: string;
}

// ── Config helpers ─────────────────────────────────────────────────────────

export async function getImageConfig(tenantId: string): Promise<ImageConfig | null> {
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(and(
      eq(integrationSettings.tenantId, tenantId),
      eq(integrationSettings.integrationType, 'image'),
    ));
  if (!row?.settings) return null;
  return row.settings as ImageConfig;
}

export async function saveImageConfig(tenantId: string, config: ImageConfig): Promise<void> {
  const existing = await getImageConfig(tenantId);
  if (existing) {
    await db.update(integrationSettings)
      .set({ settings: config as any, isEnabled: true })
      .where(and(
        eq(integrationSettings.tenantId, tenantId),
        eq(integrationSettings.integrationType, 'image'),
      ));
  } else {
    await db.insert(integrationSettings).values({
      tenantId,
      integrationType: 'image',
      isEnabled: true,
      settings: config as any,
    });
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function downloadAndSaveWebP(imageUrl: string, name: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniversityBlogBot/1.0)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const webpBuffer = await sharp(buffer)
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toBuffer();
  return saveUpload(webpBuffer, `${name}.webp`);
}

// CRITICAL GUARDRAIL: prompts must never reference a real campus/building/logo.
// Use only generic educational / thematic visuals.
const SAFE_BASE_THEMES = [
  'diverse students studying together in a bright modern library',
  'open textbooks and a laptop on a wooden desk with warm lighting',
  'young professionals collaborating around a table with notebooks',
  'a graduation cap resting on stacked books with a diploma',
  'colorful world map with travel pins representing international education',
  'hands writing in a notebook next to a coffee cup and a plant',
  'a desk with a glowing computer screen showing charts and data',
  'group of cheerful university students walking outdoors on a sunny day',
];

function buildDallePrompt(keyword: string): string {
  const base = SAFE_BASE_THEMES[Math.floor(Math.random() * SAFE_BASE_THEMES.length)];
  return (
    `A professional, high-quality editorial photograph: ${base}. ` +
    `The image should evoke the theme of: ${keyword}. ` +
    `Style: clean, modern, warm tones, magazine quality. ` +
    `IMPORTANT: No text overlays, no university logos, no specific building facades, ` +
    `no identifiable campus architecture. Horizontal 16:9 composition.`
  );
}

async function generateAltTexts(
  title: string,
  keyword: string,
  tenantId: string,
): Promise<Record<SupportedLanguage, string>> {
  const fallback = (): Record<SupportedLanguage, string> => {
    const obj: Record<string, string> = {};
    SUPPORTED_LANGUAGES.forEach(l => { obj[l] = title; });
    return obj as Record<SupportedLanguage, string>;
  };

  try {
    const { callAI } = await import('./aiService');
    const prompt =
      `Generate a concise, SEO-optimized image alt text (under 120 characters) ` +
      `for a blog featured image. Topic: "${title}", keyword: "${keyword}". ` +
      `Return ONLY the alt text string, no quotes, no explanation.`;
    const enAlt = (await callAI(prompt, tenantId)).trim().replace(/^["'`]|["'`]$/g, '');
    const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en') as SupportedLanguage[];
    const translations = await translateText(enAlt, 'en', otherLangs, tenantId);
    const result: Record<string, string> = { en: enAlt };
    for (const l of otherLangs) {
      result[l] = translations[l] || enAlt;
    }
    return result as Record<SupportedLanguage, string>;
  } catch {
    return fallback();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function generateBlogImage(
  title: string,
  keyword: string,
  tenantId: string,
): Promise<GeneratedImage | null> {
  const config = await getImageConfig(tenantId);
  if (!config || config.source === 'media_library') return null;

  const slug = keyword.replace(/[^a-z0-9]+/gi, '-').toLowerCase().substring(0, 30);
  const altByLang = await generateAltTexts(title, keyword, tenantId);

  try {
    // ── OpenAI DALL-E ──────────────────────────────────────────────────────
    if (config.source === 'ai_openai') {
      if (!config.encryptedApiKey) {
        console.warn('[BlogImageService] ai_openai: no API key configured');
        return null;
      }
      const apiKey = decryptApiKey(config.encryptedApiKey);
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey });

      const buildParams = (model: string): Record<string, any> => ({
        model,
        prompt: buildDallePrompt(keyword),
        n: 1,
        size: model === 'dall-e-3' ? '1792x1024' : '1024x1024',
        ...(model === 'dall-e-3' ? { quality: 'standard' } : {}),
      });

      // Try configured model; auto-fall-back to dall-e-3 if model is unavailable
      let dalleModel = config.model || 'dall-e-3';
      let resp;
      try {
        resp = await client.images.generate(buildParams(dalleModel) as any);
      } catch (modelErr: any) {
        const combinedMsg = ((modelErr?.message || '') + ' ' + (modelErr?.error?.message || '')).toLowerCase();
        const isModelGone = modelErr?.status === 404 ||
          combinedMsg.includes('does not exist') ||
          combinedMsg.includes('model_not_found') ||
          combinedMsg.includes('no such model');
        if (isModelGone && dalleModel !== 'dall-e-3') {
          console.warn(`[BlogImageService] Model "${dalleModel}" unavailable, retrying with dall-e-3`);
          dalleModel = 'dall-e-3';
          resp = await client.images.generate(buildParams('dall-e-3') as any);
        } else if (isModelGone) {
          // Both models unavailable → likely key has no DALL-E permission
          throw new Error(
            `DALL-E models are not available for this API key. ` +
            `In the OpenAI dashboard, enable image generation for your project ` +
            `(Platform → Your Project → Settings → Model access), or use an unrestricted API key.`
          );
        } else {
          throw modelErr;
        }
      }

      const imageUrl = resp.data?.[0]?.url;
      if (!imageUrl) return null;
      const savedUrl = await downloadAndSaveWebP(imageUrl, `blog-ai-${slug}`);
      return { url: savedUrl, altByLang, source: 'ai_openai' };
    }

    // ── Unsplash ───────────────────────────────────────────────────────────
    if (config.source === 'stock_unsplash') {
      if (!config.encryptedApiKey) return null;
      const apiKey = decryptApiKey(config.encryptedApiKey);
      const query = encodeURIComponent(keyword);
      const resp = await fetch(
        `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`,
        {
          headers: { Authorization: `Client-ID ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!resp.ok) {
        console.warn('[BlogImageService] Unsplash API error:', resp.status, await resp.text());
        return null;
      }
      const photo = await resp.json() as any;
      const rawUrl: string | undefined = photo.urls?.regular || photo.urls?.full;
      if (!rawUrl) return null;
      const savedUrl = await downloadAndSaveWebP(rawUrl, `blog-unsplash-${slug}`);
      const attribution = photo.user?.name
        ? `Photo by ${photo.user.name} on Unsplash`
        : 'Photo from Unsplash';
      return { url: savedUrl, altByLang, source: 'stock_unsplash', attribution };
    }

    // ── Pexels ─────────────────────────────────────────────────────────────
    if (config.source === 'stock_pexels') {
      if (!config.encryptedApiKey) return null;
      const apiKey = decryptApiKey(config.encryptedApiKey);
      const query = encodeURIComponent(keyword);
      const resp = await fetch(
        `https://api.pexels.com/v1/search?query=${query}&orientation=landscape&per_page=8&page=1`,
        {
          headers: { Authorization: apiKey },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!resp.ok) {
        console.warn('[BlogImageService] Pexels API error:', resp.status, await resp.text());
        return null;
      }
      const data = await resp.json() as any;
      const photos: any[] = data.photos || [];
      if (!photos.length) return null;
      const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];
      const rawUrl: string | undefined = photo.src?.large2x || photo.src?.original;
      if (!rawUrl) return null;
      const savedUrl = await downloadAndSaveWebP(rawUrl, `blog-pexels-${slug}`);
      const attribution = photo.photographer
        ? `Photo by ${photo.photographer} on Pexels`
        : 'Photo from Pexels';
      return { url: savedUrl, altByLang, source: 'stock_pexels', attribution };
    }
  } catch (err: any) {
    const msg = err?.error?.message || err?.message || String(err);
    console.error('[BlogImageService] Image generation failed:', msg);
    throw new Error(`Image generation failed: ${msg}`);
  }

  return null;
}
