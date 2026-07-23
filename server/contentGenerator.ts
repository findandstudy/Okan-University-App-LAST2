import { createRequire } from 'module';
import { callAI, parseAiJson } from './aiService';
import { translateText } from './aiTranslation';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

const _require = createRequire(import.meta.url);

export interface GeneratedContent {
  hero: {
    title: string;
    subtitle: string;
    body: string;
    ctaLabel: string;
  };
  about: {
    title: string;
    body: string;
  };
  faq: Array<{
    question: string;
    answer: string;
    needsVerification?: boolean;
  }>;
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string;
  };
}

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some(re => re.test(hostname));
}

export async function extractTextFromUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Requests to private/internal network addresses are not allowed');
  }

  const cheerio = await import('cheerio');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }

  // Re-check after redirect in case redirect landed on private host
  if (res.url) {
    try {
      const redirected = new URL(res.url);
      if (isPrivateHost(redirected.hostname)) {
        throw new Error('Redirect to private/internal network address blocked');
      }
    } catch (e: any) {
      if (e.message.includes('blocked')) throw e;
    }
  }

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, iframe, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.substring(0, 8000);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = _require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = (result.pages as Array<{ text: string }>).map((p) => p.text).join('\n');
  return text.substring(0, 8000);
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value.substring(0, 8000);
}

function stripVerificationMarker(text: string): { text: string; flagged: boolean } {
  const marker = /\[DOĞRULANMALI\]/gi;
  const flagged = marker.test(text);
  return { text: text.replace(/\[DOĞRULANMALI\]/gi, '').replace(/\s{2,}/g, ' ').trim(), flagged };
}

export async function generateContent(text: string, tenantId: string): Promise<GeneratedContent> {
  const systemPrompt = `You are a university marketing expert. Generate landing page content from the provided source material.
Rules:
- Write ALL content in English, regardless of the language of the source material
- Use only verified facts from the source material
- If a FAQ answer contains unverifiable claims (fees, exact dates, statistics not in the source), set "needsVerification": true for that item — do NOT embed any marker text in the answer itself
- Write in a compelling but factual marketing tone
- Generate 8-12 FAQ items covering common student questions
- Return ONLY valid JSON, no explanations`;

  const prompt = `Based on this university/program information, generate landing page content:

"""
${text}
"""

Return a JSON object with this exact structure:
{
  "hero": {
    "title": "Main headline (compelling, under 10 words)",
    "subtitle": "Supporting headline (1-2 sentences)",
    "body": "Hero description (2-3 sentences)",
    "ctaLabel": "Call to action button text"
  },
  "about": {
    "title": "About section title",
    "body": "About section content (3-4 sentences)"
  },
  "faq": [
    {"question": "Question?", "answer": "Answer.", "needsVerification": false}
  ],
  "seo": {
    "metaTitle": "SEO title (under 60 chars)",
    "metaDescription": "Meta description (under 160 chars)",
    "keywords": "comma, separated, keywords"
  }
}`;

  const raw = await callAI(prompt, tenantId, systemPrompt, true);
  const parsed = parseAiJson<GeneratedContent>(raw);

  // Strip any stray [DOĞRULANMALI] markers the model may have embedded in text
  const cleanField = (s: string) => stripVerificationMarker(s).text;
  return {
    hero: {
      title: cleanField(parsed.hero?.title || ''),
      subtitle: cleanField(parsed.hero?.subtitle || ''),
      body: cleanField(parsed.hero?.body || ''),
      ctaLabel: cleanField(parsed.hero?.ctaLabel || ''),
    },
    about: {
      title: cleanField(parsed.about?.title || ''),
      body: cleanField(parsed.about?.body || ''),
    },
    faq: (parsed.faq || []).map(item => {
      const q = stripVerificationMarker(item.question || '');
      const a = stripVerificationMarker(item.answer || '');
      return {
        question: q.text,
        answer: a.text,
        needsVerification: item.needsVerification || q.flagged || a.flagged,
      };
    }),
    seo: {
      metaTitle: cleanField(parsed.seo?.metaTitle || ''),
      metaDescription: cleanField(parsed.seo?.metaDescription || ''),
      keywords: cleanField(parsed.seo?.keywords || ''),
    },
  };
}

export interface BlogContent {
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDesc: string;
}

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

export interface LinkRef {
  url: string;
  title: string;
}

export async function fetchLinkTitle(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniBlogBot/1.0)' },
    });
    clearTimeout(timer);
    const html = await resp.text();
    const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    return match ? match[1].trim().replace(/\s+/g, ' ') : url;
  } catch {
    return url;
  }
}

export async function generateBlogPost(
  keyword: string,
  externalLinks: LinkRef[],
  internalLinks: LinkRef[],
  tenantId: string,
): Promise<BlogContent> {
  const externalBlock = externalLinks.length > 0
    ? `\nEXTERNAL LINKS TO INCLUDE (link to these where topically relevant — use the page title as anchor text):\n${externalLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`
    : '';

  const internalBlock = internalLinks.length > 0
    ? `\nINTERNAL LINKS (links to other posts on this blog — you MUST naturally include at least ${Math.min(2, internalLinks.length)} of these using the title as anchor text):\n${internalLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`
    : '';

  const systemPrompt = `You are a senior SEO content strategist for a university recruitment platform.
Write authoritative, in-depth blog articles targeting international students.
Rules:
- Never fabricate statistics, rankings, or specific facts you cannot verify.
- Use precise, specific language — avoid vague filler phrases.
- When internal or external links are provided, embed them naturally as Markdown hyperlinks in the body — do NOT list them at the bottom.
- Every H2 must contain a semantically related variant of the target keyword or a strong supporting topic.
- Return ONLY valid JSON. No markdown fences, no explanation outside the JSON.`;

  const prompt = `Write a high-quality, SEO-optimized blog article targeting the keyword: "${keyword}"
${externalBlock}${internalBlock}
CONTENT STRUCTURE (mandatory):
1. # H1 Title — compelling, keyword-rich, under 65 chars (use a single #)
2. Introduction paragraph — hook + keyword in first sentence + what the reader will learn
3. At least 4 ## H2 sections, each 200-300 words, each with ## heading containing keyword variations
4. Use ### H3 sub-headings inside at least 2 of the H2 sections for deeper structure
5. Bullet lists or numbered steps where appropriate (at least 2 lists in the article)
6. A clear "Conclusion" ## section that restates the keyword and has a call-to-action
7. End with a ## Frequently Asked Questions section (exactly 5 Q&A pairs)

TOTAL LENGTH: 1500-2000 words (body only, not counting FAQ)

KEYWORD USAGE RULES:
- Keyword in the very first sentence
- Keyword or close variant in at least 3 of the ## H2 headings
- Keyword in the conclusion paragraph

FAQ FORMAT (use exactly):
## Frequently Asked Questions

**Q: [question relevant to the keyword]?**
A: [answer in 2-4 sentences]

(repeat for all 5 questions)

SEO FIELDS:
- metaTitle: 50-60 chars, primary keyword near the start, compelling
- metaDesc: 140-155 chars, includes keyword, includes a benefit/CTA, no truncation

Return ONLY this JSON (no markdown, no extra keys):
{
  "title": "H1 title string (under 65 chars)",
  "content": "Full article in Markdown — starts with # H1, then body, then FAQ",
  "metaTitle": "Meta title 50-60 chars",
  "metaDesc": "Meta description 140-155 chars"
}`;

  const raw = await callAI(prompt, tenantId, systemPrompt, true);
  const parsed = parseAiJson<Omit<BlogContent, 'slug'>>(raw);
  return {
    ...parsed,
    slug: toSlug(parsed.title),
  };
}

export async function translateBlogPost(
  enContent: BlogContent,
  targetLangs: string[],
  tenantId: string,
): Promise<Record<string, BlogContent>> {
  const results: Record<string, BlogContent> = {};

  const fieldsToTranslate: Array<keyof BlogContent> = ['title', 'content', 'metaTitle', 'metaDesc'];

  for (const field of fieldsToTranslate) {
    const text = enContent[field];
    const translations = await translateText(text, 'en', targetLangs, tenantId);

    for (const lang of targetLangs) {
      if (!results[lang]) {
        results[lang] = { ...enContent };
      }
      if (translations[lang]) {
        results[lang][field] = translations[lang];
      }
    }
  }

  // Generate slugs from translated titles
  for (const lang of targetLangs) {
    if (results[lang]) {
      results[lang].slug = toSlug(results[lang].title);
    }
  }

  return results;
}
