import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import type { Section } from '@shared/schema';

export function Disclaimer() {
  const { language } = useI18n();
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  const disclaimerSection = sections.find(s => s.sectionKey === 'disclaimer');
  if (!disclaimerSection?.isEnabled) return null;

  const content = disclaimerSection.contentByLang;
  const currentLang = language as string;
  const text =
    (content as any)?.[currentLang]?.body ||
    (content as any)?.en?.body;

  if (!text) return null;

  return (
    <section className="py-6 bg-muted/50 border-t" id="disclaimer" data-testid="section-disclaimer">
      <div className="container mx-auto px-4">
        <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-4xl mx-auto">
          {text}
        </p>
      </div>
    </section>
  );
}
