import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { ExpenseCategory, ExpenseDetails } from "./types/settings.type";
export function ExpenseEditor({
  path,
  expenseId,
  onSaved,
}: {
  path: string;
  expenseId: string;
  onSaved: () => void;
}) {
  const [expense, setExpense] = useState<ExpenseDetails>();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const resource = `${path}/expenses/${expenseId}`;
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      createApiRequest<ExpenseDetails>(resource),
      createApiRequest<ExpenseCategory[]>(path + "/expense-categories"),
    ])
      .then(([data, rows]) => {
        if (!cancelled) {
          setExpense(data);
          setCategories(rows);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [resource, path]);
  const localDate = (date: string) => {
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  return (
    <>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {!expense ? (
        <p>Loading expense…</p>
      ) : (
        <form
          className="workspace-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await createApiRequest(resource, {
                method: "PATCH",
                body: JSON.stringify({
                  description: data.get("description"),
                  amountKobo: Math.round(Number(data.get("amount")) * 100),
                  categoryId: data.get("category") || undefined,
                  spentAt: new Date(String(data.get("date"))).toISOString(),
                  paymentMethod: data.get("method"),
                  receiptUrl: data.get("receipt") || undefined,
                }),
              });
              onSaved();
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="workspace-form-grid">
            <label>
              Description
              <input
                name="description"
                defaultValue={expense.description ?? ""}
                maxLength={1000}
                required
              />
            </label>
            <label>
              Amount (₦)
              <input
                name="amount"
                type="number"
                min="0.01"
                max="21474836.47"
                step="0.01"
                defaultValue={expense.amountKobo / 100}
                required
              />
            </label>
            <label>
              Category
              <select name="category" defaultValue={expense.categoryId ?? ""}>
                {!expense.categoryId && <option value="">Uncategorised</option>}
                {categories.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date and time
              <input
                name="date"
                type="datetime-local"
                defaultValue={localDate(expense.spentAt)}
                required
              />
            </label>
            <label>
              Payment method
              <select name="method" defaultValue={expense.paymentMethod ?? "cash"}>
                {expense.paymentMethod &&
                  !["cash", "transfer", "card"].includes(expense.paymentMethod) && (
                    <option>{expense.paymentMethod}</option>
                  )}
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="card">Card</option>
              </select>
            </label>
            <label>
              Receipt link (optional)
              <input name="receipt" type="url" defaultValue={expense.receiptUrl ?? ""} />
            </label>
          </fieldset>
          <div className="workspace-actions">
            <button className="workspace-primary" disabled={busy}>
              Save expense
            </button>
            <button
              type="button"
              disabled={busy}
              className="workspace-secondary"
              onClick={() => setRemoving(true)}
            >
              Delete expense
            </button>
          </div>
          {removing && (
            <div className="settings-danger" role="group" aria-label="Confirm expense deletion">
              <p>
                Permanently delete this expense? It will also be removed from reports. This cannot
                be undone.
              </p>
              <div className="workspace-actions">
                <button type="button" disabled={busy} onClick={() => setRemoving(false)}>
                  Keep expense
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await createApiRequest(resource, { method: "DELETE" });
                      onSaved();
                    } catch (reason) {
                      setError((reason as Error).message);
                      setBusy(false);
                    }
                  }}
                >
                  Confirm delete
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </>
  );
}
