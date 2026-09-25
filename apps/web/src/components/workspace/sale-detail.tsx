import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { formatNaira } from "@/data/nomidat";
import type { SaleDetailProps } from "./types";
import type { SalePaymentSummary } from "./types/workspace.type";
import "./sale-detail.css";

export function SaleDetail({ path, record, canWrite, onSaved }: SaleDetailProps) {
  const paymentFormId = useId();
  const [sale, setSale] = useState<SalePaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void createApiRequest<SalePaymentSummary>(`${path}/sales/${record.id}`)
      .then((result) => {
        if (!cancelled) setSale(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setSale(null);
          setError(reason.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, record.id, version]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  async function save(resource: string, body: object) {
    setBusy(true);
    setError("");
    try {
      await createApiRequest(path + resource, { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (reason) {
      setError((reason as Error).message);
      if (resource.includes("/payments")) setVersion((value) => value + 1);
    } finally {
      setBusy(false);
    }
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
              <dd>{formatNaira(sale.totalKobo / 100)}</dd>
            </div>
            <div>
              <dt>Already paid</dt>
              <dd>{formatNaira(sale.paidKobo / 100)}</dd>
            </div>
            <div className="sale-balance">
              <dt>Outstanding balance</dt>
              <dd>{formatNaira(sale.balanceKobo / 100)}</dd>
            </div>
          </dl>
        )}
        {!loading && sale?.balanceKobo === 0 && (
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
        {canWrite && (
          <>
            {!loading && sale && sale.balanceKobo > 0 && (
              <form
                id={paymentFormId}
                className="workspace-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy) return;
                  const data = new FormData(event.currentTarget);
                  const amountKobo = Math.round(Number(data.get("amount")) * 100);
                  if (
                    !Number.isSafeInteger(amountKobo) ||
                    amountKobo <= 0 ||
                    amountKobo > sale.balanceKobo
                  ) {
                    setError(
                      `Enter an additional payment between ₦0.01 and ${formatNaira(sale.balanceKobo / 100)}.`,
                    );
                    return;
                  }
                  void save(`/sales/${record.id}/payments`, {
                    amountKobo,
                    method: data.get("method"),
                  });
                }}
              >
                <h3>Record an additional payment</h3>
                <p>
                  Enter only the new amount received. Previous payments are already included above.
                </p>
                <fieldset disabled={busy} className="workspace-form-grid">
                  <label>
                    Additional payment (₦)
                    <input
                      name="amount"
                      type="number"
                      required
                      min="0.01"
                      max={sale.balanceKobo / 100}
                      step="0.01"
                      aria-describedby="sale-payment-limit"
                    />
                    <small id="sale-payment-limit">
                      Up to {formatNaira(sale.balanceKobo / 100)} remaining.
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
            )}
            <div className="workspace-actions">
              {!loading && sale && sale.balanceKobo > 0 && (
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
            {!loading && sale && sale.balanceKobo > 0 && (
              <form
                className="workspace-form sale-payment-link-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  setBusy(true);
                  setError("");
                  try {
                    const result = await createApiRequest<{ authorizationUrl: string }>(
                      `${path}/payments/paystack/initialize`,
                      {
                        method: "POST",
                        body: JSON.stringify({ orderId: record.id, email: data.get("email") }),
                      },
                    );
                    if (!result.authorizationUrl.startsWith("https://"))
                      throw new Error("Invalid payment URL returned.");
                    setPaymentUrl(result.authorizationUrl);
                  } catch (reason) {
                    setError((reason as Error).message);
                  } finally {
                    setBusy(false);
                  }
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
        )}
      </>
    </>
  );
}
