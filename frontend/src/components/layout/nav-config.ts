// frontend/src/components/layout/nav-config.ts

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen, CalendarDays, Clock, GraduationCap, House, LayoutDashboard,
  Plane, Receipt, Settings, UserCog, Users, Wallet,
} from 'lucide-react';
import type { Role } from '@tuition/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  // match the path exactly, so the home link is not active on every child route
  end?: boolean;
}

const PARENT: NavItem[] = [
  { to: '/parent', label: 'Home', icon: House, end: true },
  { to: '/parent/children', label: 'Children', icon: Users },
  { to: '/parent/classes', label: 'Classes', icon: BookOpen },
  { to: '/parent/invoices', label: 'Invoices', icon: Receipt },
];

const TUTOR: NavItem[] = [
  { to: '/tutor', label: 'Today', icon: Clock, end: true },
  { to: '/tutor/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/tutor/leave', label: 'Leave', icon: Plane },
];

const ADMIN: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/parents', label: 'Parents', icon: Users },
  { to: '/admin/staff', label: 'Staff', icon: UserCog },
  { to: '/admin/leave', label: 'Leave', icon: Plane },
  { to: '/admin/billing', label: 'Billing', icon: Wallet },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export const navFor = (role: Role): NavItem[] => {
  switch (role) {
    case 'parent': return PARENT;
    case 'tutor': return TUTOR;
    case 'admin': return ADMIN;
    // centre wide settings are admin only on the backend, so hide the link
    case 'branch_manager': return ADMIN.filter(i => i.to !== '/admin/settings');
  }
};

// parent and tutor screens are used mostly on phones, so below md their navigation is a
// bottom tab bar within thumb reach rather than a menu behind a button. a tab bar holds
// five items at most, so keep those two lists that short
export const hasTabBar = (role: Role): boolean => role === 'parent' || role === 'tutor';