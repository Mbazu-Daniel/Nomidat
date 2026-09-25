import { initialTransactionItems, draftMoney } from "./transaction-data";
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
  const total =
    items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.unitPriceKobo ?? 0), 0) +
    (tax ?? 0) -
    (discount ?? 0);
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
  function renderMoneyFields() {
    return (
      <div className="workspace-form-grid">
        <label>
          Tax (₦)
          <input
            type="number"
            min="0"
            step="0.01"
            value={tax === null ? "" : tax / 100}
            required
            placeholder="Enter 0 if none"
            onChange={(event) =>
              setTax(
                event.target.value === "" ? null : Math.round(Number(event.target.value) * 100),
              )
            }
          />
        </label>
        <label>
          Discount (₦)
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount === null ? "" : discount / 100}
            required
            placeholder="Enter 0 if none"
            onChange={(event) =>
              setDiscount(
                event.target.value === "" ? null : Math.round(Number(event.target.value) * 100),
              )
            }
          />
        </label>
        {section === "sales" && (
          <>
            <label>
              Amount collected (₦)
              <input
                name="paid"
                type="number"
                min="0"
                max={Math.max(0, total / 100)}
                step="0.01"
                defaultValue="0"
                required
              />
              <small>Leave at zero for a credit sale.</small>
            </label>
            <label>
              Payment method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="card">Card</option>
              </select>
            </label>
          </>
        )}
        <label className="workspace-wide">
          Notes
          <textarea
            name="notes"
            maxLength={2000}
            rows={2}
            defaultValue={invoiceDraft?.notes ?? ""}
          />
        </label>
      </div>
    );
  }
  return (
    <form
      className="workspace-form workspace-card"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (
          total <= 0 ||
          tax === null ||
          discount === null ||
          items.some(
            (item) =>
              !item.description.trim() || item.quantity === null || item.unitPriceKobo === null,
          )
        ) {
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
        const body = {
          customerId:
            data.get("customer") === "walk-in" ? undefined : data.get("customer") || undefined,
          items: items.map((item) => ({
            productId: item.productId || undefined,
            ...(section === "sales"
              ? { productName: item.description }
              : { description: item.description }),
            quantity: item.quantity,
            unitPriceKobo: item.unitPriceKobo,
          })),
          taxKobo: tax,
          discountKobo: discount,
          notes: data.get("notes") || undefined,
          ...(section === "sales"
            ? { paymentAmountKobo, paymentMethod: data.get("method") }
            : { dueDate: data.get("due") || undefined }),
        };
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
        <div className="workspace-form-grid">
          <label>
            Customer
            <select name="customer" defaultValue="" required={Boolean(invoiceDraft)}>
              {invoiceDraft && (
                <option value="" disabled>
                  Choose customer
                </option>
              )}
              <option value={invoiceDraft ? "walk-in" : ""}>Walk-in customer</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
            {invoiceDraft?.customerName && (
              <small>
                Read from picture: {invoiceDraft.customerName}. Select the correct contact.
              </small>
            )}
          </label>
          {section === "invoices" && (
            <label>
              Due date
              <input name="due" type="date" defaultValue={invoiceDraft?.dueDate ?? ""} />
            </label>
          )}
        </div>
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
        {renderMoneyFields()}

        {invoiceDraft?.totalNaira != null && (
          <p>
            Picture total: <strong>{formatNaira(invoiceDraft.totalNaira)}</strong>
            {Math.round(invoiceDraft.totalNaira * 100) !== total &&
              " · This differs from the draft total. Check line items, tax and discount."}
          </p>
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
