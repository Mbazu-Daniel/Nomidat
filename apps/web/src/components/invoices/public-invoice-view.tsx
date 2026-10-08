import { EMPTY_PUBLIC_INVOICE, getPublicInvoice, proposeInvoiceOffer } from "@/data/invoices";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import "./invoice-public.css";

/**
 * The page a customer sees from a shared link. It deliberately renders only the
 * fields the public route returns, and it never links anywhere that would need
 * the seller's session.
 */
export function PublicInvoiceView({ shareCode }: { shareCode: string }) {
  const invoice = useAsyncResource(getPublicInvoice, shareCode, EMPTY_PUBLIC_INVOICE);

  if (invoice.error) {
    return (
      <main className="invoice-public">
        <div className="invoice-public-card">
          <h1>Invoice unavailable</h1>
          <p className="invoice-public-muted">{invoice.error}</p>
          <p className="invoice-public-muted">
            Ask the sender for a new link. Links can be revoked at any time.
          </p>
        </div>
      </main>
    );
  }

  const data = invoice.data;

  return (
    <main className="invoice-public">
      <article className="invoice-public-card">
        <header className="invoice-public-head">
          <div>
            {data.seller.logo && (
              <img className="invoice-public-logo" src={data.seller.logo} alt="" />
            )}
            <h1>{data.seller.name}</h1>
          </div>
          <div className="invoice-public-meta">
            <p className="invoice-public-number">{data.invoiceNumber}</p>
            <span className="invoice-public-status" data-status={data.status}>
              {data.status}
            </span>
          </div>
        </header>

        <dl className="invoice-public-facts">
          {data.customerName && (
            <div>
              <dt>Billed to</dt>
              <dd>{data.customerName}</dd>
            </div>
          )}
          <div>
            <dt>Issued</dt>
            <dd>{new Date(data.issuedAt).toLocaleDateString()}</dd>
          </div>
          {data.dueDate && (
            <div>
              <dt>Due</dt>
              <dd>{new Date(data.dueDate).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>

        <table className="invoice-public-items">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Qty</th>
              <th scope="col">Unit</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              // Items have no id in the public projection; the row is positional.
              // eslint-disable-next-line react/no-array-index-key
              <tr key={`${item.description ?? "item"}-${index}`}>
                <td>{item.description ?? "Item"}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPriceMinor, data.currency)}</td>
                <td>{formatMoney(item.totalMinor, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="invoice-public-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(data.subtotalMinor, data.currency)}</dd>
          </div>
          {data.discountMinor > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>-{formatMoney(data.discountMinor, data.currency)}</dd>
            </div>
          )}
          {data.taxMinor > 0 && (
            <div>
              <dt>Tax</dt>
              <dd>{formatMoney(data.taxMinor, data.currency)}</dd>
            </div>
          )}
          <div className="invoice-public-grand">
            <dt>Total</dt>
            <dd>{formatMoney(data.totalMinor, data.currency)}</dd>
          </div>
        </dl>

        {data.notes && <p className="invoice-public-notes">{data.notes}</p>}

        <ProposeOffer shareCode={shareCode} currency={data.currency} totalMinor={data.totalMinor} />

        <footer className="invoice-public-foot">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </footer>
      </article>
    </main>
  );
}

/**
 * Suggesting a different amount.
 *
 * This does not change what is owed. The amount stays at the invoice total
 * until the seller accepts, and the copy says so plainly — a proposal that
 * looked final would be a way to collect money that was never agreed.
 */
function ProposeOffer({
  shareCode,
  currency,
  totalMinor,
}: {
  shareCode: string;
  currency: string;
  totalMinor: number;
}) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const proposedTotalMinor = parseMoneyToMinor(amount, currency);
  const lowered =
    proposedTotalMinor !== null && proposedTotalMinor > 0 && proposedTotalMinor < totalMinor;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (proposedTotalMinor === null || proposedTotalMinor <= 0) {
      setError(`Enter an amount in ${currency}, such as 450.00.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await proposeInvoiceOffer(shareCode, {
        proposedTotalMinor,
        message: message.trim() || undefined,
      });
      setSent(true);
      setAmount("");
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send that offer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invoice-public-offer" onSubmit={(event) => void submit(event)}>
      <h2>Suggest a different amount</h2>
      <p className="invoice-public-muted">
        The total stays at {formatMoney(totalMinor, currency)} until {""}
        {currency === "NGN" ? "the seller" : "they"} accept. Nothing is charged from this page.
      </p>

      {sent ? (
        <p role="status">Your offer has been sent. You will hear back when they reply.</p>
      ) : (
        <>
          <label>
            Your amount ({currency})
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          {lowered && (
            <p className="invoice-public-muted">
              You are offering {formatMoney(totalMinor - proposedTotalMinor, currency)} less than
              the invoice total.
            </p>
          )}
          <label>
            Why? (optional)
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {error && <p className="workspace-error">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send offer"}
          </Button>
        </>
      )}
    </form>
  );
}
