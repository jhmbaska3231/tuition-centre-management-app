// frontend/src/components/ui/sonner.tsx
//
// rewritten without next-themes. the app's theme comes from css variables set by the
// centre's configuration, so a second theme source would conflict

import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    style={{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    } as CSSProperties}
    {...props}
  />
);