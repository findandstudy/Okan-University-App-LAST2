import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { GraduationCap } from 'lucide-react';
import { SiInstagram, SiFacebook, SiLinkedin, SiYoutube } from 'react-icons/si';

interface FooterProps {
  universityName?: string;
  logoUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
}

interface FooterSettings {
  description?: Record<string, string>;
  contactTitle?: Record<string, string>;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: Record<string, string>;
}

export function Footer({ 
  universityName = 'University', 
  logoUrl,
  facebookUrl,
  instagramUrl,
  linkedinUrl,
  youtubeUrl,
}: FooterProps) {
  const { t, isRTL, language } = useI18n();
  const currentYear = new Date().getFullYear();
  const [logoError, setLogoError] = useState(false);
  const currentLang = language as string;

  const { data: sections = [] } = useQuery<any[]>({
    queryKey: ['/api/sections'],
  });

  const footerSection = sections.find(s => s.sectionKey === 'footer');
  const footerSettings = footerSection?.settings as FooterSettings | undefined;

  const description = footerSettings?.description?.[currentLang] || footerSettings?.description?.en || 
    'Your gateway to world-class education. We help students from around the globe achieve their academic dreams with personalized guidance and support.';
  const contactTitle = footerSettings?.contactTitle?.[currentLang] || footerSettings?.contactTitle?.en || 'Contact';
  const contactEmail = footerSettings?.contactEmail || 'apply@okanuniversity.app';
  const contactPhone = footerSettings?.contactPhone || '+90 552 689 85 15';
  const contactAddress = footerSettings?.contactAddress?.[currentLang] || footerSettings?.contactAddress?.en || 'Istanbul Okan University Campus';

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const socialLinks = [
    { icon: SiFacebook, href: facebookUrl, label: 'Facebook' },
    { icon: SiInstagram, href: instagramUrl, label: 'Instagram' },
    { icon: SiLinkedin, href: linkedinUrl, label: 'LinkedIn' },
    { icon: SiYoutube, href: youtubeUrl, label: 'YouTube' },
  ].filter(link => link.href);

  const quickLinks = [
    { label: 'Programs', href: '#programs' },
    { label: 'Apply Now', href: '/apply' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <footer className="bg-card border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 text-center md:text-left flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-4">
              {logoUrl && logoUrl.trim() !== '' && !logoError ? (
                <img 
                  src={logoUrl} 
                  alt={universityName} 
                  className="h-[3.75rem] w-auto"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <>
                  <div className="rounded-lg bg-primary p-2">
                    <GraduationCap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-lg">{universityName}</span>
                </>
              )}
            </div>
            <p className="text-muted-foreground max-w-md mb-6">
              {description}
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-3 justify-center md:justify-start">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                    aria-label={social.label}
                    data-testid={`social-${social.label.toLowerCase()}`}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="text-center md:text-left">
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h4 className="font-semibold mb-4">{contactTitle}</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>{contactEmail}</li>
              <li>{contactPhone}</li>
              <li>{contactAddress}</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} {universityName}. {t('footer.rights')}.
          </p>
        </div>
      </div>
    </footer>
  );
}
