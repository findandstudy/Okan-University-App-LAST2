import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Tenant } from '@shared/schema';

interface HeroProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  backgroundImage?: string;
}

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  
  let videoId = '';
  
  if (url.includes('youtube.com/watch')) {
    try {
      const urlParams = new URL(url).searchParams;
      videoId = urlParams.get('v') || '';
    } catch {
      return '';
    }
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}

export function Hero({ title, subtitle, ctaLabel, backgroundImage }: HeroProps) {
  const { t, isRTL } = useI18n();
  
  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  const heroVideoUrl = tenant?.heroVideoUrl || '';
  const embedUrl = getYouTubeEmbedUrl(heroVideoUrl);

  const features = [
    'Scholarship opportunities up to 50%',
    'Full visa and admission support',
    '48-hour application processing',
  ];

  return (
    <section
      id="hero"
      className="relative min-h-[90vh] flex items-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
      
      <div className="absolute top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={isRTL ? 'text-right' : 'text-left'}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Applications Open for 2026
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              {title || t('hero.title')}
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-xl">
              {subtitle || t('hero.subtitle')}
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Link href="/apply">
                <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-apply">
                  {ctaLabel || t('hero.cta')}
                  <ArrowRight className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base"
                onClick={() => {
                  document.querySelector('#programs')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-hero-programs"
              >
                {t('hero.secondary_cta')}
              </Button>
            </div>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              {embedUrl ? (
                <div className="aspect-[4/3]">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Campus Tour Video"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="h-12 w-12 text-primary" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">Campus Tour Video</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-lg p-4 border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">50+</span>
                </div>
                <div>
                  <p className="font-semibold">Programs</p>
                  <p className="text-sm text-muted-foreground">Available</p>
                </div>
              </div>
            </div>

            <div className="absolute -top-6 -right-6 bg-card rounded-xl shadow-lg p-4 border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-600">98%</span>
                </div>
                <div>
                  <p className="font-semibold">Success Rate</p>
                  <p className="text-sm text-muted-foreground">Visa Approval</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
