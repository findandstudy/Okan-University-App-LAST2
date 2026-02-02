import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Save, Globe, Share2, Twitter, Image, Search } from 'lucide-react';
import type { SeoSettings, SupportedLanguage } from '@shared/schema';
import { SUPPORTED_LANGUAGES } from '@shared/schema';

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
  { code: 'fr', label: 'French' },
  { code: 'ru', label: 'Russian' },
  { code: 'fa', label: 'Farsi' },
];

interface SeoFormData {
  metaTitleByLang: Record<SupportedLanguage, string>;
  metaDescriptionByLang: Record<SupportedLanguage, string>;
  metaKeywordsByLang: Record<SupportedLanguage, string>;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  twitterSite: string;
  canonicalUrl: string;
  robotsDirective: string;
}

export default function SEOSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'meta' | 'social'>('meta');
  const [activeLang, setActiveLang] = useState<SupportedLanguage>('en');

  const { data: seoSettings, isLoading } = useQuery<SeoSettings>({
    queryKey: ['/api/admin/seo-settings'],
  });

  const form = useForm<SeoFormData>({
    defaultValues: {
      metaTitleByLang: { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
      metaDescriptionByLang: { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
      metaKeywordsByLang: { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterSite: '',
      canonicalUrl: '',
      robotsDirective: 'index, follow',
    },
  });

  const { reset } = form;

  const saveMutation = useMutation({
    mutationFn: async (data: SeoFormData) => {
      return apiRequest('POST', '/api/admin/seo-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/seo-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/seo-settings'] });
      toast({
        title: 'SEO Settings Saved',
        description: 'Your SEO settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save SEO settings.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SeoFormData) => {
    saveMutation.mutate(data);
  };

  useEffect(() => {
    if (seoSettings && !form.formState.isDirty) {
      const newValues: SeoFormData = {
        metaTitleByLang: (seoSettings.metaTitleByLang as Record<SupportedLanguage, string>) || { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
        metaDescriptionByLang: (seoSettings.metaDescriptionByLang as Record<SupportedLanguage, string>) || { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
        metaKeywordsByLang: (seoSettings.metaKeywordsByLang as Record<SupportedLanguage, string>) || { en: '', ar: '', tr: '', fr: '', ru: '', fa: '' },
        ogTitle: seoSettings.ogTitle || '',
        ogDescription: seoSettings.ogDescription || '',
        ogImage: seoSettings.ogImage || '',
        ogType: seoSettings.ogType || 'website',
        twitterCard: seoSettings.twitterCard || 'summary_large_image',
        twitterSite: seoSettings.twitterSite || '',
        canonicalUrl: seoSettings.canonicalUrl || '',
        robotsDirective: seoSettings.robotsDirective || 'index, follow',
      };
      reset(newValues);
    }
  }, [seoSettings, reset, form.formState.isDirty]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" data-testid="page-seo-settings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SEO Settings</h1>
            <p className="text-muted-foreground">
              Configure search engine optimization and social media sharing settings
            </p>
          </div>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
            data-testid="button-save-seo"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'meta' | 'social')}>
              <TabsList>
                <TabsTrigger value="meta" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Meta Tags
                </TabsTrigger>
                <TabsTrigger value="social" className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Social Media
                </TabsTrigger>
              </TabsList>

              <TabsContent value="meta" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Multi-Language Meta Tags
                    </CardTitle>
                    <CardDescription>
                      Configure meta title, description, and keywords for each language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as SupportedLanguage)}>
                      <TabsList className="mb-4">
                        {LANGUAGES.map((lang) => (
                          <TabsTrigger key={lang.code} value={lang.code}>
                            {lang.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {LANGUAGES.map((lang) => (
                        <TabsContent key={lang.code} value={lang.code} className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`metaTitleByLang.${lang.code}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Meta Title ({lang.label})</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Enter page title for search engines"
                                    data-testid={`input-meta-title-${lang.code}`}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Recommended: 50-60 characters
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`metaDescriptionByLang.${lang.code}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Meta Description ({lang.label})</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Enter page description for search engines"
                                    rows={3}
                                    data-testid={`input-meta-description-${lang.code}`}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Recommended: 150-160 characters
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`metaKeywordsByLang.${lang.code}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Meta Keywords ({lang.label})</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="keyword1, keyword2, keyword3"
                                    data-testid={`input-meta-keywords-${lang.code}`}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Comma-separated keywords (less important for modern SEO)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>General SEO Settings</CardTitle>
                    <CardDescription>
                      Configure general SEO directives
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="canonicalUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Canonical URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://okanuniversity.app"
                              data-testid="input-canonical-url"
                            />
                          </FormControl>
                          <FormDescription>
                            The preferred URL for this page (prevents duplicate content issues)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="robotsDirective"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Robots Directive</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-robots-directive">
                                <SelectValue placeholder="Select robots directive" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="index, follow">index, follow (Recommended)</SelectItem>
                              <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                              <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                              <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Controls how search engines index and follow links
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="h-5 w-5" />
                      Open Graph (Facebook, WhatsApp, LinkedIn)
                    </CardTitle>
                    <CardDescription>
                      Configure how your site appears when shared on social media
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="ogTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OG Title</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Title for social media sharing"
                              data-testid="input-og-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ogDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OG Description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Description for social media sharing"
                              rows={3}
                              data-testid="input-og-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ogImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OG Image URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://example.com/image.jpg"
                              data-testid="input-og-image"
                            />
                          </FormControl>
                          <FormDescription>
                            Recommended size: 1200x630 pixels
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ogType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OG Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-og-type">
                                <SelectValue placeholder="Select OG type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="website">website</SelectItem>
                              <SelectItem value="article">article</SelectItem>
                              <SelectItem value="profile">profile</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Twitter className="h-5 w-5" />
                      Twitter Card
                    </CardTitle>
                    <CardDescription>
                      Configure how your site appears when shared on Twitter
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="twitterCard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Card Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-twitter-card">
                                <SelectValue placeholder="Select card type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="summary">summary</SelectItem>
                              <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="twitterSite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter Username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="@yourusername"
                              data-testid="input-twitter-site"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
