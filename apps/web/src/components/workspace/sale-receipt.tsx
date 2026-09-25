import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createApiRequest } from "@/lib/api";
import type { ReceiptData, BusinessProfile } from "./types/settings.type";
export function SaleReceipt({
  organizationId,
  saleId,
}: {
  organizationId: string;
  saleId: string;
}) {
  const [receipt, setReceipt] = useState<ReceiptData>();
  const [business, setBusiness] = useState<BusinessProfile>();
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const path = `/organizations/${organizationId}`;
    void Promise.all([
      createApiRequest<ReceiptData>(`${path}/sales/${saleId}/receipt`),
      createApiRequest<BusinessProfile>(path),
    ])
      .then(([data, profile]) => {
        if (!cancelled) {
          setReceipt(data);
          setBusiness(profile);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, saleId]);
  const money = (amount: number) =>
    `${receipt?.sale.currency ?? "NGN"} ${(amount / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                  <td>{money(item.unitPriceKobo)}</td>
                  <td>{money(item.totalKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="receipt-totals">
            <div>
              <dt>Sale total</dt>
              <dd>{money(receipt.sale.totalKobo)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{money(receipt.paidKobo)}</dd>
            </div>
            <div>
              <dt>Balance outstanding</dt>
              <dd>{money(receipt.balanceKobo)}</dd>
            </div>
          </dl>
          <h2>Payment history</h2>
          {!receipt.payments.length ? (
            <p>No payments recorded.</p>
          ) : (
            <div className="receipt-payment-list">
              {receipt.payments.map((payment) => (
                <div key={payment.id}>
                  <strong>{money(payment.amountKobo)}</strong>
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
