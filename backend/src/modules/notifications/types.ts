// backend/src/modules/notifications/types.ts

export interface NotificationRow {
  id: string; org_id: string; recipient_user_id: string; channel: 'email' | 'sms' | 'whatsapp'; event_key: string;
  template: string; payload: Record<string, any>; dedupe_key: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled'; scheduled_for: Date; attempts: number; sent_at: Date | null; last_error: string | null; created_at: Date;
}

export interface ClaimedNotification extends NotificationRow {
  recipient_email: string; recipient_first_name: string; recipient_last_name: string; recipient_archived_at: Date | null;
  org_name: string; org_timezone: string; org_currency: string; pref_enabled: boolean | null;
}

export interface RenderedEmail { subject: string; text: string; html: string }

export interface EmailMessage { to: string; toName: string; subject: string; text: string; html: string }

export interface EmailProvider {
  name: string;
  send(msg: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

export interface PreferenceRow { channel: string; event_key: string; enabled: boolean }