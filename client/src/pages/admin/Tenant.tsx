import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useUpload } from '@/hooks/use-upload';
import { Globe, Upload, Loader2, X, Image as ImageIcon, Facebook, Instagram, Linkedin, Youtube, Video, Languages } from 'lucide-react';
import AdminLayout from './AdminLayout';
import FooterContent from './FooterContent';
import ContactInfo from './ContactInfo';
import { useSiteContext } from '@/lib/siteContext';
import type { Tenant, SupportedLanguage } from '@shared/schema';

const ALL_LANGS: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'ar', label: 'AR' }, { code: 'tr', label: 'TR' },
  { code: 'fr', label: 'FR' }, { code: 'ru', label: 'RU' }, { code: 'fa', label: 'FA' },
  { code: 'zh', label: 'ZH' }, { code: 'hi', label: 'HI' }, { code: 'es', label: 'ES' },
  { code: 'id', label: 'ID' },
];

interface DropZoneProps {
  label: string;
  value: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  accept: string;
  testId: string;
}

function DropZone({ label, value, onUpload, onClear, accept, testId }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const { uploadFile, isUploading, error } = useUpload({
    onSuccess: (response) => {
      onUpload(response.objectPath);
      toast({
        title: 'Upload complete',
        description: `${label} uploaded successfully.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Upload failed',
        description: err.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file);
    }
  }, [uploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    e.target.value = '';
  }, [uploadFile]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-background border flex items-center justify-center overflow-hidden">
              <img 
                src={value} 
                alt={label} 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.split('/').pop()}</p>
              <p className="text-xs text-muted-foreground">Uploaded file</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              data-testid={`button-clear-${testId}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <label
          className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid={`dropzone-${testId}`}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
            data-testid={`input-file-${testId}`}
          />
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to upload
              </p>
            </>
          )}
        </label>
      )}
    </div>
  );
}

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

export default function TenantPage({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);
  const [settings, setSettings] = useState({
    universityName: '',
    domain: '',
    logoUrl: '',
    faviconUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    youtubeUrl: '',
    heroVideoUrl: '',
  });
  const [nameByLang, setNameByLang] = useState<Partial<Record<SupportedLanguage, string>>>({});
  const [nameLang, setNameLang] = useState<SupportedLanguage>('en');

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant' + apiSuffix],
  });

  useEffect(() => {
    if (tenant) {
      setSettings({
        universityName: tenant.universityName || '',
        domain: tenant.domain || '',
        logoUrl: tenant.logoUrl || '',
        faviconUrl: tenant.faviconUrl || '',
        facebookUrl: tenant.facebookUrl || '',
        instagramUrl: tenant.instagramUrl || '',
        linkedinUrl: tenant.linkedinUrl || '',
        youtubeUrl: tenant.youtubeUrl || '',
        heroVideoUrl: tenant.heroVideoUrl || '',
      });
      setNameByLang((tenant.nameByLang as Partial<Record<SupportedLanguage, string>>) || {});
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof settings & { nameByLang: Partial<Record<SupportedLanguage, string>> }) => {
      const response = await apiRequest('PATCH', '/api/tenant' + apiSuffix, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant' + apiSuffix] });
      toast({ title: 'Settings saved', description: 'Tenant settings have been updated.' });
    },
    onError: async (err: any) => {
      let message = 'Failed to save settings.';
      try {
        const body = await err?.response?.json?.();
        if (body?.error) message = body.error;
      } catch {}
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    },
  });

  const [translateProgress, setTranslateProgress] = useState<string | null>(null);

  const translateEverythingMutation = useMutation({
    mutationFn: async () => {
      const enName = nameByLang['en'] || settings.universityName;
      if (!enName) throw new Error('Please enter the English university name first');
      setTranslateProgress('Translating university name…');
      const res = await apiRequest('POST', `/api/admin/ai/translate-everything${apiSuffix}`, { enName });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');
      return data as { steps: string[] };
    },
    onSuccess: () => {
      setTranslateProgress(null);
      queryClient.invalidateQueries({ queryKey: ['/api/tenant' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/faq' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/testimonials' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/seo-settings' + apiSuffix] });
      toast({ title: '✅ Everything translated', description: 'University name, sections (including hero & trust badges), FAQ, testimonials, contact info, footer and SEO meta tags are now translated into 9 languages.' });
    },
    onError: (err: Error) => {
      setTranslateProgress(null);
      toast({ title: 'Translation failed', description: err.message, variant: 'destructive' });
    },
  });

  const footerSaveRef = useRef<(() => void) | null>(null);
  const contactSaveRef = useRef<(() => void) | null>(null);

  const handleSave = () => {
    updateMutation.mutate({ ...settings, nameByLang });
    footerSaveRef.current?.();
    contactSaveRef.current?.();
  };

  if (isLoading) {
    return (
      <EmbeddableLayout embedded={embedded}>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </EmbeddableLayout>
    );
  }

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Branding &amp; Identity</h1>
          <p className="text-muted-foreground">Logo, favicon, social links and site identity</p>
        </div>

        {/* ── Master: Translate Everything ── */}
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-sm">AI — Translate Everything</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Translates <span className="font-medium">university name, all sections (hero, trust badges, footer, contact info), FAQ, testimonials and SEO meta tags</span> into <span className="font-medium">AR, TR, FR, RU, FA, ZH, HI, ES, ID</span> in one click. Existing translations will be overwritten.
              </p>
              {translateProgress && (
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {translateProgress}
                </p>
              )}
            </div>
            <Button
              type="button"
              className="gap-2 flex-shrink-0"
              onClick={() => translateEverythingMutation.mutate()}
              disabled={translateEverythingMutation.isPending}
              data-testid="button-translate-everything"
            >
              {translateEverythingMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Languages className="h-4 w-4" />}
              {translateEverythingMutation.isPending ? 'Translating…' : 'Translate Everything'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>University Identity</CardTitle>
            <CardDescription>Basic information about your institution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>University Name</Label>

              {/* Language tabs */}
              <div className="flex flex-wrap gap-1">
                {ALL_LANGS.map(({ code, label }) => (
                  <Button
                    key={code}
                    type="button"
                    size="sm"
                    variant={nameLang === code ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => setNameLang(code)}
                  >
                    {label}
                    {nameByLang[code] && nameLang !== code && (
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    )}
                  </Button>
                ))}
              </div>

              <Input
                value={nameLang === 'en'
                  ? (nameByLang['en'] ?? settings.universityName)
                  : (nameByLang[nameLang] ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (nameLang === 'en') {
                    setSettings(s => ({ ...s, universityName: val }));
                    setNameByLang(prev => ({ ...prev, en: val }));
                  } else {
                    setNameByLang(prev => ({ ...prev, [nameLang]: val }));
                  }
                }}
                placeholder={nameLang === 'en' ? 'e.g., Okan University' : `Name in ${ALL_LANGS.find(l => l.code === nameLang)?.label}…`}
                data-testid="input-university-name"
              />
              {nameLang === 'en' && (
                <p className="text-xs text-muted-foreground">This is the primary (English) name. Fill other tabs or use "Translate" to auto-fill.</p>
              )}
            </div>

            <div>
              <Label>Domain</Label>
              <div className="relative mt-1.5">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={settings.domain}
                  onChange={(e) =>
                    setSettings({ ...settings, domain: e.target.value })
                  }
                  placeholder="okanuniversity.app"
                  className="pl-10"
                  data-testid="input-domain"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <DropZone
                label="Logo"
                value={settings.logoUrl}
                onUpload={(url) => setSettings({ ...settings, logoUrl: url })}
                onClear={() => setSettings({ ...settings, logoUrl: '' })}
                accept="image/*"
                testId="logo"
              />

              <DropZone
                label="Favicon"
                value={settings.faviconUrl}
                onUpload={(url) => setSettings({ ...settings, faviconUrl: url })}
                onClear={() => setSettings({ ...settings, faviconUrl: '' })}
                accept="image/*,.ico"
                testId="favicon"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Media Links</CardTitle>
            <CardDescription>Add your social media profiles for the footer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Facebook</Label>
                <div className="relative mt-1.5">
                  <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={settings.facebookUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, facebookUrl: e.target.value })
                    }
                    placeholder="https://facebook.com/yourpage"
                    className="pl-10"
                    data-testid="input-facebook-url"
                  />
                </div>
              </div>

              <div>
                <Label>Instagram</Label>
                <div className="relative mt-1.5">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={settings.instagramUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, instagramUrl: e.target.value })
                    }
                    placeholder="https://instagram.com/yourpage"
                    className="pl-10"
                    data-testid="input-instagram-url"
                  />
                </div>
              </div>

              <div>
                <Label>LinkedIn</Label>
                <div className="relative mt-1.5">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={settings.linkedinUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, linkedinUrl: e.target.value })
                    }
                    placeholder="https://linkedin.com/company/yourpage"
                    className="pl-10"
                    data-testid="input-linkedin-url"
                  />
                </div>
              </div>

              <div>
                <Label>YouTube</Label>
                <div className="relative mt-1.5">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={settings.youtubeUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, youtubeUrl: e.target.value })
                    }
                    placeholder="https://youtube.com/@yourchannel"
                    className="pl-10"
                    data-testid="input-youtube-url"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Hero Video
            </CardTitle>
            <CardDescription>
              Add a YouTube video URL for the Campus Tour video on the hero section
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>YouTube Video URL</Label>
              <div className="relative mt-1.5">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={settings.heroVideoUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, heroVideoUrl: e.target.value })
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="pl-10"
                  data-testid="input-hero-video-url"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Paste a YouTube video URL or embed link. The video will be displayed in the hero section.
              </p>
            </div>
            {settings.heroVideoUrl && (
              <div className="border rounded-lg overflow-hidden">
                <div className="aspect-video">
                  <iframe
                    src={getYouTubeEmbedUrl(settings.heroVideoUrl)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Hero Video Preview"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <FooterContent embedded saveTriggerRef={footerSaveRef} />

        <ContactInfo embedded saveTriggerRef={contactSaveRef} />

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-tenant"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </EmbeddableLayout>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  
  let videoId = '';
  
  if (url.includes('youtube.com/watch')) {
    const urlParams = new URL(url).searchParams;
    videoId = urlParams.get('v') || '';
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}
