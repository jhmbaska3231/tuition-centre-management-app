// frontend/src/features/account/account-page.tsx
//
// the signed in user's own account, for every role: details, password, and in the sections
// still to come, email preferences, signing out everywhere, and for parents, deleting the account

import { PageHeader } from '@/components/layout/page-header';
import { PasswordSection } from './password-section';
import { ProfileSection } from './profile-section';

export const AccountPage = () => (
  <>
    <PageHeader title="Account" description="Your details, password and email preferences." />
    {/* forms read more easily at a comfortable line length than across a wide screen */}
    <div className="flex max-w-2xl flex-col gap-8">
      <ProfileSection />
      <PasswordSection />
    </div>
  </>
);