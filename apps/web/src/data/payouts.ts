import { createApiRequest } from "@/lib/api";

/** The API returns the balance alone; currency comes from the business profile. */
export interface WalletBalance {
  balanceMinor: number;
}

export interface WalletEntry {
  id: string;
  kind: string;
  amountMinor: number;
  balanceAfterMinor: number;
  description: string | null;
  referenceType: string | null;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  bankName: string;
  accountNumber: string;
  failureReason: string | null;
  requestedAt: string;
  sentAt: string | null;
}

export interface PayoutAccount {
  businessName: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  platformFeeBps: number;
  /** False until Paystack has confirmed the account resolves to this business. */
  isVerified: boolean;
}

export interface Bank {
  code: string;
  name: string;
}

export interface PlatformCapabilities {
  transactions: boolean;
  customerDirectory: boolean;
  dedicatedVirtualAccounts: boolean;
  settlementSplits: boolean;
}

const wallet = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/wallet`;
const payoutAccount = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/payout-account`;

export function getWallet(organizationId: string) {
  return createApiRequest<WalletBalance>(wallet(organizationId));
}

export function getWalletEntries(organizationId: string, limit = 20, offset = 0) {
  return createApiRequest<WalletEntry[]>(
    `${wallet(organizationId)}/entries?limit=${limit}&offset=${offset}`,
  );
}

export function getWithdrawals(organizationId: string, limit = 20, offset = 0) {
  return createApiRequest<WithdrawalRequest[]>(
    `${wallet(organizationId)}/withdrawals?limit=${limit}&offset=${offset}`,
  );
}

export function requestWithdrawal(organizationId: string, amountMinor: number) {
  return createApiRequest<WithdrawalRequest>(`${wallet(organizationId)}/withdrawals`, {
    method: "POST",
    body: JSON.stringify({ amountMinor }),
  });
}

export function getPayoutAccount(organizationId: string) {
  return createApiRequest<PayoutAccount>(payoutAccount(organizationId));
}

export function getBanks(organizationId: string) {
  return createApiRequest<Bank[]>(`${payoutAccount(organizationId)}/banks`);
}

export function savePayoutAccount(
  organizationId: string,
  input: Pick<PayoutAccount, "businessName" | "bankCode" | "bankName" | "accountNumber">,
) {
  return createApiRequest<PayoutAccount>(payoutAccount(organizationId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPlatformCapabilities(organizationId: string) {
  return createApiRequest<PlatformCapabilities>(`${payoutAccount(organizationId)}/capabilities`);
}
