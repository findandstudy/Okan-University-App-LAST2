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
): { subject: string; body: string } {
  const langKey = lang as SupportedLanguage;
  let subject = template.subjectByLang?.[langKey] || template.subjectByLang?.['en'] || '';
  let body = template.textBodyByLang?.[langKey] || template.textBodyByLang?.['en'] || '';

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    body = body.replace(new RegExp(placeholder, 'g'), value);
  }

  return { subject, body };
}
