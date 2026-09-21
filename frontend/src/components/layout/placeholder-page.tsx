// frontend/src/components/layout/placeholder-page.tsx
//
// stands in for screens not yet built, so every nav link resolves and the shell can be
// tested end to end. each is replaced as its phase lands

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from './page-header';

export const PlaceholderPage = ({ title }: { title: string }) => (
  <>
    <PageHeader title={title} />
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        This section is being built.
      </CardContent>
    </Card>
  </>
);