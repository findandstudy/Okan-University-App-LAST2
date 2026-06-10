import { useQuery } from '@tanstack/react-query';
import type { Tenant, FaqItem, SeoSettings } from '@shared/schema';
import { useI18n } from '@/lib/i18n';

interface JsonLdProps {
  primaryDomain?: string;
}

export default function JsonLd({ primaryDomain }: JsonLdProps) {
  const { language } = useI18n();

  const { data: tenant } = useQuery<Tenant>({ queryKey: ['/api/tenant'] });
  const { data: faqItems = [] } = useQuery<FaqItem[]>({ queryKey: ['/api/faq'] });
  const { data: seoSettings } = useQuery<SeoSettings>({ queryKey: ['/api/seo-settings'] });

  if (!tenant) return null;

  const base = primaryDomain
    ? `https://${primaryDomain}`
    : seoSettings?.canonicalUrl
      ? seoSettings.canonicalUrl.replace(/\/$/, '')
      : `https://${tenant.domain}`;

  const universityName = tenant.universityName;
  const logoUrl = tenant.logoUrl ? (tenant.logoUrl.startsWith('http') ? tenant.logoUrl : `${base}${tenant.logoUrl}`) : undefined;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': `${base}/#organization`,
    name: universityName,
    url: base,
    ...(logoUrl ? {
      logo: {
        '@type': 'ImageObject',
        url: logoUrl,
        width: 200,
        height: 60,
      },
    } : {}),
    ...(tenant.facebookUrl || tenant.instagramUrl || tenant.linkedinUrl || tenant.youtubeUrl ? {
      sameAs: [
        tenant.facebookUrl,
        tenant.instagramUrl,
        tenant.linkedinUrl,
        tenant.youtubeUrl,
      ].filter(Boolean),
    } : {}),
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: universityName,
    url: base,
    publisher: { '@id': `${base}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/programs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const enabledFaq = faqItems.filter(f => f.isEnabled);
  const faqSchema = enabledFaq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: enabledFaq.map((item) => {
      const q = (item.questionByLang as Record<string, string>)?.[language]
        || (item.questionByLang as Record<string, string>)?.en
        || '';
      const a = (item.answerByLang as Record<string, string>)?.[language]
        || (item.answerByLang as Record<string, string>)?.en
        || '';
      return {
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a,
        },
      };
    }).filter(item => item.name),
  } : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: universityName,
        item: base,
      },
    ],
  };

  const schemas = [organizationSchema, websiteSchema, breadcrumbSchema];
  if (faqSchema && faqSchema.mainEntity.length > 0) schemas.push(faqSchema as any);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 0) }}
        />
      ))}
    </>
  );
}
