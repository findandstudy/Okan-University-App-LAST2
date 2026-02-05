import nodemailer from 'nodemailer';
import type { EmailSettings, EmailTemplate } from '@shared/schema';

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function createTransporter(settings: EmailSettings) {
  if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
    throw new Error('Incomplete SMTP configuration');
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword,
    },
  });

  return transporter;
}

export async function sendEmail(
  settings: EmailSettings,
  options: SendEmailOptions
): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(settings);

    const fromAddress = settings.fromEmail || settings.smtpUser || '';
    const mailOptions = {
      from: settings.fromName 
        ? `"${settings.fromName}" <${fromAddress}>`
        : fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: (info as any).messageId,
    };
  } catch (error: any) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

export async function verifySmtpConnection(settings: EmailSettings): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(settings);
    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    console.error('SMTP verification error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify SMTP connection',
    };
  }
}

type SupportedLanguage = 'en' | 'ar' | 'tr' | 'fr' | 'ru' | 'fa';

export function processTemplate(
  template: EmailTemplate,
  lang: string,
  variables: Record<string, string>
): { subject: string; textBody: string; htmlBody: string } {
  const langKey = lang as SupportedLanguage;
  let subject = template.subjectByLang?.[langKey] || template.subjectByLang?.['en'] || '';
  let textBody = template.textBodyByLang?.[langKey] || template.textBodyByLang?.['en'] || '';
  let htmlBody = template.htmlBodyByLang?.[langKey] || template.htmlBodyByLang?.['en'] || '';

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
    const regex = new RegExp(escapedPlaceholder, 'g');
    subject = subject.replace(regex, value);
    textBody = textBody.replace(regex, value);
    htmlBody = htmlBody.replace(regex, value);
  }

  return { subject, textBody, htmlBody };
}

export interface ApplicationEmailData {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  nationality?: string;
  programName?: string;
  degreeLevel?: string;
  language?: string;
  tuitionFee?: string;
  intakeTerm?: string;
  utmSource?: string;
}

export async function sendApplicationEmails(
  settings: EmailSettings,
  internalTemplate: EmailTemplate,
  userTemplate: EmailTemplate,
  data: ApplicationEmailData,
  siteConfig: {
    siteName: string;
    siteUrl: string;
    logoUrl: string;
    contactEmail: string;
    adminEmail: string;
    dashboardUrl: string;
  }
): Promise<{ internalResult: EmailResult; userResult: EmailResult }> {
  const now = new Date();
  const variables: Record<string, string> = {
    siteName: siteConfig.siteName,
    siteUrl: siteConfig.siteUrl,
    logoUrl: siteConfig.logoUrl || '',
    contactEmail: siteConfig.contactEmail,
    dashboardUrl: siteConfig.dashboardUrl,
    currentYear: now.getFullYear().toString(),
    submittedDate: now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    fullName: data.fullName,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    countryCode: data.countryCode,
    nationality: data.nationality || 'Not specified',
    programName: data.programName || 'Not specified',
    degreeLevel: data.degreeLevel || 'Not specified',
    language: data.language || 'Not specified',
    tuitionFee: data.tuitionFee || 'Not specified',
    intakeTerm: data.intakeTerm || 'Not specified',
    utmSource: data.utmSource || 'Direct',
  };

  // Process templates
  const internalProcessed = processTemplate(internalTemplate, 'en', variables);
  const userProcessed = processTemplate(userTemplate, 'en', variables);

  // Send internal notification email
  const internalResult = await sendEmail(settings, {
    to: siteConfig.adminEmail,
    subject: internalProcessed.subject,
    text: internalProcessed.textBody,
    html: internalProcessed.htmlBody,
  });

  // Send user confirmation email
  const userResult = await sendEmail(settings, {
    to: data.email,
    subject: userProcessed.subject,
    text: userProcessed.textBody,
    html: userProcessed.htmlBody,
  });

  return { internalResult, userResult };
}
