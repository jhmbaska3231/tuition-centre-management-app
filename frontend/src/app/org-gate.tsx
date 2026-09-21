// frontend/src/app/org-gate.tsx
//
// holds rendering until the centre's timezone and currency are known, so no screen ever
// renders a time in the wrong zone and then corrects itself. if the request fails the app
// still renders with defaults rather than showing nothing

import type { ReactNode } from 'react';
import { usePublicOrg } from '@/api/queries/org';

export const OrgGate = ({ children }: { children: ReactNode }) => {
  const { isPending } = usePublicOrg();
  if (isPending) return null;
  return children;
};