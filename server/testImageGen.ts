/**
 * Standalone image-generation diagnostic.
 * Run: npx tsx server/testImageGen.ts [tenantId]
 *
 * Reads the encrypted OpenAI key from the DB (same path as blogImageService),
 * then tries every known image model and prints the full error or success URL.
 */
import { db } from './db';
import { integrationSettings } from '../shared/schema';
import { and, eq } from 'drizzle-orm';
import { decryptApiKey } from './aiService';

const TENANT_ID = process.argv[2] || 'default';

const MODELS_TO_TRY = [
  { model: 'dall-e-2', size: '1024x1024' as const },
  { model: 'dall-e-3', size: '1792x1024' as const, quality: 'standard' as const },
  { model: 'gpt-image-1', size: '1024x1024' as const },
];

async function main() {
  console.log(`\n🔍 Image generation diagnostic — tenant: ${TENANT_ID}\n`);

  // 1. Load config from DB
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(and(
      eq(integrationSettings.tenantId, TENANT_ID),
      eq(integrationSettings.integrationType, 'image'),
    ));

  if (!row?.settings) {
    console.error('❌ No image settings found for tenant:', TENANT_ID);
    process.exit(1);
  }

  const config = row.settings as { source: string; model?: string; encryptedApiKey?: string };
  console.log('📋 Config:', { source: config.source, model: config.model, hasKey: !!config.encryptedApiKey });

  if (config.source !== 'ai_openai') {
    console.log(`ℹ️  Source is "${config.source}", not ai_openai — DALL-E not used.`);
    process.exit(0);
  }

  if (!config.encryptedApiKey) {
    console.error('❌ No API key stored');
    process.exit(1);
  }

  const apiKey = decryptApiKey(config.encryptedApiKey);
  console.log(`🔑 API key prefix: ${apiKey.substring(0, 8)}...  length: ${apiKey.length}\n`);

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const prompt = 'A professional photo of diverse students studying in a bright modern library, warm tones, 16:9.';

  for (const { model, size, ...extras } of MODELS_TO_TRY) {
    process.stdout.write(`  Testing model=${model} size=${size} ... `);
    try {
      const params: Record<string, any> = { model, prompt, n: 1, size, ...extras };
      console.log('\n    → Sending params:', JSON.stringify(params));
      const resp = await client.images.generate(params as any);
      const url = resp.data?.[0]?.url;
      console.log(`    ✅ SUCCESS — url: ${url?.substring(0, 80)}...`);
      console.log(`\n✅ Working model: ${model}\n`);
      process.exit(0);
    } catch (err: any) {
      // Print FULL error object
      console.log('FAILED');
      console.log('    ── Full error object ──────────────────────────────────');
      console.log('    status  :', err?.status);
      console.log('    message :', err?.message);
      console.log('    type    :', err?.error?.type);
      console.log('    code    :', err?.error?.code);
      console.log('    param   :', err?.error?.param);
      console.log('    error   :', JSON.stringify(err?.error, null, 2)?.replace(/\n/g, '\n    '));
      console.log('    headers :', JSON.stringify(err?.headers));
      console.log('    ────────────────────────────────────────────────────────\n');
    }
  }

  console.log('\n❌ ALL models failed. This is an account/billing issue, not a code issue.\n');
  process.exit(1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
