import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, GraduationCap } from 'lucide-react';

interface HeaderProps {
  universityName?: string;
  logoUrl?: string;
}

export function Header({ universityName = 'University', logoUrl }: HeaderProps) {
  const { t, isRTL } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const navItems = [
    { key: 'nav.home', href: '#hero' },
    { key: 'nav.programs', href: '#programs' },
    { key: 'nav.faq', href: '#faq' },
    { key: 'nav.contact', href: '#contact' },
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
          {logoUrl && logoUrl.trim() !== '' && !logoError ? (
            <img 
              src={logoUrl} 
              alt={universityName} 
              className="h-10 w-auto"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-2">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">{universityName}</span>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              size="sm"
              onClick={() => scrollToSection(item.href)}
              data-testid={`nav-${item.key.split('.')[1]}`}
            >
              {t(item.key)}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/apply">
            <Button size="sm" className="hidden sm:flex" data-testid="button-apply-header">
              {t('nav.apply')}
            </Button>
          </Link>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'left' : 'right'} className="w-72">
              <nav className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className="justify-start"
                    onClick={() => scrollToSection(item.href)}
                  >
                    {t(item.key)}
                  </Button>
                ))}
                <Link href="/apply">
                  <Button className="w-full mt-4" data-testid="button-apply-mobile">
                    {t('nav.apply')}
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
