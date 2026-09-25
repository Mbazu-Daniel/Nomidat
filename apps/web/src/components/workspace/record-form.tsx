import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { FormProps } from "./types";
import { TransactionForm } from "./transaction-form";
import { ProductFields } from "./inventory-fields";
import { ExpenseFields } from "./expenses-fields";

export function RecordForm(props: FormProps) {
  if (props.section === "sales" || props.section === "invoices")
    return <TransactionForm {...props} />;
  return <SimpleRecordForm {...props} />;
}
const fieldComponents = {
  inventory: ProductFields,
  customers: ContactFields,
  expenses: ExpenseFields,
};

function SimpleRecordForm(props: FormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const Fields = fieldComponents[props.section as keyof typeof fieldComponents];
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const { resource, payload } = recordFormDefinition(props.section);
    const body = payload(fields);
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
      <h2>{recordFormDefinition(props.section).title}</h2>
      <fieldset disabled={saving} className="workspace-form-grid">
        <Fields {...props} />
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

function ContactFields() {
  return (
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
  );
}


function inventory(fields: FormData) {
  return {
    name: fields.get("name"),
    sku: fields.get("sku") || undefined,
    description: fields.get("description") || undefined,
    costKobo: Math.round(Number(fields.get("cost")) * 100),
    unit: fields.get("unit"),
    stockQuantity: Number(fields.get("stock")),
    lowStockThreshold: Number(fields.get("threshold")),
    priceKobo: Math.round(Number(fields.get("price")) * 100),
  };
}
function customers(fields: FormData) {
  return {
    name: fields.get("name"),
    phone: fields.get("phone") || undefined,
    email: fields.get("email") || undefined,
    kind: fields.get("kind"),
  };
}
function expenses(fields: FormData) {
  return {
    description: fields.get("description"),
    amountKobo: Math.round(Number(fields.get("amount")) * 100),
    categoryId: fields.get("category") || undefined,
    spentAt: new Date(`${fields.get("date")}T12:00:00+01:00`).toISOString(),
    paymentMethod: fields.get("paymentMethod"),
  };
}

const forms = {
  inventory: { resource: "products", title: "Add a product", payload: inventory },
  customers: { resource: "contacts", title: "Add a contact", payload: customers },
  expenses: { resource: "expenses", title: "Record an expense", payload: expenses },
};
function recordFormDefinition(section: FormProps["section"]) {
  return forms[section as keyof typeof forms];
}
