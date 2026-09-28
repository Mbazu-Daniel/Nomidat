import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { FormProps } from "./types";
import { TransactionForm } from "./transaction-form";
import { ProductFields } from "./inventory-fields";
import { ContactFields } from "./customers-fields";
import { ExpenseFields } from "./expenses-fields";
import { recordFormDefinition } from "./record-form-data";

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
