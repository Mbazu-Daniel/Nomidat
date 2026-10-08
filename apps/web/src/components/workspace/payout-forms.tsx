import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBanks, requestWithdrawal, savePayoutAccount, type Bank } from "@/data/payouts";
import { parseMoneyToMinor } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState, type FormEvent, type ReactNode } from "react";

/**
 * Payout destination and withdrawal request.
 *
 * The destination is snapshotted onto each request server-side, so changing the
 * bank account afterwards cannot redirect money that was already agreed.
 */
export function PayoutAccountForm({
  organizationId,
  businessName,
  bankName,
  accountNumber,
  isVerified,
  onSaved,
}: {
  organizationId: string;
  businessName: string;
  bankName: string;
  accountNumber: string;
  isVerified: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    businessName: businessName || "",
    bankCode: "",
    bankName: bankName || "",
    accountNumber: accountNumber || "",
  });
  const banks = useAsyncResource(getBanks, organizationId, [], 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await savePayoutAccount(organizationId, form);
      setMessage("Saved. We confirm the account name with the bank before it can receive money.");
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">Payout destination</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Withdrawals are paid to this account. The name must match the one your bank holds.
      </p>

      {isVerified ? (
        <p className="mt-4 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-foreground">
          Verified: {businessName} · {bankName} · {accountNumber}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          id="payout-business"
          label="Account name"
          value={form.businessName}
          onChange={set("businessName")}
        />
        <Field
          id="payout-number"
          label="Account number"
          value={form.accountNumber}
          onChange={set("accountNumber")}
          inputMode="numeric"
        />
        <Field
          id="payout-bank-code"
          label="Bank code"
          value={form.bankCode}
          onChange={set("bankCode")}
          datalistId="payout-bank-list"
        >
          {banks.data && banks.data.length > 0 ? (
            <datalist id="payout-bank-list">
              {banks.data.map((bank: Bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </datalist>
          ) : null}
        </Field>
        <Field
          id="payout-bank-name"
          label="Bank name"
          value={form.bankName}
          onChange={set("bankName")}
        />
      </div>

      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={busy} className="mt-4">
        {busy ? "Saving…" : "Save destination"}
      </Button>
    </form>
  );
}

export function WithdrawalForm({
  organizationId,
  balanceMinor,
  currency,
  onRequested,
}: {
  organizationId: string;
  balanceMinor: number;
  currency: string;
  onRequested: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Typed in major units, recorded in minor units. parseMoneyToMinor takes the
  // scale from the currency rather than dividing by 100.
  const amountMinor = parseMoneyToMinor(amount, currency);
  const overBalance = amountMinor !== null && amountMinor > balanceMinor;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!amountMinor) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestWithdrawal(organizationId, amountMinor);
      setAmount("");
      setMessage("Requested. The bank details recorded now are the ones we will pay.");
      onRequested();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not request a withdrawal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">Withdraw</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="withdraw-amount">Amount ({currency})</Label>
          <Input
            id="withdraw-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>
        <Button type="submit" disabled={busy || overBalance || !amountMinor}>
          {busy ? "Requesting…" : "Request withdrawal"}
        </Button>
      </div>
      {overBalance ? (
        <p className="mt-2 text-sm text-destructive">
          That is more than the available balance of {balanceMinor}.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  inputMode,
  datalistId,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  datalistId?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        list={datalistId}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </div>
  );
}
