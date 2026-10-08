/**
 * The events a subscription can actually receive. Every entry has a caller:
 * `sale.created` from SalesService, `invoice.created` from InvoicesService,
 * `payment.received` from PaymentNotificationService.
 *
 * Nothing here is aspirational. An event with no producer is a promise a tenant
 * can subscribe to and wait for forever, which is worse than not offering it —
 * `invoice.paid` and `product.low_stock` were removed for exactly that reason,
 * because no code marks an invoice paid and no code detects a product crossing
 * its threshold. Add an event only alongside the call that emits it.
 */
export const WEBHOOK_EVENTS = ["invoice.created", "payment.received", "sale.created"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_TIMEOUT_MS = 10_000;

// No retry queue on purpose: a dead receiver should not accumulate work forever.
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Consecutive failures before a subscription is paused. */
export const MAX_CONSECUTIVE_FAILURES = 10;
