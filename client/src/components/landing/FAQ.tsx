import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const defaultFAQs = [
  {
    question: 'What are the admission requirements?',
    answer: 'Requirements vary by program but generally include a high school diploma or equivalent, passport, and English proficiency test (TOEFL/IELTS) for English-taught programs. Our team will guide you through specific requirements for your chosen program.',
  },
  {
    question: 'How long does the application process take?',
    answer: 'Our application processing typically takes 48-72 hours. Once approved, the university acceptance letter is usually issued within 1-2 weeks. The entire process from application to enrollment can take 2-4 weeks.',
  },
  {
    question: 'Are scholarships available?',
    answer: 'Yes! We offer exclusive scholarships of up to 50% on tuition fees. Scholarship amounts depend on the program, your academic background, and availability. Contact us to learn about current scholarship opportunities.',
  },
  {
    question: 'Do you provide visa support?',
    answer: 'Absolutely. We provide full visa support including document preparation, application guidance, and embassy appointment scheduling. Our visa approval rate is 98%.',
  },
  {
    question: 'Can I work while studying?',
    answer: 'Student visa regulations allow part-time work during your studies. You can work up to 20 hours per week during semesters and full-time during breaks. We can provide more details based on your specific situation.',
  },
  {
    question: 'What is the cost of living?',
    answer: 'Living costs vary by city but average between $400-800 per month including accommodation, food, transportation, and personal expenses. We can help you find affordable housing options.',
  },
];

export function FAQ() {
  const { t, isRTL } = useI18n();

  return (
    <section id="faq" className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('faq.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Find answers to commonly asked questions about studying abroad
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {defaultFAQs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border rounded-xl px-6 shadow-sm"
                data-testid={`faq-item-${index}`}
              >
                <AccordionTrigger className={`text-left hover:no-underline ${isRTL ? 'text-right' : ''}`}>
                  <span className="font-medium">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
