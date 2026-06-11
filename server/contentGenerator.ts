import { callAI } from './aiService';
import { translateText } from './aiTranslation';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text.substring(0, 8000);
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value.substring(0, 8000);
}

export async function generateContent(text: string, tenantId: string): Promise<GeneratedContent> {
  const systemPrompt = `You are a university marketing expert. Generate landing page content from the provided source material.
Rules:
- Use only verified facts from the source material
- If information about fees, dates, or statistics is missing or unclear, mark it with [DOĞRULANMALI] ("needs verification")  
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
}

Mark any unverified claims about fees, dates, or statistics with [DOĞRULANMALI].`;

  const raw = await callAI(prompt, tenantId, systemPrompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Invalid content generation response from AI');
  return JSON.parse(match[0]) as GeneratedContent;
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

export async function generateBlogPost(
  keyword: string,
  backlinkSites: string[],
  tenantId: string,
): Promise<BlogContent> {
  const backlinkInstruction = backlinkSites.length > 0
    ? `Naturally mention and link to these sites where contextually appropriate (do NOT fabricate facts about them): ${backlinkSites.join(', ')}.`
    : '';

  const systemPrompt = `You are an expert SEO content writer for a university recruitment platform. 
Write factual, well-structured blog articles that help international students.
Never fabricate statistics, rankings, or specific facts you cannot verify.
Return ONLY valid JSON, no markdown, no explanation.`;

  const prompt = `Write an SEO-optimized blog article targeting the keyword: "${keyword}"

${backlinkInstruction}

Article requirements:
- 600-900 words
- Professional but accessible tone
- Structured with clear headings (use ## for H2, ### for H3)
- Include a compelling introduction and a clear conclusion
- Target international students considering university enrollment

Return this exact JSON structure:
{
  "title": "SEO-optimized article title (under 65 chars)",
  "content": "Full article in Markdown format",
  "metaTitle": "Meta title (under 60 chars, includes keyword)",
  "metaDesc": "Meta description (120-155 chars, compelling, includes keyword)"
}`;

  const raw = await callAI(prompt, tenantId, systemPrompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Invalid blog generation response from AI');
  const parsed = JSON.parse(match[0]) as Omit<BlogContent, 'slug'>;
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
