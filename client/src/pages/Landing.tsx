import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { TrustBadges } from '@/components/landing/TrustBadges';
import { ProgramFinder } from '@/components/landing/ProgramFinder';
import { Steps } from '@/components/landing/Steps';
import { Testimonials } from '@/components/landing/Testimonials';
import { FAQ } from '@/components/landing/FAQ';
import { Contact } from '@/components/landing/Contact';
import { Footer } from '@/components/landing/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import TrackingScripts from '@/components/TrackingScripts';
import type { Tenant, Section } from '@shared/schema';

export default function Landing() {
  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  const universityName = tenant?.universityName || 'University';
  const logoUrl = tenant?.logoUrl || undefined;
  const faviconUrl = tenant?.faviconUrl || undefined;

  // Dynamically set favicon and page title based on tenant
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
    
    if (universityName && universityName !== 'University') {
      document.title = universityName;
    }
  }, [faviconUrl, universityName]);

  const isChatboxEnabled = sections.find(s => s.sectionKey === 'chatbox')?.isEnabled ?? true;

  return (
    <div className="min-h-screen flex flex-col">
      <TrackingScripts />
      <Header universityName={universityName} logoUrl={logoUrl} />
      <main className="flex-1">
        <Hero />
        <TrustBadges />
        <ProgramFinder />
        <Steps />
        <Testimonials />
        <FAQ />
        <Contact />
      </main>
      <Footer 
        universityName={universityName} 
        logoUrl={logoUrl}
        facebookUrl={tenant?.facebookUrl || undefined}
        instagramUrl={tenant?.instagramUrl || undefined}
        linkedinUrl={tenant?.linkedinUrl || undefined}
        youtubeUrl={tenant?.youtubeUrl || undefined}
      />
      {isChatboxEnabled && <ChatWidget />}
    </div>
  );
}
