import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Quote } from 'lucide-react';

const defaultTestimonials = [
  {
    name: 'AHMED HASSAN',
    country: 'Egypt',
    program: 'Computer Engineering',
    content: 'The application process was incredibly smooth. Within a week, I had my acceptance letter. The team supported me every step of the way.',
    rating: 5,
  },
  {
    name: 'MARIA SANTOS',
    country: 'Brazil',
    program: 'Business Administration',
    content: 'I was worried about the visa process, but they handled everything. Now I am studying at my dream university with a 40% scholarship!',
    rating: 5,
  },
  {
    name: 'OMAR KHALID',
    country: 'Saudi Arabia',
    program: 'Medicine',
    content: 'The scholarship opportunity was amazing. The consultants were always available to answer my questions and guide me through the process.',
    rating: 5,
  },
];

export function Testimonials() {
  const { t, isRTL } = useI18n();

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
          {defaultTestimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="h-full overflow-visible hover-elevate" data-testid={`testimonial-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <div className="relative mb-6">
                    <Quote className="absolute -top-2 -left-2 h-8 w-8 text-primary/10" />
                    <p className={`text-muted-foreground relative z-10 ${isRTL ? 'text-right' : ''}`}>
                      "{testimonial.content}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={isRTL ? 'text-right' : ''}>
                      <p className="font-semibold text-sm">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.program} • {testimonial.country}
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
