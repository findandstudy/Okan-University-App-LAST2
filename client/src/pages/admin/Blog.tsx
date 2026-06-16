import { useState, useRef, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Upload, Trash2, CheckCircle, Calendar, Plus,
  ChevronLeft, ChevronRight, LayoutList, Image, Star,
  Search, ArrowUpDown, X, Pencil, Copy, ExternalLink, Download,
  Globe, FileText, Link, Languages, Wand2, BookOpen,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import { useLocation } from 'wouter';

interface BlogPostWithTranslations {
  id: string;
  tenantId: string;
  status: string;
  publishAt: string | null;
  createdAt: string;
  keyword: string | null;
  backlinkSites: string[];
  isAiGenerated: boolean;
  featuredImageUrl: string | null;
  translations: Array<{
    id: string;
    lang: string;
    title: string;
    slug: string;
    content: string;
    metaTitle: string | null;
    metaDesc: string | null;
  }>;
}

interface BlogPostImage {
  id: string;
  postId: string;
  url: string;
  altByLang: Record<string, string> | null;
  attribution: string | null;
  source: string;
  position: number;
}

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

// ── Image Management Dialog ───────────────────────────────────────────────
function BlogImagesDialog({ post, onClose, apiSuffix }: { post: BlogPostWithTranslations; onClose: () => void; apiSuffix: string }) {
  const { toast } = useToast();
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const { data: images = [], isLoading } = useQuery<BlogPostImage[]>({
    queryKey: ['/api/admin/blog', post.id, 'images', apiSuffix],
    queryFn: () => fetch(`/api/admin/blog/${post.id}/images${apiSuffix}`, { credentials: 'include' }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (imgId: string) => apiRequest('DELETE', `/api/admin/blog/${post.id}/images/${imgId}${apiSuffix}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images', apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'Image deleted' });
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const setFeaturedMutation = useMutation({
    mutationFn: (img: BlogPostImage) => apiRequest('PATCH', `/api/admin/blog/${post.id}/featured-image${apiSuffix}`, {
      url: img.url,
      altByLang: img.altByLang || {},
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'Featured image updated' });
    },
    onError: () => toast({ title: 'Failed to set featured image', variant: 'destructive' }),
  });

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/generate-images${apiSuffix}`, {});
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Generation failed');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images', apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'Image generated!' });
    } catch (e: any) {
      toast({ title: 'Image generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}/images/upload${apiSuffix}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images', apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      if (imgFileRef.current) imgFileRef.current.value = '';
    }
  };

  const enTitle = post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground line-clamp-1">{enTitle}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleGenerateImage} disabled={generatingImage} data-testid="button-generate-image">
          {generatingImage
            ? <><span className="w-3.5 h-3.5 mr-1.5 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />Generating…</>
            : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate with AI / Stock</>
          }
        </Button>
        <input ref={imgFileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} data-testid="input-image-upload" />
        <Button size="sm" variant="outline" onClick={() => imgFileRef.current?.click()} data-testid="button-upload-image">
          <Upload className="w-3.5 h-3.5 mr-1.5" />Upload Image
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading images…</div>
      ) : images.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          No images yet. Generate one or upload manually.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {images.map(img => {
            const isFeatured = post.featuredImageUrl === img.url;
            return (
              <div key={img.id} data-testid={`blog-image-${img.id}`}
                className={`relative group rounded-lg overflow-hidden border-2 ${isFeatured ? 'border-primary' : 'border-border'}`}>
                <img src={img.url} alt={img.altByLang?.en || ''} className="w-full aspect-video object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!isFeatured && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setFeaturedMutation.mutate(img)} data-testid={`button-set-featured-${img.id}`}>
                      <Star className="w-3 h-3 mr-1" />Featured
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(img.id)} data-testid={`button-delete-image-${img.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {isFeatured && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">Featured</div>
                )}
                {img.source !== 'media_library' && img.source !== 'ai_openai' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">{img.attribution}</div>
                )}
                <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                  {img.source === 'ai_openai' ? 'AI' : img.source === 'stock_unsplash' ? 'Unsplash' : img.source === 'stock_pexels' ? 'Pexels' : 'Upload'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Suggest Topics Dialog ─────────────────────────────────────────────────────
interface TopicSuggestion {
  title: string;
  keyword: string;
  searchIntent: string;
  description: string;
}

function SuggestTopicsDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { apiSuffix } = useSiteContext();
  const [sourceTab, setSourceTab] = useState<'url' | 'text' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const intentColor = (intent: string) => {
    if (intent === 'informational') return 'bg-blue-100 text-blue-700';
    if (intent === 'commercial') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  const handleSuggest = async () => {
    setLoading(true);
    setSuggestions([]);
    setSelected(new Set());
    try {
      const formData = new FormData();
      if (sourceTab === 'url') {
        formData.append('sourceType', 'url');
        formData.append('url', url);
      } else if (sourceTab === 'text') {
        formData.append('sourceType', 'text');
        formData.append('text', text);
      } else if (file) {
        formData.append('sourceType', 'file');
        formData.append('file', file);
      }
      const res = await fetch('/api/admin/blog/suggest-topics' + apiSuffix, { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuggestions(data.suggestions || []);
      if ((data.suggestions || []).length === 0) toast({ title: 'No suggestions returned', description: 'Try a different source', variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    try {
      const chosen = Array.from(selected).map(i => suggestions[i]);
      const res = await apiRequest('POST', '/api/admin/blog/generate-from-suggestions' + apiSuffix, { suggestions: chosen });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: `${data.created?.length ?? 0} articles queued!`, description: 'English content is being generated. Check the list in a moment.' });
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Source tabs */}
      <Tabs value={sourceTab} onValueChange={v => setSourceTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="url" className="flex-1 gap-1.5" data-testid="tab-source-url"><Link className="w-3.5 h-3.5" />URL</TabsTrigger>
          <TabsTrigger value="text" className="flex-1 gap-1.5" data-testid="tab-source-text"><FileText className="w-3.5 h-3.5" />Text</TabsTrigger>
          <TabsTrigger value="file" className="flex-1 gap-1.5" data-testid="tab-source-file"><Upload className="w-3.5 h-3.5" />PDF / Word</TabsTrigger>
        </TabsList>
        <TabsContent value="url" className="mt-3">
          <Input
            placeholder="https://example.com/about-us"
            value={url}
            onChange={e => setUrl(e.target.value)}
            data-testid="input-suggest-url"
          />
          <p className="text-xs text-muted-foreground mt-1">Enter any web page URL — the AI will read its content and extract SEO blog ideas.</p>
        </TabsContent>
        <TabsContent value="text" className="mt-3">
          <Textarea
            placeholder="Paste any text, program descriptions, brochure content, or notes here..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="min-h-[120px] text-sm"
            data-testid="textarea-suggest-text"
          />
        </TabsContent>
        <TabsContent value="file" className="mt-3">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            data-testid="dropzone-suggest-file"
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to upload PDF or Word document</p>
                <p className="text-xs text-muted-foreground mt-1">Max 10 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              data-testid="input-suggest-file"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Button
        className="w-full"
        onClick={handleSuggest}
        disabled={loading || (sourceTab === 'url' && !url) || (sourceTab === 'text' && !text) || (sourceTab === 'file' && !file)}
        data-testid="button-suggest-topics"
      >
        {loading ? (
          <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Analyzing source…</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" />Suggest SEO Topics</>
        )}
      </Button>

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">AI Suggestions ({suggestions.length})</p>
            <div className="flex gap-2">
              <button
                className="text-xs text-primary underline"
                onClick={() => setSelected(new Set(suggestions.map((_, i) => i)))}
                data-testid="button-select-all-suggestions"
              >Select all</button>
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() => setSelected(new Set())}
                data-testid="button-deselect-suggestions"
              >None</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${selected.has(i) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}
                onClick={() => toggleSelect(i)}
                data-testid={`suggestion-item-${i}`}
              >
                <div className="flex items-start gap-2.5">
                  <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleSelect(i)} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">{s.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">🔑 {s.keyword}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${intentColor(s.searchIntent)}`}>{s.searchIntent}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={selected.size === 0 || generating}
            data-testid="button-generate-selected"
          >
            {generating ? (
              <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Creating articles…</>
            ) : (
              <><BookOpen className="w-4 h-4 mr-2" />Create {selected.size} Article{selected.size !== 1 ? 's' : ''} in English</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

const EDIT_LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
  { code: 'ar', label: 'AR' },
  { code: 'fr', label: 'FR' },
  { code: 'ru', label: 'RU' },
  { code: 'fa', label: 'FA' },
  { code: 'zh', label: 'ZH' },
  { code: 'hi', label: 'HI' },
  { code: 'es', label: 'ES' },
  { code: 'id', label: 'ID' },
];

type TranslationDraft = {
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDesc: string;
};

function EditPostDialog({ post, domain, onClose }: {
  post: BlogPostWithTranslations;
  domain: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { apiSuffix } = useSiteContext();

  const initDrafts = (): Record<string, TranslationDraft> => {
    const drafts: Record<string, TranslationDraft> = {};
    for (const { code } of EDIT_LANGS) {
      const t = post.translations.find(tr => tr.lang === code);
      drafts[code] = {
        title: t?.title || '',
        slug: t?.slug || '',
        content: t?.content || '',
        metaTitle: t?.metaTitle || '',
        metaDesc: t?.metaDesc || '',
      };
    }
    return drafts;
  };

  const [activeLang, setActiveLang] = useState('en');
  const [drafts, setDrafts] = useState<Record<string, TranslationDraft>>(initDrafts);
  const [saving, setSaving] = useState(false);
  const [contentView, setContentView] = useState<Record<string, 'edit' | 'preview'>>({});

  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().substring(0, 80);

  const setField = (lang: string, field: keyof TranslationDraft, value: string) => {
    setDrafts(prev => {
      const current = prev[lang];
      const next = { ...current, [field]: value };
      if (field === 'title' && !current.slug) {
        next.slug = toSlug(value);
      }
      return { ...prev, [lang]: next };
    });
  };

  const handleSave = async (lang: string) => {
    const d = drafts[lang];
    if (!d.title.trim() || !d.slug.trim() || !d.content.trim()) {
      toast({ title: 'Title, slug and content are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest('PATCH', `/api/admin/blog/${post.id}/translation${apiSuffix}`, {
        lang,
        title: d.title,
        slug: d.slug,
        content: d.content,
        metaTitle: d.metaTitle || null,
        metaDesc: d.metaDesc || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: `[${lang.toUpperCase()}] translation saved` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copySlug = (slug: string) => {
    navigator.clipboard.writeText(slug).then(() => toast({ title: 'Slug copied' }));
  };

  const previewUrl = (lang: string) => {
    const slug = drafts[lang].slug;
    if (!slug) return null;
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    return `${base}/${lang}/blog/${slug}`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeLang} onValueChange={setActiveLang}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 rounded-md">
          {EDIT_LANGS.map(({ code, label }) => {
            const hasContent = !!drafts[code]?.title;
            return (
              <TabsTrigger
                key={code}
                value={code}
                data-testid={`tab-lang-${code}`}
                className="text-xs px-2 py-1 relative"
              >
                {label}
                {hasContent && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {EDIT_LANGS.map(({ code }) => (
          <TabsContent key={code} value={code} className="space-y-3 mt-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={drafts[code].title}
                onChange={e => setField(code, 'title', e.target.value)}
                placeholder="Post title"
                data-testid={`input-title-${code}`}
              />
            </div>

            <div>
              <Label>Slug (URL path)</Label>
              <div className="flex gap-2">
                <Input
                  value={drafts[code].slug}
                  readOnly
                  className="flex-1 bg-muted font-mono text-sm"
                  placeholder="auto-generated when you enter a title"
                  data-testid={`input-slug-${code}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copySlug(drafts[code].slug)}
                  disabled={!drafts[code].slug}
                  data-testid={`button-copy-slug-${code}`}
                  title="Copy slug"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Auto-generated from title. Read-only.</p>
            </div>

            {previewUrl(code) && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <a
                  href={previewUrl(code)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary truncate hover:underline"
                  data-testid={`link-preview-${code}`}
                >
                  {previewUrl(code)}
                </a>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Content * (Markdown)</Label>
                <div className="flex items-center gap-1 rounded-md border bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setContentView(v => ({ ...v, [code]: 'edit' }))}
                    data-testid={`button-content-edit-${code}`}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${(contentView[code] ?? 'edit') === 'edit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentView(v => ({ ...v, [code]: 'preview' }))}
                    data-testid={`button-content-preview-${code}`}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${contentView[code] === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Preview
                  </button>
                </div>
              </div>
              {(contentView[code] ?? 'edit') === 'edit' ? (
                <Textarea
                  value={drafts[code].content}
                  onChange={e => setField(code, 'content', e.target.value)}
                  placeholder="Write content in Markdown…"
                  className="font-mono text-sm min-h-[300px]"
                  data-testid={`textarea-content-${code}`}
                />
              ) : (
                <div
                  data-testid={`div-content-preview-${code}`}
                  className="min-h-[300px] rounded-md border bg-background px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none overflow-auto"
                  dangerouslySetInnerHTML={{
                    __html: drafts[code].content
                      ? (() => {
                          const raw = marked.parse(drafts[code].content);
                          return DOMPurify.sanitize(typeof raw === 'string' ? raw : '');
                        })()
                      : '<p class="text-muted-foreground italic">Nothing to preview yet.</p>',
                  }}
                />
              )}
            </div>

            {/* SEO Panel */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Settings</p>
                {code === 'en' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={async () => {
                      if (!drafts['en'].content && !drafts['en'].title) {
                        return;
                      }
                      setSaving(true);
                      try {
                        const res = await fetch(`/api/admin/blog/${post.id}/fill-seo${apiSuffix}`, { method: 'POST', credentials: 'include' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed');
                        setField('en', 'metaTitle', data.metaTitle || '');
                        setField('en', 'metaDesc', data.metaDesc || '');
                      } catch (e: any) {
                        console.error(e);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || !drafts['en'].content}
                    data-testid="button-fill-seo-ai"
                  >
                    <Wand2 className="w-3 h-3" />Fill with AI
                  </Button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Title</Label>
                  <span className={`text-xs font-mono ${drafts[code].metaTitle.length > 65 ? 'text-red-500' : drafts[code].metaTitle.length >= 30 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {drafts[code].metaTitle.length}/65
                  </span>
                </div>
                <Input
                  value={drafts[code].metaTitle}
                  onChange={e => setField(code, 'metaTitle', e.target.value)}
                  placeholder="SEO title (30–65 chars)"
                  data-testid={`input-meta-title-${code}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Description</Label>
                  <span className={`text-xs font-mono ${drafts[code].metaDesc.length > 165 ? 'text-red-500' : drafts[code].metaDesc.length >= 120 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {drafts[code].metaDesc.length}/165
                  </span>
                </div>
                <Textarea
                  value={drafts[code].metaDesc}
                  onChange={e => setField(code, 'metaDesc', e.target.value)}
                  placeholder="SEO description (120–165 chars)"
                  className="min-h-[72px] text-sm"
                  data-testid={`textarea-meta-desc-${code}`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => handleSave(code)}
                disabled={saving}
                data-testid={`button-save-translation-${code}`}
              >
                {saving ? 'Saving…' : `Save ${code.toUpperCase()}`}
              </Button>
              <Button variant="outline" onClick={onClose} data-testid="button-edit-cancel">
                Close
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface BlogSchedule {
  id: string;
  dailyLimit: number;
  weekdays: string[];
  mode: string;
  isEnabled: boolean;
}

// ── SEO Scoring ──────────────────────────────────────────────────────────────
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
interface SeoCheck { label: string; passed: boolean; points: number; tip: string; }

function calculateSeoScore(post: BlogPostWithTranslations): { score: number; total: number; checks: SeoCheck[] } {
  const en = post.translations.find(t => t.lang === 'en');
  const title = en?.title || '';
  const rawContent = en?.content || '';
  const content = stripHtml(rawContent);
  const metaTitle = en?.metaTitle || '';
  const metaDesc = en?.metaDesc || '';
  const keyword = (post.keyword || '').toLowerCase().trim();
  const wc = wordCount(content);
  const hasH2 = rawContent.includes('<h2');

  const checks: SeoCheck[] = [
    { label: 'Has English content', passed: wc > 50, points: 5, tip: 'Generate AI content or write it manually' },
    { label: 'Content ≥ 300 words', passed: wc >= 300, points: 10, tip: `${wc} words now — aim for 300+` },
    { label: 'Content ≥ 800 words', passed: wc >= 800, points: 10, tip: `${wc} words now — longer articles rank higher` },
    { label: 'Has H2 subheadings', passed: hasH2, points: 5, tip: 'Add subheadings to structure the content' },
    { label: 'Keyword in body text', passed: !!keyword && content.toLowerCase().includes(keyword), points: 5, tip: 'Use the keyword naturally in body text' },
    { label: 'Has meta title', passed: metaTitle.length > 0, points: 5, tip: 'Add meta title in the Edit dialog' },
    { label: 'Meta title 30–65 chars', passed: metaTitle.length >= 30 && metaTitle.length <= 65, points: 10, tip: `${metaTitle.length} chars now — ideal: 30–65` },
    { label: 'Has meta description', passed: metaDesc.length > 0, points: 5, tip: 'Add meta description in the Edit dialog' },
    { label: 'Meta desc 120–165 chars', passed: metaDesc.length >= 120 && metaDesc.length <= 165, points: 10, tip: `${metaDesc.length} chars now — ideal: 120–165` },
    { label: 'Keyword in title', passed: !!keyword && title.toLowerCase().includes(keyword), points: 10, tip: 'Include the target keyword in the post title' },
    { label: 'Keyword in meta desc', passed: !!keyword && metaDesc.toLowerCase().includes(keyword), points: 5, tip: 'Include keyword in the meta description' },
    { label: 'Has featured image', passed: !!post.featuredImageUrl, points: 10, tip: 'Add an image via the Images button' },
    { label: 'Translated to 3+ languages', passed: post.translations.filter(t => t.content).length >= 3, points: 10, tip: 'Translate into at least 3 languages for broader reach' },
  ];

  const score = checks.filter(c => c.passed).reduce((s, c) => s + c.points, 0);
  const total = checks.reduce((s, c) => s + c.points, 0);
  return { score, total, checks };
}

function SeoScoreBadge({ post }: { post: BlogPostWithTranslations }) {
  const { score, total, checks } = calculateSeoScore(post);
  const pct = Math.round((score / total) * 100);
  const color = pct >= 70
    ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
    : pct >= 40
    ? 'text-yellow-700 bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
    : 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100';
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const label = pct >= 70 ? 'Good' : pct >= 40 ? 'Fair' : 'Poor';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors ${color}`}
          data-testid={`seo-score-${post.id}`}>
          {pct}<span className="font-normal opacity-60">/100</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-76 p-0" align="end" side="left">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">SEO Score</span>
            <span className={`text-sm font-bold ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
              {pct}/100 — {label}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {checks.filter(c => c.passed).length}/{checks.length} checks passed · {score}/{total} pts
          </p>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto">
          {checks.map((c, i) => (
            <div key={i} className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${!c.passed ? 'bg-red-50/50' : ''}`}>
              <span className={`mt-0.5 flex-shrink-0 font-bold ${c.passed ? 'text-green-500' : 'text-red-400'}`}>
                {c.passed ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <span className={c.passed ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                {!c.passed && (
                  <p className="text-muted-foreground/70 text-[11px] mt-0.5 leading-tight">{c.tip}</p>
                )}
              </div>
              <span className="text-muted-foreground/60 font-mono flex-shrink-0">+{c.points}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_COLORS: Record<string, string> = {
  taslak: 'bg-gray-100 text-gray-700',
  zamanli: 'bg-blue-100 text-blue-700',
  yayinda: 'bg-green-100 text-green-700',
  generating: 'bg-yellow-100 text-yellow-800 animate-pulse',
  failed: 'bg-red-100 text-red-700',
};

const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat',
};

const STATUS_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'yayinda',   label: 'Published' },
  { key: 'taslak',    label: 'Draft' },
  { key: 'zamanli',   label: 'Scheduled' },
  { key: 'generating',label: 'Generating' },
  { key: 'failed',    label: 'Failed' },
];

// ---- Calendar View Helper ----
function BlogCalendar({ posts }: { posts: BlogPostWithTranslations[] }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const postsByDate: Record<string, BlogPostWithTranslations[]> = {};
  for (const post of posts) {
    if (!post.publishAt) continue;
    const d = new Date(post.publishAt);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const key = d.toISOString().slice(0, 10);
      if (!postsByDate[key]) postsByDate[key] = [];
      postsByDate[key].push(post);
    }
  }

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };
  const monthName = new Date(calYear, calMonth, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const enTitle = (post: BlogPostWithTranslations) => post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`blank-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayPosts = postsByDate[key] || [];
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    cells.push(
      <div key={key} data-testid={`calendar-day-${key}`}
        className={`min-h-[72px] border rounded-lg p-1.5 flex flex-col gap-1 ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
        <span className={`text-xs font-semibold self-start px-1 rounded ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</span>
        {dayPosts.map(post => (
          <div key={post.id} title={enTitle(post)}
            className={`text-[10px] leading-tight truncate px-1.5 py-0.5 rounded font-medium ${
              post.status === 'yayinda' ? 'bg-green-100 text-green-700' :
              post.status === 'zamanli' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {enTitle(post)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Publish Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={prevMonth} data-testid="button-cal-prev"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium w-36 text-center">{monthName}</span>
            <Button size="sm" variant="ghost" onClick={nextMonth} data-testid="button-cal-next"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200 inline-block" />Published</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-200 inline-block" />Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-200 inline-block" />Draft</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </CardContent>
    </Card>
  );
}

export default function Blog({ embedded }: { embedded?: boolean } = {}) {
  const { apiSuffix } = useSiteContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [imagesPost, setImagesPost] = useState<BlogPostWithTranslations | null>(null);
  const [editPost, setEditPost] = useState<BlogPostWithTranslations | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [aipoweringId, setAipoweringId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New post form
  const [newKeyword, setNewKeyword] = useState('');
  const [newBacklinks, setNewBacklinks] = useState('');
  const [newPublishAt, setNewPublishAt] = useState('');
  const [newStatus, setNewStatus] = useState('taslak');

  // Schedule form
  const [schedMode, setSchedMode] = useState('onay');
  const [schedLimit, setSchedLimit] = useState(1);
  const [schedWeekdays, setSchedWeekdays] = useState(['1','2','3','4','5']);
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [schedAutoImage, setSchedAutoImage] = useState(true);

  // ── List management state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'status'>('date_desc');
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const { data: posts = [], isLoading } = useQuery<BlogPostWithTranslations[]>({
    queryKey: ['/api/admin/blog' + apiSuffix],
    refetchInterval: (query) => {
      const data = query.state.data as BlogPostWithTranslations[] | undefined;
      return data?.some(p => p.status === 'generating') ? 3000 : false;
    },
  });

  const { data: schedule } = useQuery<BlogSchedule | null>({
    queryKey: ['/api/admin/blog/schedule' + apiSuffix],
  });

  // Sync schedule data into form state whenever it loads
  useEffect(() => {
    if (schedule) {
      setSchedMode(schedule.mode ?? 'onay');
      setSchedLimit(schedule.dailyLimit ?? 1);
      setSchedWeekdays(schedule.weekdays ?? ['1','2','3','4','5']);
      setSchedEnabled(schedule.isEnabled ?? false);
      setSchedAutoImage((schedule as any).autoGenerateImages ?? true);
    }
  }, [schedule]);

  const { data: tenantData } = useQuery<{ domain?: string }>({
    queryKey: ['/api/tenant'],
  });
  const tenantDomain = tenantData?.domain || window.location.hostname;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/blog' + apiSuffix, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      setAddDialogOpen(false);
      setNewKeyword(''); setNewBacklinks(''); setNewPublishAt(''); setNewStatus('taslak');
      toast({ title: 'Post created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/blog/${id}${apiSuffix}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] }); toast({ title: 'Post deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/admin/blog/${id}/approve${apiSuffix}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] }); toast({ title: 'Post published!' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/blog/schedule' + apiSuffix, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/schedule' + apiSuffix] }); setScheduleDialogOpen(false); toast({ title: 'Schedule saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Bulk mutations ────────────────────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest('POST', '/api/admin/blog/bulk-delete' + apiSuffix, { ids }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      setSelectedIds(new Set());
      toast({ title: `${data.deleted ?? 0} posts deleted` });
    },
    onError: () => toast({ title: 'Bulk delete failed', variant: 'destructive' }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiRequest('POST', '/api/admin/blog/bulk-status' + apiSuffix, { ids, status }).then(r => r.json()),
    onSuccess: (data: any, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      setSelectedIds(new Set());
      toast({ title: `${data.updated ?? 0} posts set to ${status === 'yayinda' ? 'Published' : 'Draft'}` });
    },
    onError: () => toast({ title: 'Bulk status update failed', variant: 'destructive' }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const enTitle = (post: BlogPostWithTranslations) =>
    post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const p of posts) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        enTitle(p).toLowerCase().includes(q) || (p.keyword || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [posts, statusFilter, searchQuery, sortBy]);

  const allFilteredSelected = filteredPosts.length > 0 && filteredPosts.every(p => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filteredPosts.forEach(p => next.delete(p.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filteredPosts.forEach(p => next.add(p.id)); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleTranslateAll = async (post: BlogPostWithTranslations) => {
    setTranslatingId(post.id);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/translate-all${apiSuffix}`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'Translation started!', description: 'Translating to 9 languages in the background — the language badges will update automatically.' });
    } catch (e: any) {
      toast({ title: 'Translation failed', description: e.message, variant: 'destructive' });
    } finally {
      setTranslatingId(null);
    }
  };

  const handleGenerateAI = async (post: BlogPostWithTranslations) => {
    setGeneratingId(post.id);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/generate${apiSuffix}`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      if (data.backgroundTranslating) {
        toast({ title: 'English article ready!', description: 'Translating to 9 languages in the background — the status badge will update automatically.' });
      } else {
        toast({ title: `AI generated ${data.translations?.length || 0} translations` });
      }
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAIPower = async (post: BlogPostWithTranslations) => {
    setAipoweringId(post.id);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/ai-power${apiSuffix}`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: 'AI Power complete!', description: 'Content rewritten with better SEO. Translating to 9 languages in background.' });
    } catch (e: any) {
      toast({ title: 'AI Power failed', description: e.message, variant: 'destructive' });
    } finally {
      setAipoweringId(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/blog/import' + apiSuffix, { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] });
      toast({ title: `Imported ${data.imported} posts from Excel` });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleWeekday = (day: string) =>
    setSchedWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="space-y-6 p-6">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Blog Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create, generate with AI, and schedule blog posts in 10 languages.
            </p>
          </div>
          <div className="flex gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="rounded-none border-0" onClick={() => setView('list')} data-testid="button-view-list">
                <LayoutList className="w-4 h-4 mr-1" />List
              </Button>
              <Button size="sm" variant={view === 'calendar' ? 'default' : 'ghost'} className="rounded-none border-0" onClick={() => setView('calendar')} data-testid="button-view-calendar">
                <Calendar className="w-4 h-4 mr-1" />Calendar
              </Button>
            </div>

            {/* Schedule dialog */}
            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-blog-schedule">
                  <Calendar className="w-4 h-4 mr-2" />Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Publish Schedule</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <Label>Scheduler Enabled</Label>
                    <Switch checked={schedEnabled} onCheckedChange={setSchedEnabled} data-testid="switch-schedule-enabled" />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select value={schedMode} onValueChange={setSchedMode}>
                      <SelectTrigger data-testid="select-schedule-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="otomatik">Automatic (publish when due)</SelectItem>
                        <SelectItem value="onay">Approval Queue (admin approves)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Daily Limit</Label>
                    <Input type="number" min={1} max={20} value={schedLimit} onChange={e => setSchedLimit(Number(e.target.value))} data-testid="input-schedule-limit" />
                  </div>
                  <div>
                    <Label>Active Days</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
                        <button key={day} type="button" onClick={() => toggleWeekday(day)} data-testid={`day-${day}`}
                          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${schedWeekdays.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
                    <div>
                      <Label className="cursor-pointer">Auto-Generate Images</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Automatically create AI / stock images for new posts</p>
                    </div>
                    <Switch checked={schedAutoImage} onCheckedChange={setSchedAutoImage} data-testid="switch-auto-image" />
                  </div>
                  <Button className="w-full"
                    onClick={() => scheduleMutation.mutate({ mode: schedMode, dailyLimit: schedLimit, weekdays: schedWeekdays, isEnabled: schedEnabled, autoGenerateImages: schedAutoImage })}
                    disabled={scheduleMutation.isPending} data-testid="button-save-schedule">
                    Save Schedule
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Suggest Topics dialog */}
            <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-suggest-topics-open" className="gap-1.5">
                  <Globe className="w-4 h-4" />Suggest Topics
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />AI Topic Suggestions
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">Provide a source (URL, text, or document) — AI will suggest 8 SEO-valuable blog topics you can turn into full articles.</p>
                </DialogHeader>
                <SuggestTopicsDialog
                  onClose={() => setSuggestDialogOpen(false)}
                  onCreated={() => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog' + apiSuffix] }); }}
                />
              </DialogContent>
            </Dialog>

            {/* Excel Import */}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} data-testid="input-excel-import" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import-excel">
              <Upload className="w-4 h-4 mr-2" />Import Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { window.open('/api/admin/blog/sample-excel', '_blank'); }} data-testid="button-download-template">
              <Download className="w-4 h-4 mr-1" />Template
            </Button>

            {/* Add post dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-post"><Plus className="w-4 h-4 mr-2" />New Post</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>New Blog Post</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Keyword *</Label>
                    <Input placeholder="e.g. study in Turkey 2025" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} data-testid="input-post-keyword" />
                  </div>
                  <div>
                    <Label>External Links <span className="text-muted-foreground font-normal">(one URL per line)</span></Label>
                    <Textarea
                      placeholder={"https://partner.edu/blog/article\nhttps://example.org/relevant-page"}
                      value={newBacklinks}
                      onChange={e => setNewBacklinks(e.target.value)}
                      rows={3}
                      className="text-xs font-mono"
                      data-testid="input-post-backlinks"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      AI will fetch each page's title and link to it naturally in the article. Internal links between your own blog posts are added automatically.
                    </p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger data-testid="select-post-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="taslak">Draft (taslak)</SelectItem>
                        <SelectItem value="zamanli">Scheduled (zamanli)</SelectItem>
                        <SelectItem value="yayinda">Published (yayinda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Publish At (optional)</Label>
                    <Input type="datetime-local" value={newPublishAt} onChange={e => setNewPublishAt(e.target.value)} data-testid="input-post-publish-at" />
                  </div>
                  <Button className="w-full" disabled={!newKeyword || createMutation.isPending}
                    onClick={() => createMutation.mutate({ keyword: newKeyword, backlinkSites: newBacklinks.split(/[\n,]/).map(s => s.trim()).filter(Boolean), status: newStatus, publishAt: newPublishAt || null })}
                    data-testid="button-create-post">
                    Create Post
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Excel import hint */}
        {view === 'list' && (
          <Card className="border-dashed border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-blue-700">
                <strong>Excel Import:</strong> Upload an .xlsx file with columns: <code>title</code>, <code>keyword</code>, <code>backlink_siteleri</code>, <code>auto_gorsel</code> (1 = auto-generate image), <code>yayinlanma_tarihi</code> (yyyy-mm-dd hh:mm), <code>durum</code> (taslak / zamanli / yayinda).{' '}
                <button className="underline font-medium" onClick={() => window.open('/api/admin/blog/sample-excel', '_blank')} data-testid="link-download-template">Download sample template →</button>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calendar view */}
        {view === 'calendar' && <BlogCalendar posts={posts} />}

        {/* ── List view ─────────────────────────────────────────────────── */}
        {view === 'list' && (
          <Card>
            <CardHeader className="pb-3">
              {/* Status filter tabs */}
              <div className="flex flex-wrap gap-1 mb-3">
                {STATUS_TABS.map(tab => {
                  const count = statusCounts[tab.key] ?? 0;
                  if (tab.key !== 'all' && count === 0) return null;
                  return (
                    <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setSelectedIds(new Set()); }}
                      data-testid={`tab-status-${tab.key}`}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                        statusFilter === tab.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted text-muted-foreground'
                      }`}>
                      {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? 'bg-white/20' : 'bg-muted'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search + sort row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or keyword…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-blog-search"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 text-sm w-44 gap-1.5" data-testid="select-sort-by">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest first</SelectItem>
                    <SelectItem value="date_asc">Oldest first</SelectItem>
                    <SelectItem value="status">By status</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-sm text-muted-foreground ml-auto">
                  {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Bulk action bar */}
              {someSelected && (
                <div className="flex items-center gap-2 pt-2 border-t mt-2" data-testid="bulk-action-bar">
                  <span className="text-sm font-medium text-primary" data-testid="text-selected-count">
                    {selectedIds.size} selected
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'yayinda' })}
                    disabled={bulkStatusMutation.isPending}
                    data-testid="button-bulk-publish">
                    <CheckCircle className="h-3 w-3" />Publish
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'taslak' })}
                    disabled={bulkStatusMutation.isPending}
                    data-testid="button-bulk-unpublish">
                    <X className="h-3 w-3" />Unpublish
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                    onClick={() => setBulkDeleteConfirm(true)}
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-bulk-delete">
                    <Trash2 className="h-3 w-3" />Delete
                  </Button>
                  <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-selection">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading…</div>
              ) : filteredPosts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {posts.length === 0
                    ? <><p>No blog posts yet.</p><p className="text-sm mt-1">Import an Excel file or create posts manually.</p></>
                    : <p>No posts match your filter.</p>
                  }
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Title / Keyword</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SEO</TableHead>
                      <TableHead>Langs</TableHead>
                      <TableHead>Publish At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map(post => (
                      <TableRow key={post.id} data-testid={`blog-row-${post.id}`}
                        className={selectedIds.has(post.id) ? 'bg-primary/5' : ''}>
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={selectedIds.has(post.id)}
                            onCheckedChange={() => toggleSelect(post.id)}
                            aria-label={`Select ${enTitle(post)}`}
                            data-testid={`checkbox-post-${post.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm line-clamp-1">{enTitle(post)}</div>
                          {post.keyword && post.translations.length > 0 && (
                            <div className="text-xs text-muted-foreground">{post.keyword}</div>
                          )}
                          {post.isAiGenerated && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <Sparkles className="w-3 h-3 mr-1" />AI
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[post.status] || ''}`}>
                            {post.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <SeoScoreBadge post={post} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {post.translations.map(t => (
                              <span key={t.lang}
                                className={`text-xs px-1.5 py-0.5 rounded font-mono ${t.content ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {t.lang}
                              </span>
                            ))}
                            {post.translations.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {post.publishAt ? formatDate(post.publishAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handleGenerateAI(post)}
                              disabled={generatingId === post.id || post.status === 'generating'} data-testid={`button-generate-${post.id}`} title="Generate with AI (EN + all 9 languages)">
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              {generatingId === post.id ? 'Generating…' : 'AI Generate'}
                            </Button>

                            <Button size="sm" variant="outline"
                              onClick={() => handleAIPower(post)}
                              disabled={aipoweringId === post.id || post.status === 'generating'}
                              data-testid={`button-aipower-${post.id}`}
                              title="AI Power — rewrite existing content with better SEO, H1/H2 structure and meta tags"
                              className="text-violet-700 border-violet-200 hover:bg-violet-50">
                              <Wand2 className="w-3.5 h-3.5 mr-1" />
                              {aipoweringId === post.id ? 'Powering…' : 'AI Power'}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleTranslateAll(post)}
                              disabled={translatingId === post.id || post.status === 'generating' || !post.translations.find(t => t.lang === 'en')?.content}
                              data-testid={`button-translate-${post.id}`} title="Translate English content to all 9 languages"
                              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                              <Languages className="w-3.5 h-3.5 mr-1" />
                              {translatingId === post.id ? 'Translating…' : 'Translate All'}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => setEditPost(post)}
                              data-testid={`button-edit-${post.id}`} title="Edit translations">
                              <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                            </Button>

                            {(() => {
                              const enSlug = post.translations.find(t => t.lang === 'en')?.slug;
                              const firstSlug = enSlug || post.translations[0]?.slug;
                              const firstLang = enSlug ? 'en' : post.translations[0]?.lang;
                              if (!firstSlug) return null;
                              const isPublished = post.status === 'yayinda';
                              return (
                                <a href={`/${firstLang}/blog/${firstSlug}`} target="_blank" rel="noopener noreferrer"
                                  data-testid={`button-view-${post.id}`}>
                                  <Button size="sm" variant="ghost"
                                    className={isPublished ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700' : 'text-muted-foreground hover:bg-muted'}
                                    title={isPublished ? 'View published post' : 'Preview draft post'}>
                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                    {isPublished ? 'View' : 'Preview'}
                                  </Button>
                                </a>
                              );
                            })()}

                            <Button size="sm" variant="outline" onClick={() => setImagesPost(post)}
                              data-testid={`button-images-${post.id}`} title="Manage images"
                              className={post.featuredImageUrl ? 'text-primary border-primary/40' : ''}>
                              <Image className="w-3.5 h-3.5 mr-1" />Images{post.featuredImageUrl ? ' ✓' : ''}
                            </Button>

                            {post.status !== 'yayinda' && (
                              <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => approveMutation.mutate(post.id)} disabled={approveMutation.isPending}
                                data-testid={`button-approve-${post.id}`} title="Publish now">
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />Publish
                              </Button>
                            )}

                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(post.id)} disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${post.id}`} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Approval queue (onay mode) */}
        {schedule?.mode === 'onay' && schedule?.isEnabled && (
          <Card>
            <CardHeader><CardTitle className="text-base">Approval Queue</CardTitle></CardHeader>
            <CardContent>
              {posts.filter(p => p.status === 'zamanli').length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts waiting for approval.</p>
              ) : (
                <div className="space-y-2">
                  {posts.filter(p => p.status === 'zamanli').map(post => (
                    <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{enTitle(post)}</span>
                      <Button size="sm" onClick={() => approveMutation.mutate(post.id)} disabled={approveMutation.isPending} data-testid={`button-queue-approve-${post.id}`}>
                        <CheckCircle className="w-4 h-4 mr-1" />Approve & Publish
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit post translations dialog */}
      <Dialog open={!!editPost} onOpenChange={open => { if (!open) setEditPost(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />Edit Translations
              {editPost && (
                <span className="text-sm font-normal text-muted-foreground truncate max-w-xs">
                  — {editPost.translations.find(t => t.lang === 'en')?.title || editPost.keyword || ''}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {editPost && (
            <EditPostDialog
              post={editPost}
              domain={tenantDomain}
              onClose={() => setEditPost(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Images management dialog */}
      <Dialog open={!!imagesPost} onOpenChange={open => { if (!open) setImagesPost(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Image className="w-4 h-4" />Blog Post Images</DialogTitle>
          </DialogHeader>
          {imagesPost && <BlogImagesDialog post={imagesPost} onClose={() => setImagesPost(null)} apiSuffix={apiSuffix} />}
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected post{selectedIds.size !== 1 ? 's' : ''} and all their translations and images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setBulkDeleteConfirm(false); bulkDeleteMutation.mutate(Array.from(selectedIds)); }}
              data-testid="button-bulk-delete-confirm"
            >
              Delete {selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EmbeddableLayout>
  );
}
