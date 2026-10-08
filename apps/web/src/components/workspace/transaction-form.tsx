import { useCurrency } from "@/lib/currency-context";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
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
import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import { getOrganizationProducts, type Product } from "@/data/catalog";
import { getOrganizationContacts, type PosContact } from "@/data/pos";
import { useLoadedResource } from "@/lib/use-api-resource";
import type { FormProps, LineItem } from "./types";

export function TransactionForm({
  organizationId,
  section,
  onSaved,
  onCancel,
  pictureItems,
  invoiceDraft,
}: FormProps) {
  const currency = useCurrency();
  const loaded = useLoadedResource(
    async () => {
      const [contacts, products] = await Promise.all([
        getOrganizationContacts(organizationId),
        getOrganizationProducts(organizationId),
      ]);
      return { contacts, products };
    },
    [organizationId],
    { contacts: [] as PosContact[], products: [] as Product[] },
  );
  const contacts = loaded.data.contacts;
  const products = loaded.data.products;
  const [items, setItems] = useState<LineItem[]>(() => initialTransactionItems(pictureItems));
  const [tax, setTax] = useState<number | null>(() => draftMoney(invoiceDraft?.taxNaira));
  const [discount, setDiscount] = useState<number | null>(() =>
    draftMoney(invoiceDraft?.discountNaira),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const total = transactionTotal(items, tax, discount);
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
        // Parsed against the business's own currency: a fixed ×100 would multiply
        // a typed amount by the wrong factor in any currency without hundredths.
        const paymentAmountMinor =
          parseMoneyToMinor(String(data.get("paid") ?? "0"), currency) ?? 0;
        if (paymentAmountMinor > total) {
          setError("Payment cannot exceed the total.");
          return;
        }
        setSaving(true);
        const body = transactionPayload(data, items, section, tax, discount, paymentAmountMinor);
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
      <TransactionHeading section={section} pictureItems={pictureItems} />
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
          Total <strong>{formatMoney(total, currency)}</strong>
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
          {saving ? "Saving…" : submitLabels[section]}
        </button>
      </div>
    </form>
  );
}

function TransactionHeading({
  section,
  pictureItems,
}: Pick<FormProps, "section" | "pictureItems">) {
  return (
    <>
      <h2>{section === "sales" ? "Record a sale" : "Create an invoice"}</h2>
      {pictureItems && (
        <p>
          {section === "invoices"
            ? "Review the customer, line items, due date, tax and discount. This creates a new invoice with a new number and today’s issue date; it does not record a payment."
            : "Review every line, choose inventory products to deduct stock, and check customer, tax, discount and payment. Custom items do not change stock. This sale will use today’s date."}
        </p>
      )}
    </>
  );
}

const submitLabels: Partial<Record<FormProps["section"], string>> = {
  sales: "Save sale",
  invoices: "Save invoice",
};
