import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { ExpenseCategory } from "./types/settings.type";
export function ExpenseCategories({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<ExpenseCategory[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const path = `/organizations/${organizationId}/expense-categories`;
  useEffect(() => {
    let cancelled = false;
    void createApiRequest<ExpenseCategory[]>(path)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <section className="workspace-card settings-section">
      <h2>Expense categories</h2>
      <p>Organise expenses with categories specific to your business.</p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {saved && <p role="status">{saved}</p>}
      <div className="settings-category-list">
        {rows
          .filter((row) => !row.isDefault)
          .map((row) => (
            <span className="workspace-badge" key={row.id} title={row.description ?? ""}>
              {row.name}
            </span>
          ))}
      </div>
      <details className="staff-role-guide">
        <summary>Default categories ({rows.filter((row) => row.isDefault).length})</summary>
        <div className="settings-category-list">
          {rows
            .filter((row) => row.isDefault)
            .map((row) => (
              <span className="workspace-badge" key={row.id} title={row.description ?? ""}>
                {row.name}
              </span>
            ))}
        </div>
      </details>
      {canWrite && (
        <form
          className="workspace-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError("");
            setSaved("");
            try {
              const created = await createApiRequest<ExpenseCategory>(path, {
                method: "POST",
                body: JSON.stringify({
                  name: String(data.get("name")).trim(),
                  description: String(data.get("description") ?? "").trim() || undefined,
                }),
              });
              setRows((previous) => [...previous, created]);
              form.reset();
              setSaved("Category created. It is available when recording or editing expenses.");
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="workspace-form-grid">
            <label>
              Category name
              <input name="name" required maxLength={100} placeholder="e.g. Shop maintenance" />
            </label>
            <label>
              Description (optional)
              <input name="description" maxLength={300} />
            </label>
          </fieldset>
          <button className="workspace-primary" disabled={busy}>
            {busy ? "Saving…" : "Add category"}
          </button>
        </form>
      )}
    </section>
  );
}
