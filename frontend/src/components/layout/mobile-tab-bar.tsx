// frontend/src/components/layout/mobile-tab-bar.tsx
//
// bottom navigation for parents and tutors on phones: every destination one tap away and
// within thumb reach. hidden from md up, where the sidebar takes over

import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-config';

export const MobileTabBar = ({ items }: { items: NavItem[] }) => (
  <nav
    aria-label="Main"
    // padded by the home indicator area on iphones, which is zero on other devices
    className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
  >
    <ul className="flex h-(--tab-bar-height)">
      {items.map(item => (
        <li key={item.to} className="flex-1">
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(
              'flex h-full flex-col items-center justify-center gap-1 border-t-2 text-xs outline-none focus-visible:bg-muted',
              // color plus a top line and weight, so the active tab does not rely on color alone
              isActive ? 'border-primary font-semibold text-brand-800' : 'border-transparent font-medium text-muted-foreground',
            )}
          >
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);