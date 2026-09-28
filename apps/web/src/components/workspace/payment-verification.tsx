import { useState } from "react";
import { createApiRequest } from "@/lib/api";
export function PaymentVerification({ organizationId }: { organizationId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="workspace-card settings-section">
      <h2>Check a Paystack payment</h2>
      <p>
        Enter a payment reference created for this business. A successful check also updates the
        payment record.
      </p>
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const reference = String(new FormData(event.currentTarget).get("reference") ?? "").trim();
          setBusy(true);
          setError("");
          setResult("");
          try {
            const data = await createApiRequest<{
              status: string;
              amount: number;
              currency: string;
              reference: string;
            }>(
              `/organizations/${organizationId}/payments/paystack/${encodeURIComponent(reference)}/verify`,
            );
            setResult(
              `${data.status} · ${data.currency} ${(data.amount / 100).toLocaleString()} · ${data.reference}`,
            );
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Payment reference
          <input name="reference" required maxLength={200} disabled={busy} />
        </label>
        <div className="workspace-actions">
          <button className="workspace-primary" disabled={busy}>
            {busy ? "Checking…" : "Verify payment"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {result && <p role="status">{result}</p>}
    </section>
  );
}
