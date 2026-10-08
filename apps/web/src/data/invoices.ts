import { createApiRequest } from "@/lib/api";

/**
 * The public invoice shape. It is declared here to match the API's allow-list
 * exactly; if the API ever widens what a share link returns, the compiler points
 * at this file rather than the page silently rendering whatever arrived.
 */
export interface PublicInvoice {
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  dueDate: string | null;
  notes: string | null;
  issuedAt: string;
  seller: { name: string; logo: string | null };
  customerName: string | null;
  items: {
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
}

export interface ShareCodeResult {
  shareCode: string;
  updatedAt: string;
}

const EMPTY_INVOICE = {
  invoiceNumber: "",
  status: "",
  currency: "NGN",
  subtotalMinor: 0,
  discountMinor: 0,
  taxMinor: 0,
  totalMinor: 0,
  dueDate: null,
  notes: null,
  issuedAt: "",
  seller: { name: "", logo: null },
  customerName: null,
  items: [],
} as PublicInvoice;

/** Unauthenticated: a share link is the only credential. */
export function getPublicInvoice(shareCode: string) {
  return createApiRequest<PublicInvoice>(`/public/invoices/${encodeURIComponent(shareCode)}`);
}

export function shareInvoice(organizationId: string, invoiceId: string) {
  return createApiRequest<ShareCodeResult>(
    `/organizations/${encodeURIComponent(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/share`,
    { method: "POST" },
  );
}

export function revokeInvoiceShare(organizationId: string, invoiceId: string) {
  return createApiRequest<{ id: string }>(
    `/organizations/${encodeURIComponent(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/share`,
    { method: "DELETE" },
  );
}

export type NegotiationStatus = "pending" | "accepted" | "declined";

export interface InvoiceOffer {
  id: string;
  proposedTotalMinor: number;
  message: string | null;
  status: NegotiationStatus;
  decidedAt: string | null;
  createdAt: string;
}

export function getInvoiceOffers(organizationId: string, invoiceId: string) {
  return createApiRequest<InvoiceOffer[]>(
    `/organizations/${encodeURIComponent(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/offers`,
  );
}

/** Accepting is the only path by which a proposed price becomes binding. */
export function decideInvoiceOffer(
  organizationId: string,
  invoiceId: string,
  negotiationId: string,
  decision: "accepted" | "declined",
) {
  return createApiRequest<InvoiceOffer>(
    `/organizations/${encodeURIComponent(organizationId)}/invoices/${encodeURIComponent(invoiceId)}/offers/${encodeURIComponent(negotiationId)}/decision`,
    { method: "POST", body: JSON.stringify({ decision }) },
  );
}

/** Unauthenticated, like the invoice itself: the share link is the only credential. */
export function proposeInvoiceOffer(
  shareCode: string,
  input: { proposedTotalMinor: number; message?: string },
) {
  return createApiRequest<InvoiceOffer>(
    `/public/invoices/${encodeURIComponent(shareCode)}/offers`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export { EMPTY_INVOICE as EMPTY_PUBLIC_INVOICE };
