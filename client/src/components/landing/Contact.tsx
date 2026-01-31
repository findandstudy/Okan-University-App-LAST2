import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import type { Tenant } from '@shared/schema';

export function Contact() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const embedContainerRef = useRef<HTMLDivElement>(null);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant?.contactFormEmbed && embedContainerRef.current) {
      const container = embedContainerRef.current;
      container.innerHTML = tenant.contactFormEmbed;
      
      const scripts = container.querySelectorAll('script');
      const jqueryScripts: HTMLScriptElement[] = [];
      const otherExternalScripts: HTMLScriptElement[] = [];
      const inlineScripts: HTMLScriptElement[] = [];
      
      scripts.forEach((oldScript) => {
        if (oldScript.src) {
          if (oldScript.src.includes('jquery')) {
            jqueryScripts.push(oldScript);
          } else {
            otherExternalScripts.push(oldScript);
          }
        } else {
          inlineScripts.push(oldScript);
        }
      });
      
      const loadScript = (oldScript: HTMLScriptElement): Promise<void> => {
        return new Promise((resolve) => {
          const newScript = document.createElement('script');
          newScript.src = oldScript.src;
          newScript.onload = () => resolve();
          newScript.onerror = () => resolve();
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        });
      };
      
      const loadAllScripts = async () => {
        for (const script of jqueryScripts) {
          await loadScript(script);
        }
        
        for (const script of otherExternalScripts) {
          await loadScript(script);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        inlineScripts.forEach((oldScript) => {
          try {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          } catch (e) {
            console.warn('Inline script error:', e);
          }
        });
      };
      
      loadAllScripts();
    }
  }, [tenant?.contactFormEmbed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: 'Message Sent!',
      description: 'We will get back to you within 24 hours.',
    });

    setFormData({ name: '', email: '', message: '' });
    setIsSubmitting(false);
  };

  const contactInfo = [
    {
      icon: Phone,
      label: 'Phone',
      value: '0 (216) 677 16 30',
    },
    {
      icon: MapPin,
      label: 'Address',
      value: 'Istanbul Okan University Campus',
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: '+90 552 689 85 15',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'apply@okanuniversity.app',
    },
  ];

  return (
    <section id="contact" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('contact.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Have questions? Reach out to our admissions team
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-visible">
              <CardContent className="p-6">
                {tenant?.contactFormEmbed ? (
                  <div 
                    ref={embedContainerRef}
                    className="embed-form-container [&_table]:w-full [&_input]:w-full [&_select]:w-full [&_input]:p-2 [&_input]:border [&_input]:rounded [&_select]:p-2 [&_select]:border [&_select]:rounded [&_label]:block [&_label]:mb-1 [&_label]:font-medium [&_td]:py-2 [&_.btn-primary]:bg-primary [&_.btn-primary]:text-primary-foreground [&_.btn-primary]:px-4 [&_.btn-primary]:py-2 [&_.btn-primary]:rounded [&_.btn-primary]:cursor-pointer [&_.btn-primary]:border-0"
                    data-testid="embed-form-container"
                  />
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">{t('contact.name')}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value.toUpperCase() })
                        }
                        required
                        className="mt-1.5"
                        data-testid="input-contact-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">{t('contact.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="mt-1.5"
                        data-testid="input-contact-email"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message">{t('contact.message')}</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        required
                        rows={4}
                        className="mt-1.5 resize-none"
                        data-testid="input-contact-message"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                      data-testid="button-contact-submit"
                    >
                      {isSubmitting ? 'Sending...' : t('contact.send')}
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            {contactInfo.map((item, index) => (
              <Card key={index} className="overflow-visible hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
