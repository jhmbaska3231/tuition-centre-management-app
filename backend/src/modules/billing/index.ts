// backend/src/modules/billing/index.ts

import { feePlansRouter, invoicesRouter, paymentsRouter, webhooksRouter, billingFlagsRouter } from './routes';

export { runInvoiceGeneration, runOverdueReminders } from './invoice-run';
export { registerAdapter } from './webhooks';
export { raiseUnpaidBalanceFlags } from './service';
export type { PaymentProviderAdapter, NormalisedPaymentEvent } from './webhooks';

export const billingRouters = [
  { path: '/api/fee-plans', router: feePlansRouter },
  { path: '/api/invoices', router: invoicesRouter },
  { path: '/api/payments', router: paymentsRouter },
  { path: '/api/billing/webhooks', router: webhooksRouter },
  { path: '/api/billing-flags', router: billingFlagsRouter },
];