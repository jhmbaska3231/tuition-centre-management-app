// backend/src/modules/billing/routes.ts

import { Router } from 'express';
import { idParam, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import { getCurrentOrgId } from '../org/current-org';
import { readIntegrationConfig } from '../org/integrations';
import {
  createFeePlanSchema, createManualInvoiceSchema, creditNoteSchema, listInvoicesQuery,
  listPaymentsQuery, providerParam, recordPaymentSchema, refundSchema,
  updateFeePlanSchema, voidInvoiceSchema,
} from '@tuition/shared';
import * as service from './service';
import { handleWebhook } from './webhooks';

const staff = authorise('admin', 'branch_manager');

export const feePlansRouter = Router();
feePlansRouter.use(authenticate);
feePlansRouter.get('/', async (req, res) => { res.json(await service.listFeePlans(currentUser(req))); });
feePlansRouter.post('/', authorise('admin'), validate({ body: createFeePlanSchema }), async (req, res) => { res.status(201).json(await service.createFeePlan(currentUser(req), req.validated.body)); });
feePlansRouter.patch('/:id', authorise('admin'), validate({ params: idParam, body: updateFeePlanSchema }), async (req, res) => { res.json(await service.updateFeePlan(currentUser(req), req.validated.params.id, req.validated.body)); });
feePlansRouter.post('/:id/archive', authorise('admin'), validate({ params: idParam }), async (req, res) => { res.json(await service.archiveFeePlan(currentUser(req), req.validated.params.id)); });

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);
invoicesRouter.get('/', validate({ query: listInvoicesQuery }), async (req, res) => { res.json(await service.listInvoices(currentUser(req), req.validated.query)); });
invoicesRouter.get('/my-balance', authorise('parent'), async (req, res) => { res.json(await service.myBalance(currentUser(req))); });
invoicesRouter.post('/', staff, validate({ body: createManualInvoiceSchema }), async (req, res) => { res.status(201).json(await service.createManualInvoice(currentUser(req), req.validated.body)); });
invoicesRouter.get('/:id', validate({ params: idParam }), async (req, res) => { res.json(await service.getInvoice(currentUser(req), req.validated.params.id)); });
invoicesRouter.post('/:id/void', staff, validate({ params: idParam, body: voidInvoiceSchema }), async (req, res) => { res.json(await service.voidInvoice(currentUser(req), req.validated.params.id, req.validated.body.reason)); });
invoicesRouter.post('/:id/credit-notes', staff, validate({ params: idParam, body: creditNoteSchema }), async (req, res) => { res.status(201).json(await service.issueCreditNote(currentUser(req), req.validated.params.id, req.validated.body.amountCents, req.validated.body.reason)); });

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);
paymentsRouter.get('/', validate({ query: listPaymentsQuery }), async (req, res) => { res.json(await service.listPayments(currentUser(req), req.validated.query)); });
paymentsRouter.post('/', staff, validate({ body: recordPaymentSchema }), async (req, res) => { res.status(201).json(await service.recordPayment(currentUser(req), req.validated.body)); });
paymentsRouter.get('/:id', validate({ params: idParam }), async (req, res) => { res.json(await service.getPayment(currentUser(req), req.validated.params.id)); });
paymentsRouter.post('/:id/refund', staff, validate({ params: idParam, body: refundSchema }), async (req, res) => { res.json(await service.refundPayment(currentUser(req), req.validated.params.id, req.validated.body.reason)); });

// unauthenticated by design: the provider signature is the credential, body arrives raw
// (see app.ts) so the signature can be checked against the exact bytes
export const webhooksRouter = Router();
webhooksRouter.post('/:provider', validate({ params: providerParam }), async (req, res) => {
  const orgId = await getCurrentOrgId();
  const integration = await readIntegrationConfig(orgId, 'payment');
  const config = integration && integration.provider === req.validated.params.provider ? integration.config : null;
  res.json(await handleWebhook(orgId, req.validated.params.provider, req.body as Buffer, req.headers, config));
});