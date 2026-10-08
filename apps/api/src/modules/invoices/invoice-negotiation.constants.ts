/** Caps text written by an unauthenticated caller. */
export const MAX_NEGOTIATION_MESSAGE_LENGTH = 500;

export const CLOSED_INVOICE_STATUSES = ["paid", "void", "cancelled"] as const;

export const NEGOTIATION_DECISIONS = ["accepted", "declined"] as const;
export type NegotiationDecision = (typeof NEGOTIATION_DECISIONS)[number];
