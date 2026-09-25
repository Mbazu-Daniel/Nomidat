import { ExpenseEditor } from "./expense-editor";
import { ProductEditor } from "./product-editor";
import { SaleDetail } from "./sale-detail";
import { InvoiceDetailPanel } from "./invoice-detail";
import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { formatNaira } from "@/data/nomidat";
import type { ClientFolder, RecordDetailProps } from "./types";

export function RecordDetail({
  organizationId,
  section,
  record,
  canWrite,
  onSaved,
  onClose,
}: RecordDetailProps) {
  const [folder, setFolder] = useState<ClientFolder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/organizations/${organizationId}`;
  useEffect(() => {
    let cancelled = false;
    if (section === "customers")
      void createApiRequest<ClientFolder>(`${path}/contacts/${record.id}`)
        .then((result) => {
          if (!cancelled) setFolder(result);
        })
        .catch((reason: Error) => {
          if (!cancelled) setError(reason.message);
        });
    return () => {
      cancelled = true;
    };
  }, [path, record.id, section]);
  async function save(resource: string, body: object, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await createApiRequest(path + resource, { method, body: JSON.stringify(body) });
      onSaved();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function renderCustomerFolder() {
    if (!folder) return <p>Loading client folder…</p>;
    return (
      <>
        <p>
          {folder.contact.phone ?? "No phone"} · {folder.contact.email ?? "No email"}
        </p>
        <p className="workspace-total">
          Outstanding balance <strong>{formatNaira(folder.balanceKobo / 100)}</strong>
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
                {formatNaira((row.totalKobo ?? 0) / 100)}{" "}
                <span className="workspace-badge">{row.status}</span>
              </p>
            ))}
          </div>
          <div>
            <h3>Invoices</h3>
            {folder.invoices.length === 0 && <p>No invoices yet.</p>}
            {folder.invoices.map((row) => (
              <p key={row.id}>
                {row.invoiceNumber} · {formatNaira((row.totalKobo ?? 0) / 100)}
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
      {section === "customers" && renderCustomerFolder()}
      {section === "inventory" && (
        <>
          <p>
            {record.stockQuantity} {record.unit} in stock · Alert at {record.lowStockThreshold}
          </p>
          {canWrite && <ProductEditor record={record} busy={busy} save={save} />}
        </>
      )}
      {section === "expenses" &&
        (canWrite ? (
          <ExpenseEditor path={path} expenseId={record.id} onSaved={onSaved} />
        ) : (
          <p>
            {record.description} · {formatNaira((record.amountKobo ?? 0) / 100)}
          </p>
        ))}
      {section === "sales" && (
        <SaleDetail path={path} record={record} canWrite={canWrite} onSaved={onSaved} />
      )}
      {section === "invoices" && (
        <InvoiceDetailPanel
          organizationId={organizationId}
          invoiceId={record.id}
          canWrite={canWrite}
        />
      )}
    </section>
  );
}
