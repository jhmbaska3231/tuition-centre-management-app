// frontend/src/components/layout/app-shell.tsx
//
// sidebar on desktop. on phones, parents and tutors get a bottom tab bar, and staff keep a
// header menu, since admin screens are desktop first and have too many sections for tabs

import { Menu } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { usePublicOrg } from '@/api/queries/org';
import { useCurrentUser } from '@/auth/context';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { hasTabBar, navFor, type NavItem } from './nav-config';
import { UserMenu } from './user-menu';
import { MobileTabBar } from './mobile-tab-bar';

const SidebarLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) => cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-brand-50 text-brand-800' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )}
  >
    <item.icon className="size-4 shrink-0" />
    {item.label}
  </NavLink>
);

const MobileNav = ({ items }: { items: NavItem[] }) => {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Open navigation">
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items.map(item => (
          <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)}>
            <item.icon className="size-4" /> {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const AppShell = () => {
  const user = useCurrentUser();
  const { data: org } = usePublicOrg();
  const items = navFor(user.role);
  const tabBar = hasTabBar(user.role);
  const name = org?.name ?? 'Tuition Centre';

  return (
    <div
      className={cn(
        'min-h-svh bg-muted/30 md:grid md:grid-cols-[15rem_1fr]',
        // below md, reserve the bar's space for roles that have one. main's padding and any
        // sticky bottom element read this single variable
        tabBar && 'max-md:[--tab-bar-offset:calc(var(--tab-bar-height)_+_env(safe-area-inset-bottom))]',
      )}
    >
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-5">
          <span className="truncate text-sm font-semibold">{name}</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
          {items.map(item => <SidebarLink key={item.to} item={item} />)}
        </nav>
        <div className="border-t p-3">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className={cn(
          'sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background md:hidden',
          tabBar ? 'px-4' : 'px-2',
        )}>
          {!tabBar && <MobileNav items={items} />}
          <span className="truncate text-sm font-semibold">{name}</span>
          <UserMenu compact />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(1.5rem_+_var(--tab-bar-offset))] md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      {tabBar && <MobileTabBar items={items} />}
    </div>
  );
};