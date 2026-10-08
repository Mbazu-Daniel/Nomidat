import { createApiRequest } from "@/lib/api";

/** What money means for a business: its currency and its tax rate. */
export interface MoneyPolicy {
  currency: string;
  taxRateBps: number;
}

export const FALLBACK_MONEY_POLICY: MoneyPolicy = { currency: "NGN", taxRateBps: 0 };

export function getMoneyPolicy(organizationId: string) {
  return createApiRequest<MoneyPolicy>(
    `/organizations/${encodeURIComponent(organizationId)}/pos/money-policy`,
  );
}
