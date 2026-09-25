import { formatInvoiceMoney } from "./invoice-format";
import type { InvoiceDocumentProps } from "./types";

export function InvoiceDocumentPreview({ invoice }: InvoiceDocumentProps) {
  const date = (value: string) =>
    new Date(value).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return (
    <article className="invoice-paper" aria-label="Invoice preview">
      <header className="invoice-paper-header">
        <div>
          {invoice.businessLogo ? (
            <img
              className="invoice-business-logo"
              src={invoice.businessLogo}
              alt={`${invoice.businessName ?? "Business"} logo`}
            />
          ) : (
            <div className="invoice-wordmark">
              <span className="invoice-brand-mark">n</span>
              <strong>
                nomidat<span>.</span>
              </strong>
            </div>
          )}
          <p className="invoice-issuer">{invoice.businessName ?? "Your business"}</p>
          <div className="invoice-business-details">
            {invoice.businessDetails?.shopNumber && (
              <p>Shop {invoice.businessDetails.shopNumber}</p>
            )}
            {invoice.businessDetails?.address && <p>{invoice.businessDetails.address}</p>}
            {invoice.businessDetails?.phone && <p>{invoice.businessDetails.phone}</p>}
            {invoice.businessDetails?.email && <p>{invoice.businessDetails.email}</p>}
            {invoice.businessDetails?.registrationNumber && (
              <p>Registration: {invoice.businessDetails.registrationNumber}</p>
            )}
          </div>
        </div>
        <div className="invoice-heading">
          <p>INVOICE</p>
          <strong>{invoice.invoiceNumber}</strong>
          <span className="invoice-status">{invoice.status ?? "draft"}</span>
        </div>
      </header>
      <div className="invoice-billing">
        <div>
          <span className="invoice-label">BILL TO</span>
          <h3>{invoice.customer ?? "Walk-in customer"}</h3>
          <p className="invoice-muted">{invoice.customerEmail ?? "Customer invoice"}</p>
        </div>
        <dl>
          <div>
            <dt>Issued on</dt>
            <dd>{date(invoice.createdAt)}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{invoice.dueDate ? date(invoice.dueDate) : "On receipt"}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>NGN · Nigerian naira</dd>
          </div>
        </dl>
      </div>
      <div className="workspace-table-scroll invoice-paper-items">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="invoice-number">Qty</th>
              <th className="invoice-number">Unit price</th>
              <th className="invoice-number">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <span className="invoice-item-index">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item.description}</span>
                </td>
                <td className="invoice-number" data-label="Quantity">
                  {item.quantity}
                </td>
                <td className="invoice-number" data-label="Unit price">
                  {formatInvoiceMoney(item.unitPriceKobo)}
                </td>
                <td className="invoice-number" data-label="Amount">
                  <strong>{formatInvoiceMoney(item.totalKobo)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="invoice-bottom">
        <div className="invoice-note">
          <span className="invoice-label">A NOTE FOR YOU</span>
          <p>
            {invoice.notes ||
              "Thank you for your business. We appreciate the opportunity to work with you."}
          </p>
        </div>
        <dl className="invoice-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatInvoiceMoney(invoice.subtotalKobo)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>−{formatInvoiceMoney(invoice.discountKobo)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{formatInvoiceMoney(invoice.taxKobo)}</dd>
          </div>
          <div className="invoice-grand-total">
            <dt>
              Invoice total<span>NGN</span>
            </dt>
            <dd>{formatInvoiceMoney(invoice.totalKobo ?? 0)}</dd>
          </div>
        </dl>
      </div>
      <footer className="invoice-paper-footer">
        <span>{invoice.invoiceNumber}</span>
        <span>Made for better business.</span>
      </footer>
    </article>
  );
}
