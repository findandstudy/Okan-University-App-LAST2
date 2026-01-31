import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Shield, Clock, Users, Award, Globe, HeartHandshake } from 'lucide-react';

const defaultBadges = [
  {
    icon: Shield,
    title: 'Accredited Programs',
    description: 'All programs are internationally recognized',
  },
  {
    icon: Clock,
    title: '48-Hour Processing',
    description: 'Fast application review and response',
  },
  {
    icon: Users,
    title: '10,000+ Students',
    description: 'From over 100 countries worldwide',
  },
  {
    icon: Award,
    title: 'Scholarship Support',
    description: 'Up to 50% tuition discount available',
  },
  {
    icon: Globe,
    title: 'Visa Assistance',
    description: '98% visa approval success rate',
  },
  {
    icon: HeartHandshake,
    title: 'Full Support',
    description: 'From application to graduation',
  },
];

export function TrustBadges() {
  const { t, isRTL } = useI18n();

  return (
    <section id="trust" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('trust.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Trusted by thousands of students to guide their educational journey
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {defaultBadges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative bg-card rounded-xl p-6 border shadow-sm hover-elevate"
              data-testid={`trust-badge-${index}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <badge.icon className="h-6 w-6 text-primary" />
                </div>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <h3 className="font-semibold text-lg mb-1">{badge.title}</h3>
                  <p className="text-muted-foreground text-sm">{badge.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
