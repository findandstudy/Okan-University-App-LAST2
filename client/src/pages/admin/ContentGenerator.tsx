import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Globe, FileText, AlignLeft, Sparkles, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

interface GeneratedContent {
  hero: { title: string; subtitle: string; body: string; ctaLabel: string };
  about: { title: string; body: string };
  faq: Array<{ question: string; answer: string; needsVerification?: boolean }>;
  seo: { metaTitle: string; metaDescription: string; keywords: string };
}

export default function ContentGenerator({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();

  const [url, setUrl] = useState('');
  const [plainText, setPlainText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const fileRef = useRef<HTMLInputElement>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (url.trim()) formData.append('url', url.trim());
      if (plainText.trim()) formData.append('text', plainText.trim());
      if (selectedFile) formData.append('file', selectedFile);
      if (tenantId) formData.append('_tid', tenantId);
      const res = await fetch('/api/admin/ai/generate-content' + apiSuffix, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      return res.json();
    },
    onSuccess: (data: GeneratedContent) => {
      setGeneratedContent(data);
      setStep('preview');
    },
    onError: (err: Error) => toast({ title: 'Generation failed', description: err.message, variant: 'destructive' }),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/ai/apply-content${apiSuffix}`, { generatedContent });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections' + apiSuffix] });
      queryClient.invalidateQueries({ queryKey: ['/api/faq' + apiSuffix] });
      toast({ title: 'Content applied!', description: 'Sections updated. Translation starting in background.' });
      setStep('done');
    },
    onError: () => toast({ title: 'Failed to apply content', variant: 'destructive' }),
  });

  const hasInput = !!url.trim() || !!plainText.trim() || !!selectedFile;
  const needsVerificationCount = generatedContent?.faq?.filter(f => f.needsVerification).length ?? 0;
  const sourceCount = [url.trim(), plainText.trim(), selectedFile].filter(Boolean).length;

  if (step === 'done') {
    return (
      <EmbeddableLayout embedded={embedded}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">Content Applied!</h2>
          <p className="text-muted-foreground text-center max-w-md">Content has been written to your site sections. Translation into all configured languages is processing in the background.</p>
          <Button onClick={() => { setStep('input'); setGeneratedContent(null); setUrl(''); setPlainText(''); setSelectedFile(null); }}>Generate More Content</Button>
        </div>
      </EmbeddableLayout>
    );
  }

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="p-6 space-y-6" data-testid="page-content-generator">
        <div>
          <h1 className="text-2xl font-bold">Content Generator</h1>
          <p className="text-muted-foreground">Provide one or more sources — the AI will combine them to generate your landing page content.</p>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            {/* URL source */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> Website URL
                </CardTitle>
                <CardDescription>Paste a public university or program page — we'll scrape its content.</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://university.edu/about"
                  data-testid="input-url"
                />
              </CardContent>
            </Card>

            {/* File source */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> PDF or Word document
                </CardTitle>
                <CardDescription>Upload a brochure, program guide, or any document (.pdf / .docx).</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => { fileRef.current?.setAttribute('accept', '.pdf,.docx'); fileRef.current?.click(); }}
                  data-testid="dropzone-file"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <button
                        className="ml-2 text-muted-foreground hover:text-destructive"
                        onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                        data-testid="button-clear-file"
                      >✕</button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload PDF or Word</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Text source */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlignLeft className="h-4 w-4 text-primary" /> Paste text
                </CardTitle>
                <CardDescription>Copy-paste any text — program descriptions, bullet points, notes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={plainText}
                  onChange={e => setPlainText(e.target.value)}
                  placeholder="Paste information about the university, programs, campus life..."
                  className="min-h-[160px]"
                  data-testid="textarea-plain-text"
                />
              </CardContent>
            </Card>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex items-center justify-between">
              {sourceCount > 1 ? (
                <p className="text-xs text-primary font-medium">{sourceCount} sources will be combined</p>
              ) : <span />}
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !hasInput}
                data-testid="button-generate-content"
                className="gap-2"
              >
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generateMutation.isPending ? 'Generating...' : 'Generate Content'}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && generatedContent && (
          <div className="space-y-4">
            {needsVerificationCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>{needsVerificationCount} item(s)</strong> flagged for verification — review and edit before saving.
                </p>
              </div>
            )}

            {/* Hero */}
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>Edit the headline and call-to-action for your landing page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    value={generatedContent.hero.title}
                    onChange={e => setGeneratedContent(c => c && { ...c, hero: { ...c.hero, title: e.target.value } })}
                    data-testid="input-hero-title"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subtitle</Label>
                  <Input
                    value={generatedContent.hero.subtitle}
                    onChange={e => setGeneratedContent(c => c && { ...c, hero: { ...c.hero, subtitle: e.target.value } })}
                    data-testid="input-hero-subtitle"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Body</Label>
                  <Textarea
                    value={generatedContent.hero.body}
                    onChange={e => setGeneratedContent(c => c && { ...c, hero: { ...c.hero, body: e.target.value } })}
                    className="min-h-[80px]"
                    data-testid="textarea-hero-body"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CTA Button Label</Label>
                  <Input
                    value={generatedContent.hero.ctaLabel}
                    onChange={e => setGeneratedContent(c => c && { ...c, hero: { ...c.hero, ctaLabel: e.target.value } })}
                    data-testid="input-hero-cta"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Footer description (mapped from about.body) */}
            <Card>
              <CardHeader>
                <CardTitle>Footer Description</CardTitle>
                <CardDescription>Shown in the footer of the landing page as the site's tagline/intro paragraph.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    value={generatedContent.about.body}
                    onChange={e => setGeneratedContent(c => c && { ...c, about: { ...c.about, body: e.target.value } })}
                    className="min-h-[100px]"
                    data-testid="textarea-footer-description"
                  />
                </div>
              </CardContent>
            </Card>

            {/* FAQ */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>FAQ ({generatedContent.faq.length} items)</CardTitle>
                  <CardDescription>Edit questions and answers, or remove ones you don't need.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setGeneratedContent(c => c && {
                    ...c,
                    faq: [...c.faq, { question: '', answer: '', needsVerification: false }],
                  })}
                  data-testid="button-add-faq"
                >
                  <Plus className="h-3.5 w-3.5" /> Add item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedContent.faq.map((item, i) => (
                  <div key={i} className="space-y-2 border rounded-lg p-3 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                      {item.needsVerification && (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">Verify</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => setGeneratedContent(c => c && { ...c, faq: c.faq.filter((_, idx) => idx !== i) })}
                        data-testid={`button-delete-faq-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Question</Label>
                      <Input
                        value={item.question}
                        onChange={e => setGeneratedContent(c => c && {
                          ...c,
                          faq: c.faq.map((f, idx) => idx === i ? { ...f, question: e.target.value } : f),
                        })}
                        data-testid={`input-faq-question-${i}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Answer</Label>
                      <Textarea
                        value={item.answer}
                        onChange={e => setGeneratedContent(c => c && {
                          ...c,
                          faq: c.faq.map((f, idx) => idx === i ? { ...f, answer: e.target.value } : f),
                        })}
                        className="min-h-[70px]"
                        data-testid={`textarea-faq-answer-${i}`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader>
                <CardTitle>SEO Settings</CardTitle>
                <CardDescription>Meta tags used by search engines to index your page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Meta Title</Label>
                  <Input
                    value={generatedContent.seo.metaTitle}
                    onChange={e => setGeneratedContent(c => c && { ...c, seo: { ...c.seo, metaTitle: e.target.value } })}
                    data-testid="input-seo-title"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Meta Description</Label>
                  <Textarea
                    value={generatedContent.seo.metaDescription}
                    onChange={e => setGeneratedContent(c => c && { ...c, seo: { ...c.seo, metaDescription: e.target.value } })}
                    className="min-h-[70px]"
                    data-testid="textarea-seo-description"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Keywords</Label>
                  <Input
                    value={generatedContent.seo.keywords}
                    onChange={e => setGeneratedContent(c => c && { ...c, seo: { ...c.seo, keywords: e.target.value } })}
                    data-testid="input-seo-keywords"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => { setStep('input'); setGeneratedContent(null); }}>← Back</Button>
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending} data-testid="button-apply-content" className="gap-2">
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve & Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </EmbeddableLayout>
  );
}
