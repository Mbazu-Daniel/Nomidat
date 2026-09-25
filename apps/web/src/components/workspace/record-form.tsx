import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { FormProps } from "./types";
import { TransactionForm } from "./transaction-form";

export function RecordForm(props: FormProps) {
  const draft = props.pictureItems?.[0];
  const expense = props.expenseDraft;
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (props.section !== "expenses") return;
    let cancelled = false;
    void createApiRequest<{ id: string; name: string }[]>(
      `/organizations/${props.organizationId}/expense-categories`,
    )
      .then((rows) => {
        if (!cancelled) {
          setCategories(rows);
          const match = rows.find(
            (row) => row.name.toLowerCase() === expense?.category?.toLowerCase(),
          );
          setCategory(match?.id ?? "");
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [props.organizationId, props.section, expense?.category]);
  if (props.section === "sales" || props.section === "invoices")
    return <TransactionForm {...props} />;
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    let body;
    let resource;
    if (props.section === "inventory") {
      resource = "products";
      body = {
        name: fields.get("name"),
        sku: fields.get("sku") || undefined,
        description: fields.get("description") || undefined,
        costKobo: Math.round(Number(fields.get("cost")) * 100),
        unit: fields.get("unit"),
        stockQuantity: Number(fields.get("stock")),
        lowStockThreshold: Number(fields.get("threshold")),
        priceKobo: Math.round(Number(fields.get("price")) * 100),
      };
    } else if (props.section === "customers") {
      resource = "contacts";
      body = {
        name: fields.get("name"),
        phone: fields.get("phone") || undefined,
        email: fields.get("email") || undefined,
        kind: fields.get("kind"),
      };
    } else {
      resource = "expenses";
      body = {
        description: fields.get("description"),
        amountKobo: Math.round(Number(fields.get("amount")) * 100),
        categoryId: fields.get("category") || undefined,
        spentAt: new Date(`${fields.get("date")}T12:00:00+01:00`).toISOString(),
        paymentMethod: fields.get("paymentMethod"),
      };
    }
    setSaving(true);
    props.onSavingChange?.(true);
    setError("");
    try {
      await createApiRequest(`/organizations/${props.organizationId}/${resource}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      props.onSaved();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
      props.onSavingChange?.(false);
    }
  }
  return (
    <form className="workspace-form workspace-card workspace-record-form" onSubmit={submit}>
      <h2>
        {props.section === "inventory"
          ? "Add a product"
          : props.section === "customers"
            ? "Add a contact"
            : "Record an expense"}
      </h2>
      <fieldset disabled={saving} className="workspace-form-grid">
        {props.section === "inventory" && (
          <>
            <label>
              Product name
              <input
                name="name"
                defaultValue={draft?.name ?? ""}
                required
                maxLength={160}
                placeholder="e.g. Cement, 50 kg"
                autoFocus
              />
            </label>
            <label>
              <span className="workspace-field-heading">
                SKU <small>Optional</small>
              </span>
              <input name="sku" maxLength={80} placeholder="e.g. CEM-50" />
            </label>
            <label>
              Cost price (₦)
              <input
                name="cost"
                type="number"
                min="0"
                max="20000000"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Description <small>Optional</small>
              <input name="description" maxLength={4000} />
            </label>
            <label>
              Selling price (₦)
              <input
                defaultValue={draft?.unitPriceNaira ?? ""}
                name="price"
                type="number"
                min="0"
                max="20000000"
                step="0.01"
                required
              />
            </label>
            <label>
              Unit
              <input name="unit" defaultValue={draft?.unit ?? "units"} required maxLength={40} />
            </label>
            <label>
              Stock on hand
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                defaultValue={draft ? (draft.quantity ?? "") : "0"}
                required
              />
            </label>
            <label>
              Low-stock alert at
              <input name="threshold" type="number" min="0" step="1" defaultValue="5" required />
            </label>
          </>
        )}
        {props.section === "customers" && (
          <>
            <label>
              Full name
              <input name="name" required maxLength={160} autoFocus />
            </label>
            <label>
              Contact type
              <select name="kind">
                <option value="customer">Customer</option>
                <option value="lead">Lead</option>
              </select>
            </label>
            <label>
              <span className="workspace-field-heading">
                Phone <small>Optional</small>
              </span>
              <input name="phone" type="tel" maxLength={40} />
            </label>
            <label>
              <span className="workspace-field-heading">
                Email <small>Optional</small>
              </span>
              <input name="email" type="email" />
            </label>
          </>
        )}
        {props.section === "expenses" && (
          <>
            <label>
              Description
              <input
                name="description"
                defaultValue={expense?.description ?? ""}
                required
                maxLength={500}
                autoFocus
              />
            </label>
            <label>
              Amount (₦)
              <input
                defaultValue={expense?.amountNaira ?? ""}
                name="amount"
                type="number"
                min="0.01"
                max="20000000"
                step="0.01"
                required
              />
            </label>
            <label>
              Category
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {expense?.category && (
              <p className="workspace-wide">
                Suggested category: {expense.category}. Confirm a matching category above.
              </p>
            )}
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={
                  expense
                    ? (expense.date ?? "")
                    : new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Africa/Lagos",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date())
                }
                required
              />
            </label>
            <label>
              Payment method
              <select
                name="paymentMethod"
                defaultValue={expense ? (expense.paymentMethod ?? "") : "cash"}
                required
              >
                {expense && (
                  <option value="" disabled>
                    Choose payment method
                  </option>
                )}
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="card">Card</option>
              </select>
            </label>
          </>
        )}
      </fieldset>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-actions">
        <button
          type="button"
          className="workspace-secondary"
          onClick={props.onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button className="workspace-primary" disabled={saving}>
          {saving ? "Saving…" : "Save record"}
        </button>
      </div>
    </form>
  );
}
