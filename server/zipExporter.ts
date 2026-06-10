import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';
import { readUpload, getUploadsDir } from './localFileStorage';

const LANG_NAMES: Record<string, string> = {
  en: 'English', ar: 'Arabic', tr: 'Turkish', fr: 'French',
  ru: 'Russian', fa: 'Farsi', zh: 'Chinese', hi: 'Hindi',
  es: 'Spanish', id: 'Indonesian',
};

// ─── Export Job Store ──────────────────────────────────────────────────────────
export interface ExportJob {
  id: string;
  tenantId: string;
  status: 'pending' | 'ready' | 'error';
  downloadPath?: string; // absolute fs path
  downloadUrl?: string;  // /objects/exports/<filename>
  error?: string;
  createdAt: Date;
}

const exportJobs = new Map<string, ExportJob>();

// Prune jobs older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [id, job] of Array.from(exportJobs.entries())) {
    if (job.createdAt.getTime() < cutoff) exportJobs.delete(id);
  }
}, 600_000).unref();

export function getExportJob(jobId: string): ExportJob | undefined {
  return exportJobs.get(jobId);
}

function getExportsDir(): string {
  const dir = path.join(getUploadsDir(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderLangPage(
  lang: string,
  tenant: any,
  theme: any,
  sectionsList: any[],
  faqList: any[],
  testimonialsList: any[],
  seo: any,
  logoFilename: string | null,
): string {
  const langName = LANG_NAMES[lang] || lang;
  const metaTitle = seo?.metaTitleByLang?.[lang] || tenant.universityName;
  const metaDesc = seo?.metaDescriptionByLang?.[lang] || '';
  const isRTL = lang === 'ar' || lang === 'fa';
  const dir = isRTL ? 'rtl' : 'ltr';
  const primaryColor = theme?.primaryColor || '#2563eb';

  const sectionHtml = sectionsList
    .filter(s => s.isEnabled)
    .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((s: any) => {
      const c = s.contentByLang?.[lang] || s.contentByLang?.['en'] || {};
      return `
      <section class="section" id="${escapeHtml(s.sectionKey)}">
        <h2>${escapeHtml(c.title || s.sectionKey)}</h2>
        ${c.subtitle ? `<p class="subtitle">${escapeHtml(c.subtitle)}</p>` : ''}
        ${c.body ? `<p class="body">${escapeHtml(c.body)}</p>` : ''}
        ${c.ctaLabel ? `<a class="cta" href="${escapeHtml(c.ctaUrl || '#')}">${escapeHtml(c.ctaLabel)}</a>` : ''}
      </section>`;
    }).join('\n');

  const faqHtml = faqList.filter((f: any) => f.isEnabled).map((f: any) => {
    const q = f.questionByLang?.[lang] || f.questionByLang?.['en'] || '';
    const a = f.answerByLang?.[lang] || f.answerByLang?.['en'] || '';
    return `<dt>${escapeHtml(q)}</dt><dd>${escapeHtml(a)}</dd>`;
  }).join('\n');

  const testimonialHtml = testimonialsList.filter((t: any) => t.isEnabled).map((t: any) => {
    const content = t.contentByLang?.[lang] || t.contentByLang?.['en'] || '';
    return `
      <blockquote>
        <p>${escapeHtml(content)}</p>
        <footer>— ${escapeHtml(t.studentName)}${t.country ? `, ${escapeHtml(t.country)}` : ''}</footer>
      </blockquote>`;
  }).join('\n');

  const logoHtml = logoFilename
    ? `<img src="../../assets/${escapeHtml(logoFilename)}" alt="${escapeHtml(tenant.universityName)}" style="height:40px;margin-bottom:.5rem;display:block;">`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metaTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${escapeHtml(metaDesc)}">` : ''}
  <style>
    :root { --primary: ${primaryColor}; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; color: #1f2937; direction: ${dir}; }
    header { background: var(--primary); color: #fff; padding: 1.5rem 2rem; }
    header h1 { margin: 0; font-size: 1.5rem; }
    main { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .section { margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb; }
    .section h2 { color: var(--primary); }
    .subtitle { color: #6b7280; font-size: 1.1rem; }
    .cta { display: inline-block; background: var(--primary); color: #fff; padding: .6rem 1.4rem; border-radius: 6px; text-decoration: none; margin-top: .5rem; }
    dl { display: grid; gap: 1rem; }
    dt { font-weight: 600; }
    dd { margin: 0; color: #374151; }
    blockquote { background: #f9fafb; border-left: 4px solid var(--primary); padding: 1rem 1.25rem; margin: 0 0 1rem; border-radius: 0 6px 6px 0; }
    blockquote footer { font-size: .85rem; color: #6b7280; margin-top: .5rem; }
    footer { background: #111827; color: #9ca3af; text-align: center; padding: 1.5rem; font-size: .85rem; }
  </style>
</head>
<body>
  <header>
    ${logoHtml}
    <h1>${escapeHtml(tenant.universityName)} — ${langName}</h1>
  </header>
  <main>
    ${sectionHtml || '<p>No sections enabled.</p>'}
    ${faqHtml ? `<section class="section"><h2>FAQ</h2><dl>${faqHtml}</dl></section>` : ''}
    ${testimonialHtml ? `<section class="section"><h2>Testimonials</h2>${testimonialHtml}</section>` : ''}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(tenant.universityName)}. Generated by University Landing Platform.</p>
  </footer>
</body>
</html>`;
}

// ─── Core ZIP builder ──────────────────────────────────────────────────────────
async function buildZip(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const [tenant, theme, sectionsList, faqList, testimonialsList, seo, mediaAssets] = await Promise.all([
    storage.getTenant(tenantId),
    storage.getTheme(tenantId),
    storage.getSections(tenantId),
    storage.getFaqItems(tenantId),
    storage.getTestimonials(tenantId),
    storage.getSeoSettings(tenantId),
    storage.getMediaAssets(tenantId),
  ]);

  if (!tenant) throw new Error('Tenant not found');

  const zip = new JSZip();
  const assetsFolder = zip.folder('assets')!;

  // Include logo
  let logoFilename: string | null = null;
  if (tenant.logoUrl?.startsWith('/objects/uploads/')) {
    const fname = tenant.logoUrl.slice('/objects/uploads/'.length);
    try {
      const buf = readUpload(tenant.logoUrl);
      assetsFolder.file(fname, buf);
      logoFilename = fname;
    } catch { /* logo not found — skip */ }
  }

  // Include favicon
  if (tenant.faviconUrl?.startsWith('/objects/uploads/')) {
    const fname = tenant.faviconUrl.slice('/objects/uploads/'.length);
    try {
      const buf = readUpload(tenant.faviconUrl);
      assetsFolder.file(fname, buf);
    } catch { /* skip */ }
  }

  // Include all other media assets
  for (const asset of mediaAssets) {
    if (asset.fileUrl?.startsWith('/objects/uploads/')) {
      const fname = asset.fileUrl.slice('/objects/uploads/'.length);
      try {
        const buf = readUpload(asset.fileUrl);
        assetsFolder.file(fname, buf);
      } catch { /* skip missing files */ }
    }
  }

  // Generate HTML for each language
  const pagesFolder = zip.folder('pages')!;
  for (const lang of SUPPORTED_LANGUAGES as readonly SupportedLanguage[]) {
    const html = renderLangPage(lang, tenant, theme, sectionsList, faqList, testimonialsList, seo, logoFilename);
    pagesFolder.folder(lang)!.file('index.html', html);
  }

  // Root redirect index
  zip.file('index.html', `<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0; url=pages/en/index.html">
<title>${escapeHtml(tenant.universityName)}</title></head>
<body><a href="pages/en/index.html">Enter site</a></body></html>`);

  // Manifest
  zip.file('manifest.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    universityName: tenant.universityName,
    domain: tenant.domain,
    languages: [...SUPPORTED_LANGUAGES],
    sections: sectionsList.filter(s => s.isEnabled).map(s => s.sectionKey),
    assets: mediaAssets.length,
  }, null, 2));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const safeDomain = (tenant.domain || tenantId).replace(/[^a-z0-9]/gi, '-');
  const filename = `${safeDomain}-${Date.now()}.zip`;
  return { buffer, filename };
}

// ─── Async export: start a background job ─────────────────────────────────────
export function startExportJob(tenantId: string): ExportJob {
  const jobId = randomUUID();
  const job: ExportJob = { id: jobId, tenantId, status: 'pending', createdAt: new Date() };
  exportJobs.set(jobId, job);

  // Run in background — do NOT await
  setImmediate(async () => {
    try {
      const { buffer, filename } = await buildZip(tenantId);
      const exportsDir = getExportsDir();
      const filePath = path.join(exportsDir, filename);
      fs.writeFileSync(filePath, buffer);
      job.status = 'ready';
      job.downloadPath = filePath;
      job.downloadUrl = `/objects/exports/${filename}`;
    } catch (err: any) {
      job.status = 'error';
      job.error = err?.message || 'ZIP generation failed';
    }
  });

  return job;
}

// ─── Snapshot helpers ──────────────────────────────────────────────────────────
export async function captureSnapshot(tenantId: string): Promise<Record<string, any>> {
  const [tenant, theme, sectionsList, faqList, testimonialsList, seo, domains] = await Promise.all([
    storage.getTenant(tenantId),
    storage.getTheme(tenantId),
    storage.getSections(tenantId),
    storage.getFaqItems(tenantId),
    storage.getTestimonials(tenantId),
    storage.getSeoSettings(tenantId),
    storage.getTenantDomains(tenantId),
  ]);
  return {
    tenant,
    theme,
    sections: sectionsList,
    faqItems: faqList,
    testimonials: testimonialsList,
    seoSettings: seo,
    domains,
    capturedAt: new Date().toISOString(),
  };
}

// ─── Deterministic restore ─────────────────────────────────────────────────────
export async function restoreSnapshot(tenantId: string, snapshot: Record<string, any>): Promise<void> {
  const { tenant, theme, sections: snapshotSections, faqItems: snapshotFaq, testimonials: snapshotTestimonials, seoSettings: snapshotSeo } = snapshot;

  // Restore tenant metadata (immutable fields excluded)
  if (tenant) {
    const { id: _id, createdAt: _c, ...tenantData } = tenant;
    await storage.updateTenant(tenantId, tenantData);
  }

  // Restore theme
  if (theme) {
    const { id: _id, tenantId: _t, ...themeData } = theme;
    const existing = await storage.getTheme(tenantId);
    if (existing) await storage.updateTheme(tenantId, themeData);
    else await storage.createTheme({ tenantId, ...themeData });
  }

  // Restore SEO settings
  if (snapshotSeo) {
    const { id: _id, tenantId: _t, ...seoData } = snapshotSeo;
    const existing = await storage.getSeoSettings(tenantId);
    if (existing) await storage.updateSeoSettings(tenantId, seoData);
    else await storage.createSeoSettings({ tenantId, ...seoData });
  }

  // Deterministic sections: update existing, create new, delete stale
  if (Array.isArray(snapshotSections)) {
    const currentSections = await storage.getSections(tenantId);
    const snapshotIds = new Set(snapshotSections.map((s: any) => s.id));
    const currentIds = new Set(currentSections.map(s => s.id));

    for (const s of snapshotSections) {
      const { id, tenantId: _t, ...sData } = s;
      if (currentIds.has(id)) {
        await storage.updateSection(id, sData);
      } else {
        await storage.createSection({ tenantId, ...sData, id } as any);
      }
    }
    // Delete sections that exist now but weren't in snapshot
    for (const cur of currentSections) {
      if (!snapshotIds.has(cur.id)) {
        await storage.deleteSection(cur.id, tenantId);
      }
    }
  }

  // Deterministic FAQ items
  if (Array.isArray(snapshotFaq)) {
    const currentFaq = await storage.getFaqItems(tenantId);
    const snapshotIds = new Set(snapshotFaq.map((f: any) => f.id));
    const currentIds = new Set(currentFaq.map(f => f.id));

    for (const f of snapshotFaq) {
      const { id, tenantId: _t, ...fData } = f;
      if (currentIds.has(id)) {
        await storage.updateFaqItem(id, fData);
      } else {
        await storage.createFaqItem({ tenantId, ...fData, id } as any);
      }
    }
    for (const cur of currentFaq) {
      if (!snapshotIds.has(cur.id)) {
        await storage.deleteFaqItem(cur.id);
      }
    }
  }

  // Deterministic testimonials
  if (Array.isArray(snapshotTestimonials)) {
    const currentT = await storage.getTestimonials(tenantId);
    const snapshotIds = new Set(snapshotTestimonials.map((t: any) => t.id));
    const currentIds = new Set(currentT.map(t => t.id));

    for (const t of snapshotTestimonials) {
      const { id, tenantId: _t, ...tData } = t;
      if (currentIds.has(id)) {
        await storage.updateTestimonial(id, tData);
      } else {
        await storage.createTestimonial({ tenantId, ...tData, id } as any);
      }
    }
    for (const cur of currentT) {
      if (!snapshotIds.has(cur.id)) {
        await storage.deleteTestimonial(cur.id);
      }
    }
  }
}
