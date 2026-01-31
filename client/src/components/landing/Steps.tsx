import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, Plane } from 'lucide-react';

const steps = [
  {
    icon: FileText,
    titleKey: 'steps.step1.title',
    descKey: 'steps.step1.desc',
    color: 'bg-blue-500',
  },
  {
    icon: CheckCircle,
    titleKey: 'steps.step2.title',
    descKey: 'steps.step2.desc',
    color: 'bg-green-500',
  },
  {
    icon: Plane,
    titleKey: 'steps.step3.title',
    descKey: 'steps.step3.desc',
    color: 'bg-purple-500',
  },
];

export function Steps() {
  const { t, isRTL } = useI18n();

  return (
    <section id="steps" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('steps.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Simple 3-step process to start your educational journey
          </p>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-border" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="text-center relative"
              >
                <div className="relative z-10 mx-auto mb-6">
                  <div className={`w-20 h-20 rounded-full ${step.color} mx-auto flex items-center justify-center shadow-lg`}>
                    <step.icon className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center font-bold text-primary">
                    {index + 1}
                  </div>
                </div>

                <div className="bg-card rounded-xl p-6 border shadow-sm">
                  <h3 className="text-xl font-semibold mb-3">{t(step.titleKey)}</h3>
                  <p className="text-muted-foreground">{t(step.descKey)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
