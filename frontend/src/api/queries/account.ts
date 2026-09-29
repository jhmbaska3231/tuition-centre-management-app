// frontend/src/api/queries/account.ts
//
// the signed in user's own account. these hooks reach into the auth context, since a saved
// profile replaces the user shown across the app, and a changed password ends this session

import { useMutation } from '@tanstack/react-query';
import type { z } from 'zod';
import type { changePasswordSchema, deleteAccountSchema, PublicUser, updateProfileSchema } from '@tuition/shared';
import { useAuth } from '@/auth/context';
import { api } from '../client';
import { keys } from '../keys';
import { invalidate } from '../query-client';

export type UpdateProfileBody = z.input<typeof updateProfileSchema>;
export type ChangePasswordBody = z.input<typeof changePasswordSchema>;
export type DeleteAccountBody = z.input<typeof deleteAccountSchema>;

// the saved user replaces the one in context, so the header shows the new name at once.
// students too, since a parent's name appears in their children's guardian lists
export const useUpdateProfile = () => {
  const { updateCurrentUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateProfileBody) => api.patch<{ user: PublicUser }>('/account/profile', input),
    onSuccess: ({ user }) => {
      updateCurrentUser(user);
      return invalidate([keys.students.all]);
    },
  });
};

// the api ends every session, this one included, so the client signs out locally as well.
// the sign in page then explains why the user is there
export const useChangePassword = () => {
  const { logout } = useAuth();
  return useMutation({
    mutationFn: (input: ChangePasswordBody) => api.post<void>('/account/password', input),
    onSuccess: () => logout({ reason: 'password_changed' }),
  });
};

// signing out everywhere ends this session too, so the client signs out locally as well
export const useLogoutAll = () => {
  const { logout } = useAuth();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout-all'),
    onSuccess: () => logout(),
  });
};

// deleting archives the account and ends every session, so the client signs out locally
export const useDeleteAccount = () => {
  const { logout } = useAuth();
  return useMutation({
    mutationFn: (input: DeleteAccountBody) => api.delete<{ studentsArchived: number }>('/account', input),
    onSuccess: () => logout(),
  });
};