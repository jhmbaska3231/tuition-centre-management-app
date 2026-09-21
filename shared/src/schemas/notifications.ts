// shared/src/schemas/notifications.ts

import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '../enums';
import { uuid } from '../primitives';

export const notificationPreferenceSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  eventKey: z.enum(NOTIFICATION_EVENTS),
  enabled: z.boolean(),
});
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

export const outboxQuery = z.object({
  status: z.enum(['pending', 'sent', 'failed', 'cancelled']).optional(),
  recipientUserId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});