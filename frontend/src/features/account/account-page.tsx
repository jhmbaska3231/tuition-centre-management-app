// frontend/src/features/account/account-page.tsx
//
// the signed in user's own account, for every role: details, password, emails, and devices.
// parents can also delete their account, staff accounts are closed by an admin

import { useCurrentUser } from '@/auth/context';
import { PageHeader } from '@/components/layout/page-header';
import { DeleteAccountSection } from './delete-account-section';
import { NotificationsSection } from './notifications-section';
import { PasswordSection } from './password-section';
import { ProfileSection } from './profile-section';
import { SessionsSection } from './sessions-section';

export const AccountPage = () => {
  const user = useCurrentUser();
  return (
    <>
      <PageHeader title="Account" description="Your details, password and email preferences." />
      {/* forms read more easily at a comfortable line length than across a wide screen */}
      <div className="flex max-w-2xl flex-col gap-8">
        <ProfileSection />
        <PasswordSection />
        <NotificationsSection />
        <SessionsSection />
        {user.role === 'parent' && <DeleteAccountSection />}
      </div>
    </>
  );
};