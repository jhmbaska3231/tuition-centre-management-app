// shared/src/types/notifications.ts

import type { NotificationChannel, NotificationEvent } from '../enums';
import type { Timestamp } from './api';

export interface NotificationPreference {
  channel: NotificationChannel;
  event_key: NotificationEvent;
  enabled: boolean;
  // false when the centre has switched this event off for everyone. the personal toggle
  // then has no effect, so the ui disables it and explains why rather than showing a
  // control that silently does nothing
  org_enabled: boolean;
}

export interface OutboxEntry {
  id: string;
  org_id: string;
  recipient_user_id: string;
  channel: NotificationChannel;
  event_key: string;
  template: string;
  // scrubbed to {} once sent or cancelled, so a reset token never lingers
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: Timestamp;
  attempts: number;
  sent_at: Timestamp | null;
  last_error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  recipient_email: string;
}

export interface TestEmailResponse {
  provider: string;
  providerMessageId: string | null;
}