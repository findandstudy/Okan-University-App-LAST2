import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/schema';
import { readUpload, getUploadsDir } from './localFileStorage';

const LANG_NAMES: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', fr: 'Français',
  ru: 'Русский', fa: 'فارسی', zh: '中文', hi: 'हिन्दी',
  es: 'Español', id: 'Indonesia',
};

// ─── Export Job Store ──────────────────────────────────────────────────────────
export interface ExportJob {
  id: string;
  tenantId: string;
  status: 'pending' | 'ready' | 'error';
  downloadPath?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
}

const exportJobs = new Map<string, ExportJob>();

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function e(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function t(obj: any, lang: string, fallback = ''): string {
  if (!obj) return fallback;
  return obj[lang] || obj['en'] || fallback;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderHero(lang: string, section: any, tenant: any, logoFilename: string | null, primaryColor: string, supportedLangs: string[]): string {
  const s = section?.settings || {};
  const badge = t(s.badge, lang);
  const title = t(s.title, lang, tenant.universityName);
  const subtitle = t(s.subtitle, lang);
  const features: string[] = s.features?.[lang] || s.features?.['en'] || [];
  const stat1Label = t(s.stats?.stat1Label, lang);
  const stat1Value = s.stats?.stat1Value || '';
  const stat1Sub = t(s.stats?.stat1Sublabel, lang);
  const stat2Label = t(s.stats?.stat2Label, lang);
  const stat2Value = s.stats?.stat2Value || '';
  const stat2Sub = t(s.stats?.stat2Sublabel, lang);

  const langLinks = supportedLangs.map(l =>
    `<a href="../${e(l)}/index.html" class="px-3 py-1 rounded-full text-sm font-medium ${l === lang ? 'bg-white text-primary' : 'text-white/80 hover:text-white hover:bg-white/20'} transition-colors">${e(LANG_NAMES[l] || l)}</a>`
  ).join('');

  const logoHtml = logoFilename
    ? `<img src="../../assets/${e(logoFilename)}" alt="${e(tenant.universityName)}" class="h-10 w-auto object-contain">`
    : `<div class="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-lg">${e(tenant.universityName?.[0] || 'U')}</div>`;

  const badgeHtml = badge ? `<div class="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full mb-6 border border-white/30">
      <span class="w-2 h-2 rounded-full bg-yellow-300 animate-pulse"></span>${e(badge)}
    </div>` : '';

  const featureHtml = features.length ? `<ul class="mt-6 space-y-2">${features.map(f =>
    `<li class="flex items-center gap-3 text-white/90 text-sm"><svg class="w-4 h-4 text-yellow-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>${e(f)}</li>`
  ).join('')}</ul>` : '';

  const statsHtml = (stat1Value || stat2Value) ? `<div class="flex gap-6 mt-8">
    ${stat1Value ? `<div class="text-center"><div class="text-3xl font-bold text-white">${e(stat1Value)}</div><div class="text-white/70 text-xs mt-1">${e(stat1Label)}</div>${stat1Sub ? `<div class="text-white/50 text-xs">${e(stat1Sub)}</div>` : ''}</div>` : ''}
    ${stat1Value && stat2Value ? '<div class="w-px bg-white/20"></div>' : ''}
    ${stat2Value ? `<div class="text-center"><div class="text-3xl font-bold text-white">${e(stat2Value)}</div><div class="text-white/70 text-xs mt-1">${e(stat2Label)}</div>${stat2Sub ? `<div class="text-white/50 text-xs">${e(stat2Sub)}</div>` : ''}</div>` : ''}
  </div>` : '';

  return `
  <!-- Navbar -->
  <nav class="absolute top-0 left-0 right-0 z-10 px-6 py-4">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">${logoHtml}<span class="text-white font-semibold text-lg hidden sm:block">${e(tenant.universityName)}</span></div>
      <div class="flex flex-wrap gap-2">${langLinks}</div>
    </div>
  </nav>
  <!-- Hero -->
  <section id="hero" class="relative min-h-screen flex items-center" style="background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);">
    <div class="absolute inset-0" style="background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22><defs><pattern id=%22g%22 width=%2260%22 height=%2260%22 patternUnits=%22userSpaceOnUse%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22rgba(255,255,255,0.1)%22/></pattern></defs><rect width=%22100%25%22 height=%22100%25%22 fill=%22url(%23g)%22/></svg>');"></div>
    <div class="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16">
      <div class="max-w-2xl">
        ${badgeHtml}
        <h1 class="text-4xl sm:text-5xl font-extrabold text-white leading-tight">${e(title)}</h1>
        ${subtitle ? `<p class="mt-4 text-lg text-white/80 leading-relaxed">${e(subtitle)}</p>` : ''}
        ${featureHtml}
        ${statsHtml}
      </div>
    </div>
  </section>`;
}

function renderTrustBadges(lang: string, section: any): string {
  const s = section?.settings || {};
  const badges: any[] = s.badges || [];
  const sectionTitle = t(s.sectionTitle, lang);
  const sectionSubtitle = t(s.sectionSubtitle, lang);
  if (!badges.length && !sectionTitle) return '';

  const ICONS: Record<string, string> = {
    shield: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>',
    clock: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    users: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>',
    award: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>',
    graduation: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>',
    heart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
    globe: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    sparkles: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
  };

  const badgeCards = badges.map(b => {
    const iconPath = ICONS[b.icon] || ICONS.shield;
    return `<div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-start gap-3 hover:shadow-md transition-shadow">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:rgba(var(--primary-rgb),0.1)">
        <svg class="w-6 h-6" style="color:var(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
      </div>
      <div><p class="font-semibold text-gray-900">${e(t(b.title, lang))}</p><p class="text-sm text-gray-500 mt-1">${e(t(b.description, lang))}</p></div>
    </div>`;
  }).join('');

  return `<section id="trust_badges" class="py-20 bg-gray-50">
    <div class="max-w-6xl mx-auto px-6">
      ${sectionTitle ? `<div class="text-center mb-12"><h2 class="text-3xl font-bold text-gray-900">${e(sectionTitle)}</h2>${sectionSubtitle ? `<p class="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">${e(sectionSubtitle)}</p>` : ''}</div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${badgeCards}</div>
    </div>
  </section>`;
}

function renderSteps(lang: string, section: any): string {
  const c = section?.contentByLang?.[lang] || section?.contentByLang?.['en'] || {};
  const title = c.title || t(section?.settings?.sectionTitle, lang);
  if (!title) return '';
  return `<section id="steps" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold text-gray-900">${e(title)}</h2>
      ${c.subtitle ? `<p class="mt-3 text-gray-500 text-lg">${e(c.subtitle)}</p>` : ''}
      ${c.body ? `<p class="mt-4 text-gray-600">${e(c.body)}</p>` : ''}
    </div>
  </section>`;
}

function renderTestimonials(lang: string, section: any, testimonialsList: any[]): string {
  const c = section?.contentByLang?.[lang] || section?.contentByLang?.['en'] || {};
  const active = testimonialsList.filter((x: any) => x.isEnabled !== false);
  if (!active.length) return '';

  const stars = (n: number) => '★'.repeat(Math.min(5, Math.max(0, n || 5))) + '☆'.repeat(Math.max(0, 5 - (n || 5)));

  const cards = active.map((item: any) => {
    const content = t(item.contentByLang, lang) || item.content || '';
    const photoHtml = item.photoUrl
      ? `<img src="${e(item.photoUrl)}" alt="${e(item.studentName)}" class="w-12 h-12 rounded-full object-cover">`
      : `<div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style="background:var(--primary)">${e((item.studentName || 'S')[0])}</div>`;
    return `<div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
      <p class="text-yellow-400 text-lg">${stars(item.rating)}</p>
      <p class="text-gray-700 leading-relaxed flex-1">"${e(content)}"</p>
      <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
        ${photoHtml}
        <div><p class="font-semibold text-gray-900 text-sm">${e(item.studentName || '')}</p><p class="text-gray-400 text-xs">${e(item.country || '')}${item.programName ? ` · ${e(item.programName)}` : ''}</p></div>
      </div>
    </div>`;
  }).join('');

  const sectionTitle = c.title || (lang === 'ar' ? 'شهادات الطلاب' : lang === 'tr' ? 'Öğrenci Yorumları' : lang === 'fr' ? 'Témoignages' : 'Student Testimonials');

  return `<section id="testimonials" class="py-20 bg-gray-50">
    <div class="max-w-6xl mx-auto px-6">
      <div class="text-center mb-12"><h2 class="text-3xl font-bold text-gray-900">${e(sectionTitle)}</h2>${c.subtitle ? `<p class="mt-3 text-gray-500">${e(c.subtitle)}</p>` : ''}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
    </div>
  </section>`;
}

function renderFAQ(lang: string, section: any, faqList: any[]): string {
  const c = section?.contentByLang?.[lang] || section?.contentByLang?.['en'] || {};
  const active = faqList.filter((x: any) => x.isEnabled !== false);
  if (!active.length) return '';

  const items = active.map((item: any, i: number) => {
    const q = t(item.questionByLang, lang);
    const a = t(item.answerByLang, lang);
    if (!q) return '';
    return `<details class="group bg-white rounded-xl border border-gray-200 overflow-hidden">
      <summary class="flex items-center justify-between p-5 cursor-pointer list-none font-medium text-gray-900 hover:bg-gray-50 transition-colors">
        ${e(q)}
        <svg class="w-5 h-5 text-gray-400 flex-shrink-0 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">${e(a)}</div>
    </details>`;
  }).join('');

  const sectionTitle = c.title || (lang === 'ar' ? 'الأسئلة الشائعة' : lang === 'tr' ? 'Sık Sorulan Sorular' : lang === 'fr' ? 'FAQ' : 'Frequently Asked Questions');

  return `<section id="faq" class="py-20 bg-white">
    <div class="max-w-3xl mx-auto px-6">
      <div class="text-center mb-12"><h2 class="text-3xl font-bold text-gray-900">${e(sectionTitle)}</h2>${c.subtitle ? `<p class="mt-3 text-gray-500">${e(c.subtitle)}</p>` : ''}</div>
      <div class="space-y-3">${items}</div>
    </div>
  </section>`;
}

function renderContact(lang: string, section: any): string {
  const s = section?.settings || {};
  const sectionTitle = t(s.sectionTitle, lang);
  const sectionSubtitle = t(s.sectionSubtitle, lang);
  const items: any[] = s.items || [];
  if (!items.length && !sectionTitle) return '';

  const CONTACT_ICONS: Record<string, string> = {
    phone: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>',
    email: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>',
    address: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>',
    whatsapp: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>',
  };

  const itemCards = items.map(item => {
    const label = t(item.label, lang);
    const iconPath = CONTACT_ICONS[item.icon] || CONTACT_ICONS.phone;
    return `<div class="flex items-start gap-4">
      <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(var(--primary-rgb),0.1)">
        <svg class="w-5 h-5" style="color:var(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
      </div>
      <div><p class="text-sm font-medium text-gray-500">${e(label)}</p><p class="text-gray-900 font-medium mt-0.5">${e(item.value || '')}</p></div>
    </div>`;
  }).join('');

  return `<section id="contact" class="py-20 bg-gray-50">
    <div class="max-w-6xl mx-auto px-6">
      ${sectionTitle ? `<div class="text-center mb-12"><h2 class="text-3xl font-bold text-gray-900">${e(sectionTitle)}</h2>${sectionSubtitle ? `<p class="mt-3 text-gray-500 text-lg">${e(sectionSubtitle)}</p>` : ''}</div>` : ''}
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
        ${itemCards}
      </div>
    </div>
  </section>`;
}

function renderFooter(lang: string, section: any, tenant: any, theme: any, logoFilename: string | null): string {
  const s = section?.settings || {};
  const description = t(s.description, lang);
  const contactTitle = t(s.contactTitle, lang);
  const contactAddress = t(s.contactAddress, lang);

  const logoHtml = logoFilename
    ? `<img src="../../assets/${e(logoFilename)}" alt="${e(tenant.universityName)}" class="h-8 w-auto object-contain mb-3">`
    : '';

  const socialLinks = [
    tenant.facebookUrl ? `<a href="${e(tenant.facebookUrl)}" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>` : '',
    tenant.instagramUrl ? `<a href="${e(tenant.instagramUrl)}" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke-width="2"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" stroke-width="2"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="2" stroke-linecap="round"/></svg></a>` : '',
    tenant.youtubeUrl ? `<a href="${e(tenant.youtubeUrl)}" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.97A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg></a>` : '',
    tenant.linkedinUrl ? `<a href="${e(tenant.linkedinUrl)}" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg></a>` : '',
  ].filter(Boolean).join('');

  return `<footer class="bg-gray-900 text-gray-300 py-12">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          ${logoHtml}
          <p class="font-semibold text-white text-lg">${e(tenant.universityName)}</p>
          ${description ? `<p class="mt-2 text-sm text-gray-400 leading-relaxed">${e(description)}</p>` : ''}
          ${socialLinks ? `<div class="flex gap-3 mt-4">${socialLinks}</div>` : ''}
        </div>
        ${(contactTitle || contactAddress) ? `<div>
          ${contactTitle ? `<p class="text-white font-medium mb-3">${e(contactTitle)}</p>` : ''}
          ${contactAddress ? `<p class="text-sm text-gray-400 leading-relaxed">${e(contactAddress)}</p>` : ''}
        </div>` : ''}
        ${tenant.domain ? `<div><p class="text-white font-medium mb-3">Web</p><a href="https://${e(tenant.domain)}" class="text-sm text-gray-400 hover:text-white transition-colors">${e(tenant.domain)}</a></div>` : ''}
      </div>
      <div class="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
        &copy; ${new Date().getFullYear()} ${e(tenant.universityName)}. All rights reserved.
      </div>
    </div>
  </footer>`;
}

function renderDisclaimer(lang: string, section: any): string {
  const c = section?.contentByLang?.[lang] || section?.contentByLang?.['en'] || {};
  if (!c.body) return '';
  return `<div class="bg-gray-100 text-gray-500 text-xs text-center py-3 px-6">${e(c.body)}</div>`;
}

// ─── Main page renderer ────────────────────────────────────────────────────────
function renderLangPage(
  lang: string,
  tenant: any,
  theme: any,
  sectionsList: any[],
  faqList: any[],
  testimonialsList: any[],
  seo: any,
  logoFilename: string | null,
  supportedLangs: string[],
): string {
  const isRTL = lang === 'ar' || lang === 'fa';
  const primaryColor = theme?.primaryColor || '#2563eb';
  const primaryRgb = primaryColor.startsWith('#') && primaryColor.length === 7
    ? hexToRgb(primaryColor) : '37, 99, 235';

  const metaTitle = seo?.metaTitleByLang?.[lang] || tenant.universityName;
  const metaDesc = seo?.metaDescriptionByLang?.[lang] || '';

  const sorted = [...sectionsList]
    .filter(s => s.isEnabled)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const findSection = (key: string) => sorted.find(s => s.sectionKey === key);

  const hero = findSection('hero');
  const trustBadges = findSection('trust_badges');
  const steps = findSection('steps');
  const testimonialsSection = findSection('testimonials');
  const faqSection = findSection('faq');
  const contactSection = findSection('contact');
  const footerSection = findSection('footer');
  const disclaimerSection = findSection('disclaimer');

  const sectionsHtml = sorted.map(s => {
    switch (s.sectionKey) {
      case 'hero': return renderHero(lang, s, tenant, logoFilename, primaryColor, supportedLangs);
      case 'trust_badges': return renderTrustBadges(lang, s);
      case 'steps': return renderSteps(lang, s);
      case 'testimonials': return renderTestimonials(lang, s, testimonialsList);
      case 'faq': return renderFAQ(lang, s, faqList);
      case 'contact': return renderContact(lang, s);
      default: {
        const c = s.contentByLang?.[lang] || s.contentByLang?.['en'] || {};
        if (!c.title) return '';
        return `<section id="${e(s.sectionKey)}" class="py-16 bg-white">
          <div class="max-w-3xl mx-auto px-6">
            <h2 class="text-2xl font-bold text-gray-900">${e(c.title)}</h2>
            ${c.subtitle ? `<p class="mt-2 text-gray-500">${e(c.subtitle)}</p>` : ''}
            ${c.body ? `<p class="mt-4 text-gray-700">${e(c.body)}</p>` : ''}
            ${c.ctaLabel ? `<a href="${e(c.ctaUrl || '#')}" class="inline-block mt-4 px-5 py-2.5 rounded-lg text-white font-medium" style="background:var(--primary)">${e(c.ctaLabel)}</a>` : ''}
          </div>
        </section>`;
      }
    }
  }).join('\n');

  const footerHtml = footerSection ? renderFooter(lang, footerSection, tenant, theme, logoFilename) : `<footer class="bg-gray-900 text-gray-400 text-center py-8 text-sm">&copy; ${new Date().getFullYear()} ${e(tenant.universityName)}</footer>`;
  const disclaimerHtml = disclaimerSection ? renderDisclaimer(lang, disclaimerSection) : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(metaTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${e(metaDesc)}">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '${e(primaryColor)}' }
        }
      }
    }
  </script>
  <style>
    :root { --primary: ${e(primaryColor)}; --primary-rgb: ${e(primaryRgb)}; }
    details summary::-webkit-details-marker { display: none; }
    @font-face { font-family: system-ui; }
    ${isRTL ? 'body { font-family: "Segoe UI", Tahoma, sans-serif; }' : ''}
  </style>
</head>
<body class="bg-white text-gray-900 antialiased">
${sectionsHtml}
${footerHtml}
${disclaimerHtml}
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
    try { const buf = readUpload(tenant.logoUrl); assetsFolder.file(fname, buf); logoFilename = fname; } catch { }
  }

  // Include favicon
  if (tenant.faviconUrl?.startsWith('/objects/uploads/')) {
    const fname = tenant.faviconUrl.slice('/objects/uploads/'.length);
    try { const buf = readUpload(tenant.faviconUrl); assetsFolder.file(fname, buf); } catch { }
  }

  // Include all media assets
  for (const asset of mediaAssets) {
    if (asset.fileUrl?.startsWith('/objects/uploads/')) {
      const fname = asset.fileUrl.slice('/objects/uploads/'.length);
      try { const buf = readUpload(asset.fileUrl); assetsFolder.file(fname, buf); } catch { }
    }
  }

  // Only export languages the tenant supports
  const supportedLangs: string[] = (tenant.supportedLanguages as string[]) || ['en'];

  // Generate HTML for each supported language
  for (const lang of supportedLangs) {
    const html = renderLangPage(lang, tenant, theme, sectionsList, faqList, testimonialsList, seo, logoFilename, supportedLangs);
    zip.folder(lang)!.file('index.html', html);
  }

  // Root redirect to default language
  const defaultLang = supportedLangs[0] || 'en';
  zip.file('index.html', `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${e(defaultLang)}/index.html">
<title>${e(tenant.universityName)}</title>
</head><body><a href="${e(defaultLang)}/index.html">${e(tenant.universityName)}</a></body></html>`);

  // Manifest
  zip.file('manifest.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    universityName: tenant.universityName,
    domain: tenant.domain,
    languages: supportedLangs,
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

// ─── Async export ──────────────────────────────────────────────────────────────
export function startExportJob(tenantId: string): ExportJob {
  const jobId = randomUUID();
  const job: ExportJob = { id: jobId, tenantId, status: 'pending', createdAt: new Date() };
  exportJobs.set(jobId, job);

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
  return { tenant, theme, sections: sectionsList, faqItems: faqList, testimonials: testimonialsList, seoSettings: seo, domains, capturedAt: new Date().toISOString() };
}

// ─── Deterministic restore ─────────────────────────────────────────────────────
export async function restoreSnapshot(tenantId: string, snapshot: Record<string, any>): Promise<void> {
  const { tenant, theme, sections: snapshotSections, faqItems: snapshotFaq, testimonials: snapshotTestimonials, seoSettings: snapshotSeo } = snapshot;

  if (tenant) {
    const { id: _id, createdAt: _c, ...tenantData } = tenant;
    await storage.updateTenant(tenantId, tenantData);
  }

  if (theme) {
    const { id: _id, tenantId: _t, ...themeData } = theme;
    const existing = await storage.getTheme(tenantId);
    if (existing) await storage.updateTheme(tenantId, themeData);
    else await storage.createTheme({ tenantId, ...themeData });
  }

  if (snapshotSeo) {
    const { id: _id, tenantId: _t, ...seoData } = snapshotSeo;
    const existing = await storage.getSeoSettings(tenantId);
    if (existing) await storage.updateSeoSettings(tenantId, seoData);
    else await storage.createSeoSettings({ tenantId, ...seoData });
  }

  if (Array.isArray(snapshotSections)) {
    const currentSections = await storage.getSections(tenantId);
    const snapshotIds = new Set(snapshotSections.map((s: any) => s.id));
    const currentIds = new Set(currentSections.map(s => s.id));
    for (const s of snapshotSections) {
      const { id, tenantId: _t, ...sData } = s;
      if (currentIds.has(id)) await storage.updateSection(id, tenantId, sData);
      else await storage.createSection({ tenantId, ...sData, id } as any);
    }
    for (const cur of currentSections) {
      if (!snapshotIds.has(cur.id)) await storage.deleteSection(cur.id, tenantId);
    }
  }

  if (Array.isArray(snapshotFaq)) {
    const currentFaq = await storage.getFaqItems(tenantId);
    const snapshotIds = new Set(snapshotFaq.map((f: any) => f.id));
    const currentIds = new Set(currentFaq.map(f => f.id));
    for (const f of snapshotFaq) {
      const { id, tenantId: _t, ...fData } = f;
      if (currentIds.has(id)) await storage.updateFaqItem(id, fData);
      else await storage.createFaqItem({ tenantId, ...fData, id } as any);
    }
    for (const cur of currentFaq) {
      if (!snapshotIds.has(cur.id)) await storage.deleteFaqItem(cur.id);
    }
  }

  if (Array.isArray(snapshotTestimonials)) {
    const currentT = await storage.getTestimonials(tenantId);
    const snapshotIds = new Set(snapshotTestimonials.map((t: any) => t.id));
    const currentIds = new Set(currentT.map(t => t.id));
    for (const t of snapshotTestimonials) {
      const { id, tenantId: _t, ...tData } = t;
      if (currentIds.has(id)) await storage.updateTestimonial(id, tData);
      else await storage.createTestimonial({ tenantId, ...tData, id } as any);
    }
    for (const cur of currentT) {
      if (!snapshotIds.has(cur.id)) await storage.deleteTestimonial(cur.id);
    }
  }
}
