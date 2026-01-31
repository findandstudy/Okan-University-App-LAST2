import { useI18n } from '@/lib/i18n';
import { GraduationCap } from 'lucide-react';
import { SiInstagram, SiFacebook, SiLinkedin, SiYoutube } from 'react-icons/si';

interface FooterProps {
  universityName?: string;
}

export function Footer({ universityName = 'University' }: FooterProps) {
  const { t, isRTL } = useI18n();
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { icon: SiFacebook, href: '#', label: 'Facebook' },
    { icon: SiInstagram, href: '#', label: 'Instagram' },
    { icon: SiLinkedin, href: '#', label: 'LinkedIn' },
    { icon: SiYoutube, href: '#', label: 'YouTube' },
  ];

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
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-lg bg-primary p-2">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">{universityName}</span>
            </div>
            <p className="text-muted-foreground max-w-md mb-6">
              Your gateway to world-class education. We help students from around the globe achieve their academic dreams with personalized guidance and support.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                  aria-label={social.label}
                  data-testid={`social-${social.label.toLowerCase()}`}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
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

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>apply@okanuniversity.app</li>
              <li>+90 212 123 4567</li>
              <li>Istanbul, Turkey</li>
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
