import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import type { Section } from '@shared/schema';

interface WidgetSectionProps {
  section: Section;
}

interface StatItem {
  value: string;
  label: string;
}

interface StatsSettings {
  items?: StatItem[];
}

interface EmbedSettings {
  iframeUrl?: string;
  embedCode?: string;
  height?: number;
}

interface MapSettings {
  mapUrl?: string;
  height?: number;
}

interface HtmlSettings {
  html?: string;
}

export function StatsSection({ section }: WidgetSectionProps) {
  const settings = (section.settings || {}) as StatsSettings;
  const items = settings.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-16 bg-primary text-primary-foreground" data-testid="stats-section">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item, idx) => (
            <div key={idx} className="text-center" data-testid={`stat-item-${idx}`}>
              <div className="text-4xl font-bold mb-2">{item.value}</div>
              <div className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wide">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EmbedSection({ section }: WidgetSectionProps) {
  const settings = (section.settings || {}) as EmbedSettings;
  const containerRef = useRef<HTMLDivElement>(null);
  const height = settings.height || 500;

  useEffect(() => {
    if (!settings.embedCode || !containerRef.current) return;
    const clean = DOMPurify.sanitize(settings.embedCode, {
      ADD_TAGS: ['script', 'iframe'],
      ADD_ATTR: ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'async', 'defer', 'charset'],
      FORCE_BODY: true,
    });
    containerRef.current.innerHTML = clean;
    const scripts = containerRef.current.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [settings.embedCode]);

  if (!settings.iframeUrl && !settings.embedCode) return null;

  return (
    <section className="py-8" data-testid="embed-section">
      <div className="max-w-6xl mx-auto px-4">
        {settings.iframeUrl ? (
          <iframe
            src={settings.iframeUrl}
            className="w-full border-0 rounded-lg"
            style={{ height }}
            allow="camera; microphone; geolocation"
            loading="lazy"
            title={section.sectionKey}
          />
        ) : (
          <div ref={containerRef} className="w-full" />
        )}
      </div>
    </section>
  );
}

export function MapSection({ section }: WidgetSectionProps) {
  const settings = (section.settings || {}) as MapSettings;
  const height = settings.height || 400;

  if (!settings.mapUrl) return null;

  return (
    <section className="py-8" data-testid="map-section">
      <div className="max-w-6xl mx-auto px-4">
        <iframe
          src={settings.mapUrl}
          className="w-full border-0 rounded-lg"
          style={{ height }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          title="Map"
        />
      </div>
    </section>
  );
}

export function HtmlSection({ section }: WidgetSectionProps) {
  const settings = (section.settings || {}) as HtmlSettings;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settings.html || !containerRef.current) return;
    const clean = DOMPurify.sanitize(settings.html, {
      ADD_TAGS: ['script', 'iframe', 'style'],
      ADD_ATTR: ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'async', 'defer', 'charset', 'type'],
      FORCE_BODY: true,
    });
    containerRef.current.innerHTML = clean;
    const scripts = containerRef.current.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [settings.html]);

  if (!settings.html) return null;

  return (
    <section className="py-8" data-testid="html-section">
      <div className="max-w-6xl mx-auto px-4">
        <div ref={containerRef} className="w-full" />
      </div>
    </section>
  );
}
