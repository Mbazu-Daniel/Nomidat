import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import { getOrganizationProducts, type Product } from "@/data/catalog";
import { useLoadedResource, useSubmit } from "@/lib/use-api-resource";
import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";
import { TransactionLineItem } from "./transaction-line-item";
import { TransactionMoneyFields } from "./transaction-fields";
import { hasIncompleteItems, transactionPayload, transactionTotal } from "./transaction-data";
import type { InvoiceDetail, LineItem } from "./types";

type InvoiceEditFormProps = {
  organizationId: string;
  invoice: InvoiceDetail;
  /** Called once the server has accepted the correction. */
  onSaved: () => void;
  /** Called when the seller decides against correcting it. */
  onCancel: () => void;
};

/**
 * Corrects an invoice that has already been raised: its lines, its tax and
 * discount, its due date and its notes.
 *
 * Owns its own draft rather than the panel owning it, so opening the form starts
 * from what is stored and cancelling simply drops the draft — nothing half-edited
 * can be left behind in the panel that shows the invoice itself.
 */
export function InvoiceEditForm({
  organizationId,
  invoice,
  onSaved,
  onCancel,
}: InvoiceEditFormProps) {
  const currency = useCurrency();
  const [items, setItems] = useState<LineItem[]>(() =>
    invoice.items.map((row, index) => ({
      key: String(index),
      productId: row.productId ?? "",
      description: row.description ?? "",
      quantity: row.quantity,
      unitPriceMinor: row.unitPriceMinor,
    })),
  );
  const [tax, setTax] = useState<number | null>(invoice.taxMinor);
  const [discount, setDiscount] = useState<number | null>(invoice.discountMinor);
  const { busy, error, setError, submit } = useSubmit();
  const path = `/organizations/${organizationId}/invoices/${invoice.id}`;
  const total = transactionTotal(items, tax, discount);

  // Fetched here rather than with the invoice: a seller who only reads an
  // invoice has no reason to pull the whole catalog down.
  const loaded = useLoadedResource(
    () => getOrganizationProducts(organizationId),
    [organizationId],
    [] as Product[],
  );
  const products = loaded.data;

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasIncompleteItems(items) || total <= 0) {
      setError("Add a description to every item and check that the total is greater than zero.");
      return;
    }
    const data = new FormData(event.currentTarget);
    await submit(async () => {
      const body = {
        ...transactionPayload(data, items, "invoices", tax, discount, 0),
        // Sent as numbers rather than as whatever the box held: the server stores
        // a total, so a cleared field has to mean zero rather than "leave it be".
        taxMinor: tax ?? 0,
        discountMinor: discount ?? 0,
        notes: data.get("notes") || null,
        dueDate: data.get("due") || null,
      };
      await createApiRequest(path, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    });
  }

  return (
    <form className="workspace-form" onSubmit={save}>
      <h3 className="invoice-delivery-heading">Correct this invoice</h3>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <div className="workspace-form-grid">
          <label>
            Due date
            <input
              name="due"
              type="date"
              defaultValue={invoice.dueDate ? invoice.dueDate.slice(0, 10) : ""}
            />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} defaultValue={invoice.notes ?? ""} />
          </label>
        </div>
        <div className="workspace-line-items">
          {items.map((item, index) => (
            <TransactionLineItem
              key={item.key}
              item={item}
              index={index}
              products={products}
              fromPicture={false}
              updateItem={updateItem}
              canRemove={items.length > 1}
              onRemove={() => setItems((current) => current.filter((row) => row.key !== item.key))}
            />
          ))}
        </div>
        <button
          type="button"
          className="workspace-secondary"
          disabled={items.length >= 50}
          onClick={() =>
            setItems((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                productId: "",
                description: "",
                quantity: 1,
                unitPriceMinor: 0,
              },
            ])
          }
        >
          + Add another item
        </button>
        <TransactionMoneyFields
          tax={tax}
          setTax={setTax}
          discount={discount}
          setDiscount={setDiscount}
          total={total}
          section="invoices"
        />
        <p className="workspace-total">
          Total <strong>{formatMoney(total, currency)}</strong>
        </p>
      </fieldset>
      <div className="workspace-actions">
        <button type="button" className="workspace-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="workspace-primary" disabled={busy}>
          {busy ? "Saving…" : "Save invoice"}
        </button>
      </div>
    </form>
  );
}
