// frontend/src/features/parent/classes/classes-page.tsx
//
// browsing classes and managing waitlists, as two tabs. the tab lives in the url as
// ?tab=waitlist, which is where the home page's seat offer card links to

import { useWaitlist } from '@/api/queries/enrollment';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParamState } from '@/hooks/use-search-param-state';
import { BrowseTab } from './browse-tab';
import { WaitlistTab } from './waitlist-tab';

export const ClassesPage = () => {
  const [tab, setTab] = useSearchParamState('tab', 'browse', { allowed: ['browse', 'waitlist'] });
  // shared with the waitlist tab through the cache, so this costs no extra request
  const waitlist = useWaitlist();
  const entries = waitlist.data?.length ?? 0;
  const offers = waitlist.data?.filter(entry => entry.status === 'offered').length ?? 0;

  return (
    <>
      <PageHeader title="Classes" description="Browse open classes, and follow your children's places on waitlists." />
      {/* anything but 'waitlist' is treated as browse, so no value from the tab component needs casting */}
      <Tabs value={tab} onValueChange={value => setTab(value === 'waitlist' ? 'waitlist' : 'browse')}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="waitlist">
            Waitlist
            {entries > 0 && (
              <span className={offers > 0 ? 'ml-1.5 font-semibold text-warning-fg' : 'ml-1.5 text-muted-foreground'}>
                {offers > 0 ? `${offers} offer${offers === 1 ? '' : 's'}` : entries}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="browse" className="mt-6"><BrowseTab /></TabsContent>
        <TabsContent value="waitlist" className="mt-6"><WaitlistTab /></TabsContent>
      </Tabs>
    </>
  );
};