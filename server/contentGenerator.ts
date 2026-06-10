import { callAI } from './aiService';

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
