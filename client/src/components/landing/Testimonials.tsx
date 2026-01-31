import { useI18n } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, Quote } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Testimonial, SupportedLanguage } from '@shared/schema';

const defaultTestimonials = [
  {
    id: 'default-1',
    studentName: 'AHMED HASSAN',
    studentPhoto: null,
    country: 'Egypt',
    programName: 'Computer Engineering',
    rating: 5,
    contentByLang: {
      en: 'The application process was incredibly smooth. Within a week, I had my acceptance letter. The team supported me every step of the way.',
    },
  },
  {
    id: 'default-2',
    studentName: 'MARIA SANTOS',
    studentPhoto: null,
    country: 'Brazil',
    programName: 'Business Administration',
    rating: 5,
    contentByLang: {
      en: 'I was worried about the visa process, but they handled everything. Now I am studying at my dream university with a 40% scholarship!',
    },
  },
  {
    id: 'default-3',
    studentName: 'OMAR KHALID',
    studentPhoto: null,
    country: 'Saudi Arabia',
    programName: 'Medicine',
    rating: 5,
    contentByLang: {
      en: 'The scholarship opportunity was amazing. The consultants were always available to answer my questions and guide me through the process.',
    },
  },
];

export function Testimonials() {
  const { t, isRTL, language } = useI18n();

  const { data: testimonials, isLoading } = useQuery<Testimonial[]>({
    queryKey: ['/api/testimonials'],
  });

  const activeTestimonials = testimonials?.filter(t => t.isEnabled) || [];
  const displayTestimonials = activeTestimonials.length > 0 ? activeTestimonials : defaultTestimonials;

  const getContent = (testimonial: Testimonial | typeof defaultTestimonials[0]) => {
    const content = testimonial.contentByLang as Record<string, string> | null;
    if (!content) return '';
    return content[language as SupportedLanguage] || content['en'] || Object.values(content)[0] || '';
  };

  if (isLoading) {
    return (
      <section id="testimonials" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="testimonials" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('testimonials.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Hear from students who have successfully started their educational journey
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayTestimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="h-full overflow-visible hover-elevate" data-testid={`testimonial-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating || 5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <div className="relative mb-6">
                    <Quote className="absolute -top-2 -left-2 h-8 w-8 text-primary/10" />
                    <p className={`text-muted-foreground relative z-10 ${isRTL ? 'text-right' : ''}`}>
                      "{getContent(testimonial)}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Avatar>
                      {testimonial.studentPhoto ? (
                        <AvatarImage src={testimonial.studentPhoto} alt={testimonial.studentName} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {testimonial.studentName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={isRTL ? 'text-right' : ''}>
                      <p className="font-semibold text-sm">{testimonial.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.programName}{testimonial.country ? ` • ${testimonial.country}` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
