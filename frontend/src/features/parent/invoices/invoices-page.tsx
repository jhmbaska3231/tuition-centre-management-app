// frontend/src/features/parent/invoices/invoices-page.tsx
//
// every invoice billed to the parent, split by what needs doing: those with a balance to pay
// first, showing what is still owed, then the paid and past ones

import { ChevronRight, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';
import type { Invoice } from '@tuition/shared';
import { useInvoices, useMyBalance } from '@/api/queries/billing';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatInstantDate, formatPeriod, money } from '@/lib/format';

const isOpen = (invoice: Invoice) => invoice.status === 'issued' || invoice.status === 'partially_paid';

// what the invoice covers: its billing period, or when it was issued for one without a period
const coverText = (invoice: Invoice) =>
  invoice.period_start && invoice.period_end
    ? formatPeriod(invoice.period_start, invoice.period_end)
    : invoice.issued_at ? `Issued ${formatInstantDate(invoice.issued_at)}` : '';

const InvoiceRow = ({ invoice }: { invoice: Invoice }) => {
  const open = isOpen(invoice);
  return (
    <li>
      <Link to={`/parent/invoices/${invoice.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
        <div className="min-w-0">
          <p className="text-sm font-medium">{coverText(invoice)}</p>
          <p className="text-sm text-muted-foreground">
            {invoice.invoice_number}
            {open && invoice.due_on ? `, due ${formatDate(invoice.due_on)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            {/* an open invoice shows what is still owed, a settled one shows what it was for */}
            <span className="text-sm font-medium tabular-nums">{money(open ? invoice.balance_cents : invoice.total_cents)}</span>
            <StatusBadge kind="invoice" status={invoice.status} overdue={invoice.is_overdue} />
          </div>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </Link>
    </li>
  );
};

const InvoiceList = ({ heading, id, invoices }: { heading: string; id: string; invoices: Invoice[] }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="mb-3 text-sm font-semibold">{heading}</h2>
    <Card className="py-0">
      <ul className="divide-y">{invoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} />)}</ul>
    </Card>
  </section>
);

export const InvoicesPage = () => {
  const invoices = useInvoices();
  const balance = useMyBalance();

  return (
    <>
      <PageHeader title="Invoices" description="What you owe, and your invoices and payments so far." />

      <div className="flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Outstanding" value={balance.data && money(balance.data.outstanding_cents)} loading={balance.isPending} />
          <StatCard
            label="Overdue" value={balance.data && money(balance.data.overdue_cents)} loading={balance.isPending}
            tone={balance.data && balance.data.overdue_cents > 0 ? 'danger' : 'default'}
          />
        </div>

        <QueryState
          query={invoices}
          skeleton={<Skeleton className="h-48" />}
          empty={
            <EmptyState
              icon={ReceiptText}
              title="No invoices yet"
              description="Your first invoice appears after the billing run that follows an enrollment."
            />
          }
        >
          {list => {
            const open = list.filter(isOpen);
            const settled = list.filter(invoice => !isOpen(invoice));
            return (
              <div className="flex flex-col gap-8">
                {open.length > 0 && <InvoiceList heading="To pay" id="to-pay-heading" invoices={open} />}
                {settled.length > 0 && <InvoiceList heading="Paid and past" id="settled-heading" invoices={settled} />}
              </div>
            );
          }}
        </QueryState>
      </div>
    </>
  );
};