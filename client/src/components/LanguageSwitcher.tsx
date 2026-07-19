import { useI18n, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, SupportedLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { useLocation } from 'wouter';

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();
  const [, setLocation] = useLocation();

  // Keep the URL in sync with the selected language.
  // SSR meta (seoRenderer) and i18n both read the language from the URL prefix,
  // so changing state alone would leave canonical/og tags on the wrong language
  // and revert on reload.
  const handleSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);

    const path = window.location.pathname;
    // Admin routes are never language-prefixed.
    if (path.startsWith('/admin')) return;

    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0 && (SUPPORTED_LANGUAGES as readonly string[]).includes(segments[0])) {
      segments[0] = lang;
    } else {
      segments.unshift(lang);
    }
    setLocation('/' + segments.join('/') + window.location.search);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-language-switcher">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{LANGUAGE_NAMES[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleSelect(lang as SupportedLanguage)}
            className={language === lang ? 'bg-accent' : ''}
            data-testid={`menu-item-language-${lang}`}
          >
            {LANGUAGE_NAMES[lang as SupportedLanguage]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
