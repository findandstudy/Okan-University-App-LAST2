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

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided text accurately and naturally. 
Return ONLY a JSON object with language codes as keys and translated text as values. 
Preserve formatting, line breaks, and tone. Do not add explanations.`;

export async function translateText(
  text: string,
  sourceLang: string,
  targetLangs: string[],
  tenantId: string,
): Promise<Record<string, string>> {
  const langList = targetLangs
    .map(l => `"${l}": "${LANGUAGE_NAMES[l] || l}"`)
    .join(', ');

  const batchPrompt = `Translate the following ${LANGUAGE_NAMES[sourceLang] || sourceLang} text into these languages: ${langList}

Source text:
"""
${text}
"""

Return a JSON object like: {"en": "...", "ar": "...", "tr": "...", ...}
Only include the requested target languages.`;

  // Try batch (all languages at once)
  try {
    const raw = await callAI(batchPrompt, tenantId, SYSTEM_PROMPT);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in batch response (may be truncated)');
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    const gotLangs = targetLangs.filter(l => parsed[l]);
    if (gotLangs.length === 0) throw new Error('Batch response had no valid translations');
    // If batch partially succeeded, return what we got (missing keys = caller detects failure)
    return parsed;
  } catch (batchErr: any) {
    console.warn(`[translateText] batch failed (${batchErr?.message}) — falling back to per-language`);
  }

  // Per-language fallback — one call per language
  const results: Record<string, string> = {};
  for (const lang of targetLangs) {
    const perLangPrompt = `Translate the following ${LANGUAGE_NAMES[sourceLang] || sourceLang} text into ${LANGUAGE_NAMES[lang] || lang}.

Source text:
"""
${text}
"""

Return ONLY a JSON object: {"${lang}": "translated text"}`;
    try {
      const raw = await callAI(perLangPrompt, tenantId, SYSTEM_PROMPT);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in per-language response');
      const parsed = JSON.parse(match[0]);
      const value = parsed[lang] ?? Object.values(parsed).find(v => typeof v === 'string');
      if (value && typeof value === 'string') {
        results[lang] = value;
      } else {
        throw new Error('No valid translation value in response');
      }
    } catch (langErr: any) {
      console.error(`[translateText] per-language fallback FAILED for "${lang}":`, langErr?.message);
      // Missing key in results signals failure to caller
    }
  }
  return results;
}

export async function translateContentByLang(
  sourceContent: Record<string, any>,
  sourceLang: string,
  targetLangs: string[],
  tenantId: string,
  onFieldFailed?: (field: string, langs: string[]) => void,
): Promise<Record<string, Record<string, any>>> {
  const results: Record<string, Record<string, any>> = {};
  for (const lang of targetLangs) {
    results[lang] = {};
  }

  // Translate ALL string fields — not just a hardcoded subset
  for (const [field, value] of Object.entries(sourceContent)) {
    if (!value || typeof value !== 'string' || !value.trim()) continue;

    const translations = await translateText(value, sourceLang, targetLangs, tenantId);
    for (const lang of targetLangs) {
      if (translations[lang]) results[lang][field] = translations[lang];
    }
    const failedLangs = targetLangs.filter(l => !translations[l]);
    if (failedLangs.length && onFieldFailed) {
      onFieldFailed(field, failedLangs);
    }
  }

  return results;
}
