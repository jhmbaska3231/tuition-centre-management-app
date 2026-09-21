// frontend/src/components/layout/app-shell.tsx
//
// sidebar on desktop, header with a menu on mobile. parent and tutor screens will move
// to a bottom tab bar in their own phases, since they are used mostly on phones

import { Menu } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { usePublicOrg } from '@/api/queries/org';
import { useCurrentUser } from '@/auth/context';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { navFor, type NavItem } from './nav-config';
import { UserMenu } from './user-menu';

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
  const name = org?.name ?? 'Tuition Centre';

  return (
    <div className="min-h-svh bg-muted/30 md:grid md:grid-cols-[15rem_1fr]">
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
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background px-2 md:hidden">
          <MobileNav items={items} />
          <span className="truncate text-sm font-semibold">{name}</span>
          <UserMenu compact />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};