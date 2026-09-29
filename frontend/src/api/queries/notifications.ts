// frontend/src/api/queries/notifications.ts

import { useMutation, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { NotificationPreference, notificationPreferenceSchema } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';
import { queryClient } from '../query-client';

export type NotificationPreferenceBody = z.input<typeof notificationPreferenceSchema>;

// every event the user can control, with their choice and the centre's setting already merged
export const useNotificationPreferences = () =>
  useQuery({
    queryKey: keys.notifications.preferences(),
    queryFn: () => api.get<NotificationPreference[]>('/notifications/preferences'),
  });

// the api answers with the whole matrix, so it replaces the cached copy directly, rather than
// fetching again what was just returned
export const useSetNotificationPreference = () =>
  useMutation({
    mutationFn: (input: NotificationPreferenceBody) => api.put<NotificationPreference[]>('/notifications/preferences', input),
    onSuccess: matrix => {
      queryClient.setQueryData(keys.notifications.preferences(), matrix);
    },
  });