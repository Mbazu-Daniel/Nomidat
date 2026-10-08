import { Link } from "@tanstack/react-router";
import { createApiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useLoadedResource } from "@/lib/use-api-resource";
import type { ReceiptData, BusinessProfile } from "./types/settings.type";
export function SaleReceipt({
  organizationId,
  saleId,
}: {
  organizationId: string;
  saleId: string;
}) {
  const { data, error } = useLoadedResource(
    async () => {
      const path = `/organizations/${organizationId}`;
      const [receipt, business] = await Promise.all([
        createApiRequest<ReceiptData>(`${path}/sales/${saleId}/receipt`),
        createApiRequest<BusinessProfile>(path),
      ]);
      return { receipt, business };
    },
    [organizationId, saleId],
    { receipt: undefined, business: undefined } as {
      receipt: ReceiptData | undefined;
      business: BusinessProfile | undefined;
    },
  );
  const receipt = data.receipt;
  const business = data.business;
  // The sale carries its own currency, so the formatting follows it. A fixed /100
  // and a fixed locale printed dollars to two decimals with a Nigerian grouping
  // pattern, which reads as a different amount rather than as a wrong format.
  const money = (amount: number) => formatMoney(amount, receipt?.sale.currency ?? "NGN");
  return (
    <main className="receipt-page">
      <div className="receipt-controls">
        <Link to="/sales">← Back to sales</Link>
        {receipt && (
          <button className="workspace-primary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        )}
      </div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {!receipt && !error && <p>Loading receipt…</p>}
      {receipt && (
        <article className="receipt-paper">
          <header>
            {business?.logo && (
              <img className="invoice-business-logo" src={business.logo} alt="Business logo" />
            )}
            <h1>{business?.name ?? "Sales receipt"}</h1>
            <p>{receipt.receiptNumber}</p>
            <p>{new Date(receipt.sale.createdAt).toLocaleString()}</p>
          </header>
          <h2>Sales receipt</h2>
          <p>Customer: {receipt.sale.customer ?? "Walk-in customer"}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPriceMinor)}</td>
                  <td>{money(item.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="receipt-totals">
            <div>
              <dt>Sale total</dt>
              <dd>{money(receipt.sale.totalMinor)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{money(receipt.paidMinor)}</dd>
            </div>
            <div>
              <dt>Balance outstanding</dt>
              <dd>{money(receipt.balanceMinor)}</dd>
            </div>
          </dl>
          <h2>Payment history</h2>
          {!receipt.payments.length ? (
            <p>No payments recorded.</p>
          ) : (
            <div className="receipt-payment-list">
              {receipt.payments.map((payment) => (
                <div key={payment.id}>
                  <strong>{money(payment.amountMinor)}</strong>
                  <p>
                    {payment.method} · {new Date(payment.paidAt).toLocaleString()}
                  </p>
                  {payment.reference && <p>Reference: {payment.reference}</p>}
                </div>
              ))}
            </div>
          )}
          <footer>Thank you for your business. · Prepared with Nomidat</footer>
        </article>
      )}
    </main>
  );
}
