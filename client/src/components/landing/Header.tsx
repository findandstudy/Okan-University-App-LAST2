import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, GraduationCap } from 'lucide-react';

const LOGO_CACHE_KEY = 'cached_logo_url';
const NAME_CACHE_KEY = 'cached_university_name';

interface HeaderProps {
  universityName?: string;
  logoUrl?: string;
}

export function Header({ universityName = 'University', logoUrl }: HeaderProps) {
  const { t, isRTL, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  // Use cached values for instant display, then update with fresh data
  const [cachedLogoUrl] = useState(() => {
    try {
      return localStorage.getItem(LOGO_CACHE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [cachedName] = useState(() => {
    try {
      return localStorage.getItem(NAME_CACHE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Cache the logo URL and name when they change
  useEffect(() => {
    if (logoUrl && logoUrl.trim() !== '') {
      try {
        localStorage.setItem(LOGO_CACHE_KEY, logoUrl);
      } catch {}
    }
  }, [logoUrl]);

  useEffect(() => {
    if (universityName && universityName !== 'University') {
      try {
        localStorage.setItem(NAME_CACHE_KEY, universityName);
      } catch {}
    }
  }, [universityName]);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);
  
  // Use the prop value if available, otherwise fall back to cached value
  const displayLogoUrl = logoUrl || cachedLogoUrl;
  const displayName = universityName !== 'University' ? universityName : (cachedName || universityName);

  const blogUrl = `/${language}/blog`;

  const navItems = [
    { key: 'nav.home', href: '#hero', type: 'scroll' as const },
    { key: 'nav.faq', href: '#faq', type: 'scroll' as const },
    { key: 'nav.contact', href: '#contact', type: 'scroll' as const },
    { key: 'nav.blog', href: blogUrl, type: 'link' as const },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {displayLogoUrl && displayLogoUrl.trim() !== '' && !logoError ? (
            <img 
              src={displayLogoUrl} 
              alt={displayName} 
              loading="eager"
              decoding="async"
              className="h-12 w-auto object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-2">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">{displayName}</span>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) =>
            item.type === 'link' ? (
              <Link key={item.key} href={item.href}>
                <Button variant="ghost" size="sm" data-testid={`nav-${item.key.split('.')[1]}`}>
                  {t(item.key)}
                </Button>
              </Link>
            ) : (
              <Button
                key={item.key}
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection(item.href)}
                data-testid={`nav-${item.key.split('.')[1]}`}
              >
                {t(item.key)}
              </Button>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button
            size="sm"
            className="hidden sm:flex"
            data-testid="button-apply-header"
            onClick={() => scrollToSection('#contact')}
          >
            {t('nav.apply')}
          </Button>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'left' : 'right'} className="w-72">
              <nav className="flex flex-col gap-2 mt-8">
                {navItems.map((item) =>
                  item.type === 'link' ? (
                    <Link key={item.key} href={item.href} onClick={() => setIsOpen(false)}>
                      <Button variant="ghost" className="justify-start w-full">
                        {t(item.key)}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      key={item.key}
                      variant="ghost"
                      className="justify-start"
                      onClick={() => scrollToSection(item.href)}
                    >
                      {t(item.key)}
                    </Button>
                  )
                )}
                <Button
                  className="w-full mt-4"
                  data-testid="button-apply-mobile"
                  onClick={() => scrollToSection('#contact')}
                >
                  {t('nav.apply')}
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
