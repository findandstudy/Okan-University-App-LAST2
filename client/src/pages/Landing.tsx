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

export default function Landing() {
  const universityName = 'Okan University';

  return (
    <div className="min-h-screen flex flex-col">
      <Header universityName={universityName} />
      <main className="flex-1">
        <Hero />
        <TrustBadges />
        <ProgramFinder />
        <Steps />
        <Testimonials />
        <FAQ />
        <Contact />
      </main>
      <Footer universityName={universityName} />
      <ChatWidget />
    </div>
  );
}
