// ============================================
// SMTP odesílání e-mailů z backendu (vlastní mail zákazníka)
// ============================================

import nodemailer from 'nodemailer'

export interface SmtpSettings {
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: 'tls' | 'ssl' | 'none' | null
  smtp_user: string | null
  smtp_pass: string | null
  from_name: string | null
  from_email: string | null
}

export interface SendEmailInput {
  settings: SmtpSettings
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
}

export function smtpConfigured(settings: SmtpSettings | null | undefined): boolean {
  return !!(settings?.smtp_host && settings?.from_email)
}

export async function sendSmtpEmail(input: SendEmailInput): Promise<{ ok: true; messageId?: string }> {
  const { settings, to, toName, subject, html, text } = input

  if (!smtpConfigured(settings)) {
    throw new Error('SMTP není nastaveno — doplňte údaje v E-mail')
  }

  const secure = settings.smtp_secure === 'ssl' || settings.smtp_port === 465
  const port = settings.smtp_port || (secure ? 465 : 587)

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host!,
    port,
    secure,
    requireTLS: settings.smtp_secure === 'tls' ? true : undefined,
    auth: settings.smtp_user
      ? { user: settings.smtp_user, pass: settings.smtp_pass || '' }
      : undefined,
  })

  const fromName = settings.from_name || settings.from_email || ''
  const from = fromName && settings.from_email
    ? `"${fromName}" <${settings.from_email}>`
    : settings.from_email!

  const info = await transporter.sendMail({
    from,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  })

  return { ok: true, messageId: info.messageId }
}
