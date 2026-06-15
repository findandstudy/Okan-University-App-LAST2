import crypto from 'node:crypto';
import { db } from './db';
import { integrationSettings } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
  // SHA-256 always produces exactly 32 bytes regardless of key length/format
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptApiKey(ciphertext: string): string {
  const [ivHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted key format');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export interface AIConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  encryptedApiKey: string;
}

export async function getAIConfig(tenantId: string): Promise<AIConfig | null> {
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(and(eq(integrationSettings.tenantId, tenantId), eq(integrationSettings.integrationType, 'ai')));
  if (!row || !row.settings) return null;
  const s = row.settings as any;
  if (!s.provider || !s.encryptedApiKey) return null;
  return { provider: s.provider, model: s.model || defaultModel(s.provider), encryptedApiKey: s.encryptedApiKey };
}

export function defaultModel(provider: string): string {
  if (provider === 'anthropic') return 'claude-haiku-4-5-20251001';
  if (provider === 'openai') return 'gpt-4o-mini';
  return 'gpt-4o-mini';
}

export async function callAI(prompt: string, tenantId: string, systemPrompt?: string): Promise<string> {
  const config = await getAIConfig(tenantId);
  if (!config) throw new Error('AI not configured for this tenant');
  const apiKey = decryptApiKey(config.encryptedApiKey);

  if (config.provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: prompt }],
    });
    const block = msg.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  } else {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: 4096,
    });
    return response.choices[0]?.message?.content || '';
  }
}

export async function testAIConnection(provider: string, apiKey: string, model: string): Promise<boolean> {
  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    return msg.content.length > 0;
  } else {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10,
    });
    return !!res.choices[0]?.message?.content;
  }
}
