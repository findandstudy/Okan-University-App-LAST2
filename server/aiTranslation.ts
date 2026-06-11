import { callAI } from './aiService';
import type { SupportedLanguage } from '@shared/schema';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  tr: 'Turkish',
  fr: 'French',
  ru: 'Russian',
  fa: 'Farsi (Persian)',
  zh: 'Chinese (Simplified)',
  hi: 'Hindi',
  es: 'Spanish',
  id: 'Indonesian',
};

export async function translateText(
  text: string,
  sourceLang: string,
  targetLangs: string[],
  tenantId: string,
): Promise<Record<string, string>> {
  const systemPrompt = `You are a professional translator. Translate the provided text accurately and naturally. 
Return ONLY a JSON object with language codes as keys and translated text as values. 
Preserve formatting, line breaks, and tone. Do not add explanations.`;

  const langList = targetLangs
    .map(l => `"${l}": "${LANGUAGE_NAMES[l] || l}"`)
    .join(', ');

  const prompt = `Translate the following ${LANGUAGE_NAMES[sourceLang] || sourceLang} text into these languages: ${langList}

Source text:
"""
${text}
"""

Return a JSON object like: {"en": "...", "ar": "...", "tr": "...", ...}
Only include the requested target languages.`;

  try {
    const raw = await callAI(prompt, tenantId, systemPrompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in translation response');
    return JSON.parse(match[0]) as Record<string, string>;
  } catch (err) {
    console.warn('[translateText] Translation failed, returning empty result:', (err as any)?.message);
    return {};
  }
}

export async function translateContentByLang(
  sourceContent: Record<string, any>,
  sourceLang: string,
  targetLangs: string[],
  tenantId: string,
): Promise<Record<string, Record<string, any>>> {
  const fields = ['title', 'subtitle', 'body', 'ctaLabel'] as const;
  const results: Record<string, Record<string, any>> = {};

  for (const lang of targetLangs) {
    results[lang] = { ...sourceContent };
  }

  for (const field of fields) {
    const value = sourceContent[field];
    if (!value || typeof value !== 'string') continue;

    const translations = await translateText(value, sourceLang, targetLangs, tenantId);
    for (const lang of targetLangs) {
      if (translations[lang]) results[lang][field] = translations[lang];
    }
  }

  return results;
}
