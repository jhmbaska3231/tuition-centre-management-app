// backend/src/modules/billing/webhooks.ts
//
// gateway boundary. a provider adapter verifies the signature and normalises the event.
// the route stores the event first (idempotent on provider event id), then applies it.
// no adapters are registered yet, adding stripe means implementing this interface with
// the stripe sdk and reading the secret via readintegrationconfig(orgid, 'payment')

import { Request } from 'express';
import { isUniqueViolation, pool, withTransaction } from '../../db';
import { NotFoundError, UnauthorizedError } from '../../http/errors';
import * as repo from './repository';
import { applyGatewayPayment } from './service';

export interface NormalisedPaymentEvent {
  eventId: string;
  kind: 'payment_succeeded' | 'ignored';
  reference: string;
  payerUserId: string;  // from checkout metadata
  invoiceId: string | null;  // from checkout metadata
  amountCents: number;
  method: string;
}

export interface PaymentProviderAdapter {
  // throw unauthorizederror if the signature does not verify
  verifyAndParse(rawBody: Buffer, headers: Request['headers'], config: Record<string, string>): NormalisedPaymentEvent;
}

const adapters: Record<string, PaymentProviderAdapter> = {};
export const registerAdapter = (provider: string, adapter: PaymentProviderAdapter) => { adapters[provider] = adapter; };

export const handleWebhook = async (orgId: string, provider: string, rawBody: Buffer, headers: Request['headers'], config: Record<string, string> | null) => {
  const adapter = adapters[provider];
  if (!adapter || !config) throw new NotFoundError('Payment provider');
  const event = adapter.verifyAndParse(rawBody, headers, config);  // throws unauthorizederror on bad signature

  const stored = await withTransaction(tx => repo.insertWebhookEvent(tx, orgId, provider, event.eventId, JSON.parse(rawBody.toString('utf8'))));
  if (!stored) return { status: 'duplicate' };  // provider retry, already handled

  try {
    if (event.kind === 'payment_succeeded') {
      try {
        await applyGatewayPayment(orgId, { provider, reference: event.reference, payerUserId: event.payerUserId, amountCents: event.amountCents, method: event.method, invoiceId: event.invoiceId, payload: event });
      } catch (err) {
        if (!isUniqueViolation(err, 'payments_provider_reference_uq')) throw err;  // same charge reported twice under different event ids
      }
    }
    await repo.markWebhookProcessed(pool, stored.id, null);
    return { status: 'processed' };
  } catch (err) {
    await repo.markWebhookProcessed(pool, stored.id, (err as Error).message);
    throw err;
  }
};

export { UnauthorizedError };