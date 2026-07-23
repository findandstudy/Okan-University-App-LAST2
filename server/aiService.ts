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
  // Try the requested tenant first, then fall back to 'default' so that
  // sub-tenants can use the global admin AI key without reconfiguring.
  const tenantsToTry = tenantId === 'default' ? ['default'] : [tenantId, 'default'];
  for (const tid of tenantsToTry) {
    const [row] = await db
      .select()
      .from(integrationSettings)
      .where(and(eq(integrationSettings.tenantId, tid), eq(integrationSettings.integrationType, 'ai')));
    if (!row || !row.settings) continue;
    const s = row.settings as any;
    if (!s.provider || !s.encryptedApiKey) continue;
    return { provider: s.provider, model: s.model || defaultModel(s.provider), encryptedApiKey: s.encryptedApiKey };
  }
  return null;
}

export function defaultModel(provider: string): string {
  if (provider === 'anthropic') return 'claude-haiku-4-5-20251001';
  if (provider === 'openai') return 'gpt-4o-mini';
  return 'gpt-4o-mini';
}

export async function callAI(prompt: string, tenantId: string, systemPrompt?: string, jsonMode = false): Promise<string> {
  const config = await getAIConfig(tenantId);
  if (!config) throw new Error('AI not configured for this tenant');
  const apiKey = decryptApiKey(config.encryptedApiKey);

  if (config.provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: config.model,
      max_tokens: 8192,
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
      max_tokens: 8192,
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return response.choices[0]?.message?.content || '';
  }
}

/**
 * Repair the most common LLM JSON mistakes *inside string values* without
 * touching structural characters: invalid backslash escapes (e.g. "\(" which
 * makes JSON.parse throw "Bad escaped character in JSON") and raw control
 * characters (unescaped newlines/tabs). Walks the text with a tiny string-state
 * machine so whitespace between tokens is left untouched.
 */
function repairJson(src: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') {
        const next = src[i + 1];
        if (next !== undefined && '"\\/bfnrtu'.includes(next)) {
          out += ch + next; // valid escape — keep both chars
          i++;
        } else {
          out += '\\\\'; // invalid escape — escape the lone backslash
        }
      } else if (ch === '"') {
        inStr = false;
        out += ch;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else if (ch.charCodeAt(0) < 0x20) {
        out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        out += ch;
      }
    } else {
      out += ch;
      if (ch === '"') inStr = true;
    }
  }
  return out;
}

/**
 * Robustly parse a JSON object/array out of a raw LLM response.
 * Handles markdown ```json fences, prose around the JSON, and the frequent
 * bad-escape / control-char problems in long generated content. Tries a strict
 * parse first (so well-formed responses are unaffected), then a repaired parse.
 */
export function parseAiJson<T = any>(raw: string): T {
  if (!raw || !raw.trim()) throw new Error('Empty AI response');
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) s = fence[1].trim();
  // Find the outermost {...} or [...] block
  const candidates = ['{', '['].map(c => s.indexOf(c)).filter(i => i !== -1);
  if (candidates.length === 0) throw new Error('No JSON found in AI response');
  const start = Math.min(...candidates);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (end <= start) throw new Error('No JSON found in AI response');
  const block = s.slice(start, end + 1);
  try {
    return JSON.parse(block) as T;
  } catch {
    return JSON.parse(repairJson(block)) as T;
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
