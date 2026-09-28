// frontend/src/features/parent/invoices/invoice-page.tsx
//
// one invoice, laid out to read like one on paper: what is owed and how to pay it, then the
// lines by child, the totals as billed, and the payments and credits against it. prints
// without the app around it

import { ChevronLeft, Printer, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { uuid } from '@tuition/shared';
import type { Invoice, PaymentMethod } from '@tuition/shared';
import { useInvoice } from '@/api/queries/billing';
import { usePublicOrg } from '@/api/queries/org';
import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatInstantDate, formatPeriod, money } from '@/lib/format';

type InvoiceLine = Invoice['lines'][number];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  paynow: 'PayNow',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
};

const InvoiceNotFound = () => (
  <EmptyState
    icon={SearchX}
    title="Invoice not found"
    description="This invoice is not on your account, or the link is no longer valid."
    action={<Link to="/parent/invoices" className={buttonVariants({ variant: 'outline' })}>Back to invoices</Link>}
  />
);

const BackLink = () => (
  <Link to="/parent/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
    <ChevronLeft className="size-4" aria-hidden /> Invoices
  </Link>
);

// lines grouped by child, in the order they appear on the invoice. lines without a child, such
// as a registration fee for the family, form their own group
const groupByChild = (lines: InvoiceLine[]) => {
  const groups = new Map<string, { name: string | null; lines: InvoiceLine[] }>();
  for (const line of lines) {
    const key = line.student_id ?? 'family';
    const group = groups.get(key) ?? { name: line.student_name, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()];
};

const TotalRow = ({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) => (
  <div className={strong ? 'flex justify-between border-t pt-2 font-semibold' : 'flex justify-between text-muted-foreground'}>
    <dt>{label}</dt>
    <dd className="tabular-nums">{amount}</dd>
  </div>
);

const InvoiceView = ({ invoice }: { invoice: Invoice }) => {
  const org = usePublicOrg();
  const open = invoice.status === 'issued' || invoice.status === 'partially_paid';
  const owed = open && invoice.balance_cents > 0;
  const groups = groupByChild(invoice.lines);

  return (
    <>
      {/* the app header is hidden on paper, so the printed page names the centre itself */}
      <p className="mb-2 hidden text-lg font-semibold print:block">{org.data?.name}</p>

      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={invoice.period_start && invoice.period_end ? formatPeriod(invoice.period_start, invoice.period_end) : undefined}
        actions={
          <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {invoice.status === 'void' && (
          <Alert>
            <AlertDescription>
              This invoice was voided{invoice.voided_at ? ` on ${formatInstantDate(invoice.voided_at)}` : ''}
              {invoice.void_reason ? `: ${invoice.void_reason}` : ''}. Nothing is owed on it.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{owed ? 'Balance due' : 'Total'}</p>
              <p className="text-3xl font-semibold tabular-nums">{money(owed ? invoice.balance_cents : invoice.total_cents)}</p>
              {owed && invoice.due_on && <p className="mt-1 text-sm text-muted-foreground">Due {formatDate(invoice.due_on)}</p>}
            </div>
            <StatusBadge kind="invoice" status={invoice.status} overdue={invoice.is_overdue} />
          </CardContent>
        </Card>

        {/* only while something is owed, and always as plain text: the instructions are written
            by an admin, and rendering stored text as markup is how stored scripts get in */}
        {owed && invoice.payment_instructions && (
          <Card>
            <CardContent>
              <h2 className="text-sm font-semibold">How to pay</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{invoice.payment_instructions}</p>
              <p className="mt-3 text-sm text-muted-foreground">Quote {invoice.invoice_number} as the payment reference.</p>
            </CardContent>
          </Card>
        )}

        <Card className="py-0">
          <CardContent>
            <DetailList items={[
              { label: 'Billed to', value: `${invoice.bill_to_name}, ${invoice.bill_to_email}` },
              { label: 'Issued', value: invoice.issued_at && formatInstantDate(invoice.issued_at) },
              { label: 'Due', value: invoice.due_on && formatDate(invoice.due_on) },
            ]} />
          </CardContent>
        </Card>

        <section aria-labelledby="lines-heading">
          <h2 id="lines-heading" className="mb-3 text-sm font-semibold">Charges</h2>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(group => [
                  // a heading row per child, only when there is more than one group to tell apart
                  groups.length > 1 && (
                    <TableRow key={`${group.name ?? 'family'}-heading`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={2} className="font-medium">{group.name ?? 'Family'}</TableCell>
                    </TableRow>
                  ),
                  ...group.lines.map(line => (
                    <TableRow key={line.id} className="break-inside-avoid">
                      <TableCell className="whitespace-normal">
                        {line.description}
                        {line.quantity !== 1 && (
                          <span className="text-muted-foreground"> ({line.quantity} at {money(line.unit_cents)})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(line.amount_cents)}</TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
            <dl className="space-y-1 border-t px-4 py-3 text-sm">
              <TotalRow label="Subtotal" amount={money(invoice.subtotal_cents)} />
              {invoice.discount_cents > 0 && <TotalRow label="Discount" amount={money(-invoice.discount_cents)} />}
              {invoice.tax_cents > 0 && <TotalRow label="Tax" amount={money(invoice.tax_cents)} />}
              <TotalRow label="Total" amount={money(invoice.total_cents)} strong />
              {invoice.paid_cents > 0 && <TotalRow label="Paid" amount={money(-invoice.paid_cents)} />}
              {invoice.credited_cents > 0 && <TotalRow label="Credited" amount={money(-invoice.credited_cents)} />}
              {(invoice.paid_cents > 0 || invoice.credited_cents > 0) && (
                <TotalRow label="Balance due" amount={money(invoice.balance_cents)} strong />
              )}
            </dl>
          </Card>
        </section>

        {invoice.allocations.length > 0 && (
          <section aria-labelledby="payments-heading">
            <h2 id="payments-heading" className="mb-3 text-sm font-semibold">Payments</h2>
            <Card className="py-0">
              <ul className="divide-y">
                {invoice.allocations.map(payment => (
                  <li key={payment.payment_id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm break-inside-avoid">
                    <div className="min-w-0">
                      <p className="font-medium">{METHOD_LABELS[payment.method]}, {formatInstantDate(payment.received_at)}</p>
                      {payment.reference && <p className="text-muted-foreground">Reference {payment.reference}</p>}
                    </div>
                    <span className="shrink-0 tabular-nums">{money(payment.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {invoice.credit_notes.length > 0 && (
          <section aria-labelledby="credits-heading">
            <h2 id="credits-heading" className="mb-3 text-sm font-semibold">Credits</h2>
            <Card className="py-0">
              <ul className="divide-y">
                {invoice.credit_notes.map(note => (
                  <li key={note.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm break-inside-avoid">
                    <div className="min-w-0">
                      <p className="font-medium">{formatInstantDate(note.created_at)}</p>
                      {note.reason && <p className="text-muted-foreground">{note.reason}</p>}
                    </div>
                    <span className="shrink-0 tabular-nums">{money(note.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {invoice.notes && (
          <section aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="mb-3 text-sm font-semibold">Notes</h2>
            <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
          </section>
        )}
      </div>
    </>
  );
};

const InvoiceDetail = ({ invoiceId }: { invoiceId: string }) => {
  const invoice = useInvoice(invoiceId);
  return (
    <QueryState
      query={invoice}
      skeleton={<div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}
      notFound={<InvoiceNotFound />}
    >
      {data => <InvoiceView invoice={data} />}
    </QueryState>
  );
};

export const InvoicePage = () => {
  const { invoiceId } = useParams();
  // checked before any request: a malformed id reads as not found
  const valid = invoiceId !== undefined && uuid.safeParse(invoiceId).success;
  return (
    <>
      <BackLink />
      {valid ? <InvoiceDetail key={invoiceId} invoiceId={invoiceId} /> : <InvoiceNotFound />}
    </>
  );
};