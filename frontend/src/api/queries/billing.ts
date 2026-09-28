// frontend/src/api/queries/billing.ts

import { useQuery } from '@tanstack/react-query';
import type { BalanceSummary, Invoice, InvoiceStatus } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// a type alias, so it fits the client's query params
export type InvoiceFilters = {
  status?: InvoiceStatus;
};

// for a parent, only invoices billed to them
export const useInvoices = (filters: InvoiceFilters = {}) =>
  useQuery({
    queryKey: keys.invoices.list(filters),
    queryFn: () => api.get<Invoice[]>('/invoices', filters),
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: keys.invoices.detail(id),
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
  });

// the signed in parent's outstanding and overdue totals
export const useMyBalance = () =>
  useQuery({
    queryKey: keys.invoices.myBalance(),
    queryFn: () => api.get<BalanceSummary>('/invoices/my-balance'),
  });