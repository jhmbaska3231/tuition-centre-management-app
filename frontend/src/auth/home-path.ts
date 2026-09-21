// frontend/src/auth/home-path.ts

import type { Role } from '@tuition/shared';

export const homePathFor = (role: Role): string => {
  switch (role) {
    case 'parent': return '/parent';
    case 'tutor': return '/tutor';
    case 'branch_manager':
    case 'admin': return '/admin';
  }
};

const ROLE_LABELS: Record<Role, string> = {
  parent: 'Parent',
  tutor: 'Tutor',
  branch_manager: 'Branch manager',
  admin: 'Administrator',
};

export const roleLabel = (role: Role): string => ROLE_LABELS[role];