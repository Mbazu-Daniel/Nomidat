/**
 * The trail speaks in dotted action names because that is what is stored. This
 * is the one place those are turned into something a person can read.
 */
export const ACTION_LABELS: Record<string, string> = {
  "invoice.created": "Invoice created",
  "invoice.shared": "Invoice shared",
  "invoice.share_revoked": "Invoice share revoked",
  "invoice.offer_proposed": "Offer proposed",
  "invoice.offer_accepted": "Offer accepted",
  "invoice.offer_declined": "Offer declined",
  "payment.initialized": "Payment started",
  "payment.received": "Payment received",
  "sale.created": "Sale recorded",
  "pos.sale_recorded": "Till sale recorded",
  "pos.replay_rejected": "Queued sale refused",
  "storefront.published": "Shop published",
  "settings.updated": "Settings changed",
  "platform.tenant_viewed": "Platform viewed tenant",
  "product.low_stock": "Product low on stock",
};
