import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";
import { ExpenseEditor } from "./expense-editor";
import { ProductEditor } from "./product-editor";
import { SaleDetail } from "./sale-detail";
import { InvoiceDetailPanel } from "./invoice-detail";
import { createApiRequest } from "@/lib/api";
import { useApiResource, useSubmit } from "@/lib/use-api-resource";
import type { ClientFolder, RecordDetailProps } from "./types";

export function RecordDetail({
  organizationId,
  section,
  record,
  canWrite,
  onSaved,
  onClose,
}: RecordDetailProps) {
  const currency = useCurrency();
  const path = `/organizations/${organizationId}`;
  // Only a customer has a folder to open; the other sections load their own detail.
  const loaded = useApiResource<ClientFolder | null>(
    section === "customers" ? `${path}/contacts/${record.id}` : null,
    null,
  );
  const folder = loaded.data;
  const { busy, error, submit } = useSubmit();
  async function save(resource: string, body: object, method = "POST") {
    await submit(async () => {
      await createApiRequest(path + resource, { method, body: JSON.stringify(body) });
      onSaved();
    });
  }
  function renderCustomerFolder() {
    if (!folder) return <p>Loading client folder…</p>;
    return (
      <>
        <p>
          {folder.contact.phone ?? "No phone"} · {folder.contact.email ?? "No email"}
        </p>
        <p className="workspace-total">
          Outstanding balance <strong>{formatMoney(folder.balanceMinor, currency)}</strong>
        </p>
        {canWrite && folder.contact.kind === "lead" && (
          <button
            className="workspace-primary"
            disabled={busy}
            onClick={() => void save(`/contacts/${record.id}/convert`, {})}
          >
            Convert to customer
          </button>
        )}
        <div className="workspace-folder-grid">
          <div>
            <h3>Orders</h3>
            {folder.orders.length === 0 && <p>No orders yet.</p>}
            {folder.orders.map((row) => (
              <p key={row.id}>
                {new Date(row.createdAt).toLocaleDateString()} ·{" "}
                {formatMoney(row.totalMinor ?? 0, currency)}{" "}
                <span className="workspace-badge">{row.status}</span>
              </p>
            ))}
          </div>
          <div>
            <h3>Invoices</h3>
            {folder.invoices.length === 0 && <p>No invoices yet.</p>}
            {folder.invoices.map((row) => (
              <p key={row.id}>
                {row.invoiceNumber} · {formatMoney(row.totalMinor ?? 0, currency)}
              </p>
            ))}
          </div>
        </div>
        <h3>Notes</h3>
        {folder.notes.length === 0 && <p>No notes yet.</p>}
        {folder.notes.map((row) => (
          <blockquote key={row.id}>
            {row.body}
            <small>{new Date(row.createdAt).toLocaleString()}</small>
          </blockquote>
        ))}
        {canWrite && (
          <form
            className="workspace-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save(`/contacts/${record.id}/notes`, {
                body: new FormData(event.currentTarget).get("note"),
              });
            }}
          >
            <label>
              Add a note
              <textarea name="note" required maxLength={4000} rows={3} />
            </label>
            <button className="workspace-primary workspace-save-note" disabled={busy}>
              Save note
            </button>
          </form>
        )}
      </>
    );
  }
  function renderRecordBody() {
    switch (section) {
      case "customers":
        return renderCustomerFolder();
      case "inventory":
        return (
          <>
            <p>
              {record.stockQuantity} {record.unit} in stock · Alert at {record.lowStockThreshold}
            </p>
            {canWrite && (
              <ProductEditor
                organizationId={organizationId}
                record={record}
                busy={busy}
                save={save}
                onSaved={onSaved}
              />
            )}
          </>
        );
      case "expenses":
        return canWrite ? (
          <ExpenseEditor path={path} expenseId={record.id} onSaved={onSaved} />
        ) : (
          <p>
            {record.description} · {formatMoney(record.amountMinor ?? 0, currency)}
          </p>
        );
      case "sales":
        return <SaleDetail path={path} record={record} canWrite={canWrite} onSaved={onSaved} />;
      case "invoices":
        return (
          <InvoiceDetailPanel
            organizationId={organizationId}
            invoiceId={record.id}
            canWrite={canWrite}
            onSaved={onSaved}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  }
  return (
    <section
      className={`workspace-card workspace-detail ${section === "invoices" ? "invoice-detail-card" : ""}`}
    >
      <div className="workspace-detail-heading">
        <div>
          <p className="workspace-eyebrow">
            {section === "customers" ? "CLIENT FOLDER" : "RECORD DETAILS"}
          </p>
          <h2>
            {record.name ?? record.invoiceNumber ?? record.description ?? record.customer ?? "Sale"}
          </h2>
        </div>
        <button className="workspace-secondary" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {renderRecordBody()}
    </section>
  );
}
