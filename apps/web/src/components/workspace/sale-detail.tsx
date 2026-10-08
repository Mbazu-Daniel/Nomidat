import { useCurrency } from "@/lib/currency-context";
import { formatMoney, minorToDecimalInput, parseMoneyToMinor } from "@/lib/money";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { useApiResource, useSubmit } from "@/lib/use-api-resource";
import type { SaleDetailProps } from "./types";
import type { SalePaymentSummary } from "./types/workspace.type";
import "./sale-detail.css";

export function SaleDetail({ path, record, canWrite, onSaved }: SaleDetailProps) {
  const currency = useCurrency();
  const paymentFormId = useId();
  // Bumped after a payment is recorded, so the balance on screen is the one the
  // books now hold.
  const [version, setVersion] = useState(0);
  const loaded = useApiResource<SalePaymentSummary | null>(
    `${path}/sales/${record.id}`,
    null,
    version,
  );
  const sale = loaded.data;
  const loading = loaded.loading;
  const { busy, error, setError, submit } = useSubmit();
  const [paymentUrl, setPaymentUrl] = useState("");
  async function save(resource: string, body: object) {
    const saved = await submit(async () => {
      await createApiRequest(path + resource, { method: "POST", body: JSON.stringify(body) });
      onSaved();
    });
    // A refused payment may still have moved the books — a provider webhook can
    // land before the response does — so the summary is re-read rather than trusted.
    if (!saved && resource.includes("/payments")) setVersion((value) => value + 1);
  }
  const canCollect = !loading && sale !== null && sale.balanceMinor > 0;
  function renderPaymentForm() {
    if (!sale) return null;
    return (
      <form
        id={paymentFormId}
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          const amountMinor = parseMoneyToMinor(String(data.get("amount") ?? ""), currency);
          if (amountMinor === null || amountMinor <= 0 || amountMinor > sale.balanceMinor) {
            setError(
              `Enter an additional payment between ${formatMoney(1, currency)} and ${formatMoney(
                sale.balanceMinor,
                currency,
              )}.`,
            );
            return;
          }
          void save(`/sales/${record.id}/payments`, {
            amountMinor,
            method: data.get("method"),
          });
        }}
      >
        <h3>Record an additional payment</h3>
        <p>Enter only the new amount received. Previous payments are already included above.</p>
        <fieldset disabled={busy} className="workspace-form-grid">
          <label>
            Additional payment ({currency})
            <input
              name="amount"
              type="number"
              required
              min={Number(minorToDecimalInput(1, currency))}
              max={Number(minorToDecimalInput(sale.balanceMinor, currency))}
              step={Number(minorToDecimalInput(1, currency))}
              aria-describedby="sale-payment-limit"
            />
            <small id="sale-payment-limit">
              Up to {formatMoney(sale.balanceMinor, currency)} remaining.
            </small>
          </label>
          <label>
            Method
            <select name="method">
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
              <option value="card">Card</option>
            </select>
          </label>
        </fieldset>
      </form>
    );
  }
  function renderWriteActions() {
    if (!canWrite) return null;
    return (
      <>
        {canCollect && renderPaymentForm()}
        <div className="workspace-actions">
          {canCollect && (
            <button
              type="submit"
              form={paymentFormId}
              className="workspace-primary"
              disabled={busy}
            >
              {busy ? "Recording…" : "Record payment"}
            </button>
          )}
          <button
            type="button"
            className="workspace-secondary"
            disabled={busy}
            onClick={() => void save(`/invoices/from-sales/${record.id}`, {})}
          >
            Create invoice from sale
          </button>
        </div>
        {canCollect && (
          <form
            className="workspace-form sale-payment-link-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await submit(async () => {
                const result = await createApiRequest<{ authorizationUrl: string }>(
                  `${path}/payments/paystack/initialize`,
                  {
                    method: "POST",
                    body: JSON.stringify({ orderId: record.id, email: data.get("email") }),
                  },
                );
                // Only ever follow an https redirect from the payment provider.
                if (!result.authorizationUrl.startsWith("https://"))
                  throw new Error("Invalid payment URL returned.");
                setPaymentUrl(result.authorizationUrl);
              });
            }}
          >
            <label>
              Customer email
              <input type="email" name="email" required />
            </label>
            <button className="workspace-secondary" disabled={busy}>
              Create Paystack payment link
            </button>
            {paymentUrl && (
              <a href={paymentUrl} target="_blank" rel="noreferrer">
                Open payment link ↗
              </a>
            )}
          </form>
        )}
      </>
    );
  }
  return (
    <>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}{" "}
      <>
        {loading && <p role="status">Loading current payment balance…</p>}
        {!loading && !sale && (
          <button
            className="workspace-secondary"
            onClick={() => {
              setError("");
              setVersion((value) => value + 1);
            }}
          >
            Retry balance
          </button>
        )}
        {sale && (
          <dl className="sale-payment-summary" aria-busy={loading}>
            <div>
              <dt>Sale total</dt>
              <dd>{formatMoney(sale.totalMinor, currency)}</dd>
            </div>
            <div>
              <dt>Already paid</dt>
              <dd>{formatMoney(sale.paidMinor, currency)}</dd>
            </div>
            <div className="sale-balance">
              <dt>Outstanding balance</dt>
              <dd>{formatMoney(sale.balanceMinor, currency)}</dd>
            </div>
          </dl>
        )}
        {!loading && sale?.balanceMinor === 0 && (
          <p className="sale-paid-message" role="status">
            Fully paid · No further payment is needed.
          </p>
        )}
        <div className="workspace-actions">
          <Link
            className="workspace-secondary"
            to="/receipts/$organizationId/$saleId"
            params={{ organizationId: path.split("/").at(-1) ?? "", saleId: record.id }}
          >
            View receipt & payment history
          </Link>
        </div>
        {renderWriteActions()}
      </>
    </>
  );
}
