export type EmailTemplateKey =
  | 'welcome'
  | 'change_request_received'
  | 'change_request_preview_ready'
  | 'change_published'
  | 'change_rejected'
  | 'payment_success'
  | 'payment_failed'
  | 'new_lead'
  | 'lead_reply'
  | 'invoice_created'
  | 'invoice_paid'
  | 'hosting_expiring_soon'
  | 'hosting_expired'
  | 'hosting_renewed'

export interface EmailTemplate {
  key: EmailTemplateKey
  subject: string
  html: (data: Record<string, unknown>) => string
  text: (data: Record<string, unknown>) => string
}

export interface QueuedEmail {
  customerId: string | null
  toEmail: string
  toName?: string
  templateKey: EmailTemplateKey
  metadata?: Record<string, unknown>
  scheduledFor?: Date
}
