export const WEBHOOK_EVENTS = [
  "invoice.created",
  "invoice.paid",
  "payment.received",
  "sale.created",
  "product.low_stock",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_TIMEOUT_MS = 10_000;

// No retry queue on purpose: a dead receiver should not accumulate work forever.
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Consecutive failures before a subscription is paused. */
export const MAX_CONSECUTIVE_FAILURES = 10;
