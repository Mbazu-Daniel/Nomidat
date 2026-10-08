/** Changing this orphans existing payment history. */
export const PAYSTACK_PROVIDER_CODE = "paystack";

export const PAYSTACK_PAYMENT_METHOD = "paystack";

/**
 * Only a dedicated virtual account lets the customer pick the amount; every
 * other channel is initialised with an amount we set, so a mismatch there is an
 * error. Widening this set silently relaxes the amount check.
 */
const CUSTOMER_CHOSEN_AMOUNT_CHANNELS = new Set(["dedicated_nuban"]);

export function isCustomerChosenAmountChannel(channel: string | null | undefined): boolean {
  return channel != null && CUSTOMER_CHOSEN_AMOUNT_CHANNELS.has(channel);
}
