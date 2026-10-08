import { useApiResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { ExpenseCategory } from "./types/settings.type";
export function ExpenseCategories({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const path = `/organizations/${organizationId}/expense-categories`;
  const {
    data: rows,
    setData: setRows,
    error,
    setError,
  } = useApiResource<ExpenseCategory[]>(path, [], 0);
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
          .map((row) =>
            canWrite ? (
              <EditableCategoryRow
                key={row.id}
                row={row}
                path={`${path}/${row.id}`}
                onUpdated={(updated) =>
                  setRows((previous) =>
                    previous.map((item) => (item.id === updated.id ? updated : item)),
                  )
                }
                onDeleted={(id) => setRows((previous) => previous.filter((item) => item.id !== id))}
                onError={setError}
              />
            ) : (
              <span className="workspace-badge" key={row.id} title={row.description ?? ""}>
                {row.name}
              </span>
            ),
          )}
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

/**
 * Rename and retire in place, because a category a business cannot correct
 * becomes two categories — the typo'd one stays listed and a second copy
 * appears beside it in every expense form. Deletion is confirmed here and
 * refused by the API while an expense still points at the row; that refusal
 * comes back through `onError` so the caller sees why nothing disappeared.
 */
function EditableCategoryRow({
  row,
  path,
  onUpdated,
  onDeleted,
  onError,
}: {
  row: ExpenseCategory;
  path: string;
  onUpdated: (row: ExpenseCategory) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    onError("");
    try {
      const updated = await createApiRequest<ExpenseCategory>(path, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (reason) {
      onError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    onError("");
    try {
      await createApiRequest<{ id: string; deleted: boolean }>(path, { method: "DELETE" });
      onDeleted(row.id);
    } catch (reason) {
      onError((reason as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span className="workspace-actions">
        <input
          aria-label={`Rename ${row.name}`}
          value={name}
          maxLength={100}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="workspace-primary"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setName(row.name);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="workspace-actions">
        <span>Delete “{row.name}”?</span>
        <button type="button" disabled={busy} onClick={() => void remove()}>
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className="workspace-actions">
      <span className="workspace-badge" title={row.description ?? ""}>
        {row.name}
      </span>
      <button type="button" disabled={busy} onClick={() => setEditing(true)}>
        Rename
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
        Delete
      </button>
    </span>
  );
}
