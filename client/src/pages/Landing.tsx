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
import type { Tenant } from '@shared/schema';

export default function Landing() {
  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  const universityName = tenant?.universityName || 'University';
  const logoUrl = tenant?.logoUrl || undefined;

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
      <Footer universityName={universityName} logoUrl={logoUrl} />
      <ChatWidget />
    </div>
  );
}
