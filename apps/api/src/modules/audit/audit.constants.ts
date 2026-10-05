/**
 * Canonical action names. Kept as a union so a typo in a call site is a compile
 * error rather than a silently missing row in the audit trail.
 */
export const AUDIT_ACTIONS = [
  "invoice.created",
  "invoice.shared",
  "invoice.share_revoked",
  "invoice.offer_proposed",
  "invoice.offer_accepted",
  "invoice.offer_declined",
  "payment.initialized",
  "payment.received",
  "sale.created",
  "pos.sale_recorded",
  "pos.replay_rejected",
  "storefront.published",
  "settings.updated",
  "platform.tenant_viewed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Caps a metadata blob so one call cannot write an unbounded row. */
export const MAX_AUDIT_METADATA_BYTES = 4_000;

/** How much history the audit list will return in one page. */
export const MAX_AUDIT_PAGE_SIZE = 100;
