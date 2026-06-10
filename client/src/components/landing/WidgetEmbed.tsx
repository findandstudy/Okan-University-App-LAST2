import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import type { Widget } from '@shared/schema';

function WidgetBlock({ widget }: { widget: Widget }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!widget.embedCode || !containerRef.current) return;
    const clean = DOMPurify.sanitize(widget.embedCode, {
      ADD_TAGS: ['script', 'iframe'],
      ADD_ATTR: ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'async', 'defer', 'charset'],
      FORCE_BODY: true,
    });
    containerRef.current.innerHTML = clean;
    // Re-execute any inline scripts
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
  }, [widget.embedCode]);

  if (widget.iframeUrl) {
    return (
      <div className="w-full" data-testid={`widget-iframe-${widget.id}`}>
        <iframe
          src={widget.iframeUrl}
          className="w-full border-0"
          style={{ minHeight: 400 }}
          allow="camera; microphone; geolocation"
          loading="lazy"
          title={widget.name}
        />
      </div>
    );
  }

  if (widget.embedCode) {
    return (
      <div
        ref={containerRef}
        className="w-full"
        data-testid={`widget-embed-${widget.id}`}
      />
    );
  }

  return null;
}

export function WidgetEmbed() {
  const { data: widgets = [] } = useQuery<Widget[]>({
    queryKey: ['/api/widgets'],
  });

  const enabled = widgets.filter(w => w.isEnabled);
  if (enabled.length === 0) return (
    <section className="w-full py-8" data-testid="widget-empty-state">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-center min-h-24 border-2 border-dashed border-muted-foreground/20 rounded-lg text-muted-foreground text-sm">
        Widget alanı boş — yönetici panelinden embed kodu ekleyin.
      </div>
    </section>
  );

  return (
    <>
      {enabled.map(widget => (
        <section key={widget.id} className="w-full" data-testid={`widget-section-${widget.id}`}>
          <div className="max-w-6xl mx-auto px-4">
            <WidgetBlock widget={widget} />
          </div>
        </section>
      ))}
    </>
  );
}
