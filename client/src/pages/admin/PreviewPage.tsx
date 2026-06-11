import { useState, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Globe, Monitor, Tablet, Smartphone, RefreshCw, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Tenant } from '@shared/schema';

const PREVIEW_LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'fa', label: '🇮🇷 Farsi' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'id', label: '🇮🇩 Indonesian' },
];

const DEVICE_SIZES = [
  { id: 'desktop', icon: Monitor,     label: 'Desktop', width: '100%' },
  { id: 'tablet',  icon: Tablet,      label: 'Tablet',  width: '768px' },
  { id: 'mobile',  icon: Smartphone,  label: 'Mobile',  width: '390px' },
] as const;

type DeviceId = typeof DEVICE_SIZES[number]['id'];

export default function PreviewPage() {
  const { tenantId, lang: initialLang } = useParams<{ tenantId: string; lang?: string }>();
  const [lang, setLang] = useState(initialLang || 'en');
  const [device, setDevice] = useState<DeviceId>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: admin, isLoading: authLoading } = useQuery({
    queryKey: ['/api/admin/me'],
    retry: false,
    staleTime: 30_000,
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/admin/tenants', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tenant');
      return res.json();
    },
    enabled: !!admin && !!tenantId,
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!admin) {
    window.location.href = '/admin/login';
    return null;
  }

  const tidParam = tenantId && tenantId !== 'default' ? `?_tid=${tenantId}` : '';
  const previewSrc = `/${lang}${tidParam}`;
  const deviceWidth = DEVICE_SIZES.find(d => d.id === device)?.width ?? '100%';
  const isNarrow = device !== 'desktop';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-900">
      {/* ── Preview Banner ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-zinc-900 border-b border-white/10 px-3 py-2 flex items-center gap-2 z-50"
        data-testid="preview-banner"
      >
        {/* Back to editor */}
        <Link href={`/admin/sites/${tenantId}`}>
          <Button
            variant="ghost" size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-2.5"
            data-testid="button-back-to-editor"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Back to Editor</span>
          </Button>
        </Link>

        <div className="w-px h-4 bg-white/20" />

        {/* Preview badge + site name */}
        <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
          Preview
        </span>
        <span className="text-xs text-white/50 truncate max-w-48 hidden sm:block">
          {tenant?.universityName || tenantId} — not live
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Device switcher */}
        <div className="flex items-center rounded border border-white/15 overflow-hidden">
          {DEVICE_SIZES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              title={label}
              data-testid={`button-preview-device-${id}`}
              className={`px-2.5 py-1.5 transition-colors ${
                device === id ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Language picker */}
        <Select value={lang} onValueChange={v => { setLang(v); setRefreshKey(k => k + 1); }}>
          <SelectTrigger
            className="w-36 h-8 bg-white/10 border-white/15 text-white text-xs [&>span]:text-white focus:ring-0"
            data-testid="select-preview-lang"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PREVIEW_LANGUAGES.map(l => (
              <SelectItem key={l.code} value={l.code} data-testid={`option-preview-lang-${l.code}`}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refresh */}
        <Button
          variant="ghost" size="sm"
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
          data-testid="button-preview-refresh"
          title="Refresh preview"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        {/* Live site */}
        {tenant?.domain && (
          <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost" size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-2.5"
              data-testid="button-live-site"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-xs hidden md:inline">Live Site</span>
            </Button>
          </a>
        )}
      </div>

      {/* ── iframe Area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex justify-center bg-zinc-800/50">
        <div
          style={{
            width: deviceWidth,
            transition: 'width 0.3s ease',
            background: 'white',
            boxShadow: isNarrow
              ? '0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.4)'
              : 'none',
          }}
        >
          <iframe
            key={`${tenantId}-${lang}-${refreshKey}`}
            ref={iframeRef}
            src={previewSrc}
            title="Site Preview"
            data-testid="iframe-full-preview"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}
