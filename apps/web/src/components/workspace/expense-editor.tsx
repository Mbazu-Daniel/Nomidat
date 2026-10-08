import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import { useLoadedResource, useSubmit } from "@/lib/use-api-resource";
import { minorToDecimalInput, parseMoneyToMinor } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";
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
  const [removing, setRemoving] = useState(false);
  const resource = `${path}/expenses/${expenseId}`;
  // Read from the business rather than assumed, so the amount and its currency
  // cannot disagree: an amount in dollars shown with a naira sign is worse than an
  // ugly one.
  const currency = useCurrency();
  const loaded = useLoadedResource(
    async () => {
      const [expense, categories] = await Promise.all([
        createApiRequest<ExpenseDetails>(resource),
        createApiRequest<ExpenseCategory[]>(path + "/expense-categories"),
      ]);
      return { expense, categories };
    },
    [resource, path],
    { expense: undefined, categories: [] } as {
      expense: ExpenseDetails | undefined;
      categories: ExpenseCategory[];
    },
  );
  const expense = loaded.data.expense;
  const categories = loaded.data.categories;
  const { busy, error, setError, submit } = useSubmit();
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
            // Parsed against the business's own minor-unit scale rather than a
            // fixed x100, and refused when it is not a number at all — otherwise
            // NaN would be sent as the amount and the server would have to decide
            // what that means.
            const amountMinor = parseMoneyToMinor(String(data.get("amount")), currency);
            if (amountMinor === null) {
              setError("Enter an amount.");
              return;
            }
            await submit(async () => {
              await createApiRequest(resource, {
                method: "PATCH",
                body: JSON.stringify({
                  description: data.get("description"),
                  amountMinor,
                  categoryId: data.get("category") || undefined,
                  spentAt: new Date(String(data.get("date"))).toISOString(),
                  paymentMethod: data.get("method"),
                  receiptUrl: data.get("receipt") || undefined,
                }),
              });
              onSaved();
            });
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
              Amount ({currency})
              <input
                name="amount"
                type="number"
                min="0.01"
                max="21474836.47"
                step="0.01"
                defaultValue={minorToDecimalInput(expense.amountMinor, currency)}
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
                    await submit(async () => {
                      await createApiRequest(resource, { method: "DELETE" });
                      onSaved();
                    });
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
