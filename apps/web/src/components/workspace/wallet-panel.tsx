import type { PayoutAccount, WalletBalance } from "@/data/payouts";
import { getPayoutAccount, getWallet, getWithdrawals } from "@/data/payouts";
import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { PayoutAccountForm, WithdrawalForm } from "./payout-forms";

const EMPTY_ACCOUNT: PayoutAccount = {
  businessName: "",
  bankCode: "",
  bankName: "",
  accountNumber: "",
  platformFeeBps: 0,
  isVerified: false,
};

const EMPTY_BALANCE: WalletBalance = { balanceMinor: 0 };

/**
 * Balance, payout destination and withdrawal requests for this business.
 */
export function WalletPanel({ organizationId }: { organizationId: string }) {
  const currency = useCurrency();
  const [revision, setRevision] = useState(0);
  const org = encodeURIComponent(organizationId);
  const refresh = () => setRevision((n) => n + 1);

  const balance = useAsyncResource(getWallet, org, EMPTY_BALANCE, revision);
  const account = useAsyncResource(getPayoutAccount, org, EMPTY_ACCOUNT, revision);
  const withdrawals = useAsyncResource(getWithdrawals, org, [], revision);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Available balance
        </p>
        <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
          {balance.data ? formatMoney(balance.data.balanceMinor, currency) : "—"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Credited when a customer payment is confirmed. Withdrawals need a verified destination.
        </p>
      </div>

      <PayoutAccountForm
        organizationId={organizationId}
        businessName={account.data?.businessName ?? ""}
        bankName={account.data?.bankName ?? ""}
        accountNumber={account.data?.accountNumber ?? ""}
        isVerified={account.data?.isVerified === true}
        onSaved={refresh}
      />

      <WithdrawalForm
        organizationId={organizationId}
        balanceMinor={balance.data?.balanceMinor ?? 0}
        currency={currency}
        onRequested={refresh}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Withdrawal history</h2>
        {withdrawals.error ? (
          <p className="mt-3 text-sm text-destructive">{withdrawals.error}</p>
        ) : !withdrawals.data || withdrawals.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {withdrawals.data.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatMoney(request.amountMinor, request.currency || currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.bankName} · {request.accountNumber}
                  </p>
                  {request.failureReason ? (
                    <p className="text-xs text-destructive">{request.failureReason}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-foreground">
                  {request.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
