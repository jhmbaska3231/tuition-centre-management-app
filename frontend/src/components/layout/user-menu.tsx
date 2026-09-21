// frontend/src/components/layout/user-menu.tsx

import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth, useCurrentUser } from '@/auth/context';
import { roleLabel } from '@/auth/home-path';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fullName, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export const UserMenu = ({ compact = false }: { compact?: boolean }) => {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-3 rounded-md text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'p-1' : 'w-full px-2 py-2',
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-100 text-xs font-medium text-brand-800">{initials(user)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{fullName(user)}</span>
            <span className="block truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">{fullName(user)}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/account')}>
          <UserRound className="size-4" /> Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};