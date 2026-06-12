import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { TrustBadges } from '@/components/landing/TrustBadges';
import { Steps } from '@/components/landing/Steps';
import { Testimonials } from '@/components/landing/Testimonials';
import { FAQ } from '@/components/landing/FAQ';
import { Contact } from '@/components/landing/Contact';
import { Disclaimer } from '@/components/landing/Disclaimer';
import { WidgetEmbed } from '@/components/landing/WidgetEmbed';
import { StatsSection, EmbedSection, MapSection, HtmlSection } from '@/components/landing/WidgetSections';
import { Footer } from '@/components/landing/Footer';
import { Preloader } from '@/components/Preloader';
import TrackingScripts from '@/components/TrackingScripts';
import SEOMetaTags from '@/components/SEOMetaTags';
import JsonLd from '@/components/JsonLd';
import { useI18n } from '@/lib/i18n';
import type { Tenant, Section, TenantTheme, SupportedLanguage } from '@shared/schema';

function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '222 47% 11%';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface BootstrapData {
  primaryDomain?: string;
  allDomains?: string[];
}

function renderSection(section: Section) {
  switch (section.sectionKey) {
    case 'hero':         return <Hero key={section.id} />;
    case 'trust_badges': return <TrustBadges key={section.id} />;
    case 'steps':        return <Steps key={section.id} />;
    case 'testimonials': return <Testimonials key={section.id} />;
    case 'faq':          return <FAQ key={section.id} />;
    case 'contact':      return <Contact key={section.id} />;
    case 'chatbox':
    case 'widget':       return <WidgetEmbed key={section.id} />;
    case 'stats':        return <StatsSection key={section.id} section={section} />;
    case 'embed':        return <EmbedSection key={section.id} section={section} />;
    case 'map':          return <MapSection key={section.id} section={section} />;
    case 'html_block':   return <HtmlSection key={section.id} section={section} />;
    default:             return null;
  }
}

export default function Landing() {
  const { language } = useI18n();

  const { data: tenant, isLoading: isTenantLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  const { data: bootstrap } = useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
  });

  const { data: sections = [], isLoading: isSectionsLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  const { data: theme, isLoading: isThemeLoading } = useQuery<TenantTheme>({
    queryKey: ['/api/theme'],
  });

  const isLoading = isTenantLoading || isSectionsLoading || isThemeLoading;

  const nameByLang = tenant?.nameByLang as Record<string, string> | null | undefined;
  const universityName = (nameByLang?.[language]) || nameByLang?.['en'] || tenant?.universityName || 'University';
  const logoUrl = tenant?.logoUrl || undefined;
  const faviconUrl = tenant?.faviconUrl || undefined;

  const heroSection = sections.find(s => s.sectionKey === 'hero');
  const heroSettings = heroSection?.settings as { headerApplyLink?: string } | undefined;
  const headerApplyLink = heroSettings?.headerApplyLink || '#contact';

  useEffect(() => {
    if (theme) {
      const root = document.documentElement;
      if (theme.primaryColor) root.style.setProperty('--primary', hexToHSL(theme.primaryColor));
      if (theme.secondaryColor) root.style.setProperty('--accent', hexToHSL(theme.secondaryColor));
      if (theme.backgroundColor) root.style.setProperty('--background', hexToHSL(theme.backgroundColor));
      if (theme.textColor) root.style.setProperty('--foreground', hexToHSL(theme.textColor));
    }
  }, [theme]);

  useEffect(() => {
    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [faviconUrl]);

  if (isLoading) {
    return <Preloader logoUrl={logoUrl} universityName={universityName} />;
  }

  const orderedSections = [...sections]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .filter(s => s.isEnabled);

  return (
    <div className="min-h-screen flex flex-col">
      <TrackingScripts />
      <SEOMetaTags lang={language as SupportedLanguage} primaryDomain={bootstrap?.primaryDomain || tenant?.domain} />
      <JsonLd primaryDomain={bootstrap?.primaryDomain || tenant?.domain} />
      <Header universityName={universityName} logoUrl={logoUrl} applyLink={headerApplyLink} />
      <main className="flex-1">
        {orderedSections.length > 0
          ? orderedSections.map(renderSection)
          : (
            <>
              <Hero />
              <TrustBadges />
              <Steps />
              <Testimonials />
              <FAQ />
              <WidgetEmbed />
            </>
          )
        }
      </main>
      <Disclaimer />
      <Footer
        universityName={universityName}
        logoUrl={logoUrl}
        facebookUrl={tenant?.facebookUrl || undefined}
        instagramUrl={tenant?.instagramUrl || undefined}
        linkedinUrl={tenant?.linkedinUrl || undefined}
        youtubeUrl={tenant?.youtubeUrl || undefined}
      />
    </div>
  );
}
