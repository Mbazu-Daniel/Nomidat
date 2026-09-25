import {
  TransactionCustomerFields,
  TransactionMoneyFields,
  TransactionPictureTotal,
} from "./transaction-fields";
import {
  initialTransactionItems,
  draftMoney,
  transactionPayload,
  transactionTotal,
  hasIncompleteItems,
} from "./transaction-data";
import { TransactionLineItem } from "./transaction-line-item";
import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { formatNaira } from "@/data/nomidat";
import type { BusinessRecord, FormProps, LineItem } from "./types";

export function TransactionForm({
  organizationId,
  section,
  onSaved,
  onCancel,
  pictureItems,
  invoiceDraft,
}: FormProps) {
  const [contacts, setContacts] = useState<BusinessRecord[]>([]);
  const [products, setProducts] = useState<BusinessRecord[]>([]);
  const [items, setItems] = useState<LineItem[]>(() => initialTransactionItems(pictureItems));
  const [tax, setTax] = useState<number | null>(() => draftMoney(invoiceDraft?.taxNaira));
  const [discount, setDiscount] = useState<number | null>(() =>
    draftMoney(invoiceDraft?.discountNaira),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const total = transactionTotal(items, tax, discount);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      createApiRequest<BusinessRecord[]>(`/organizations/${organizationId}/contacts`),
      createApiRequest<BusinessRecord[]>(`/organizations/${organizationId}/products?limit=50`),
    ])
      .then(([people, stock]) => {
        if (!cancelled) {
          setContacts(people);
          setProducts(stock);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);
  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <form
      className="workspace-form workspace-card"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (total <= 0 || tax === null || discount === null || hasIncompleteItems(items)) {
          setError(
            "Add a description to every item and check that the total is greater than zero.",
          );
          return;
        }
        const data = new FormData(event.currentTarget);
        const paymentAmountKobo = Math.round(Number(data.get("paid") || 0) * 100);
        if (paymentAmountKobo > total) {
          setError("Payment cannot exceed the total.");
          return;
        }
        setSaving(true);
        const body = transactionPayload(data, items, section, tax, discount, paymentAmountKobo);
        try {
          await createApiRequest(`/organizations/${organizationId}/${section}`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          onSaved();
        } catch (reason) {
          setError((reason as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2>{section === "sales" ? "Record a sale" : "Create an invoice"}</h2>
      {pictureItems && (
        <p>
          {section === "invoices"
            ? "Review the customer, line items, due date, tax and discount. This creates a new invoice with a new number and today’s issue date; it does not record a payment."
            : "Review every line, choose inventory products to deduct stock, and check customer, tax, discount and payment. Custom items do not change stock. This sale will use today’s date."}
        </p>
      )}
      <fieldset disabled={saving}>
        <TransactionCustomerFields
          contacts={contacts}
          invoiceDraft={invoiceDraft}
          section={section}
        />

        <div className="workspace-line-items">
          {items.map((item, index) => (
            <TransactionLineItem
              key={item.key}
              item={item}
              index={index}
              products={products}
              fromPicture={Boolean(pictureItems)}
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
                unitPriceKobo: 0,
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
          section={section}
          invoiceDraft={invoiceDraft}
        />

        {invoiceDraft?.totalNaira != null && (
          <TransactionPictureTotal invoiceDraft={invoiceDraft} total={total} />
        )}
        {invoiceDraft && (
          <label className="picture-confirmation">
            <input type="checkbox" required /> I checked the customer, due date and amounts against
            the picture.
          </label>
        )}
        <p className="workspace-total">
          Total <strong>{formatNaira(total / 100)}</strong>
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <div className="workspace-actions">
        <button type="button" className="workspace-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button className="workspace-primary" disabled={saving}>
          {saving ? "Saving…" : "Save " + (section === "sales" ? "sale" : "invoice")}
        </button>
      </div>
    </form>
  );
}
