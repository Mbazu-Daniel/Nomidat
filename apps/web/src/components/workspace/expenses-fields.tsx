import type { FormProps } from "./types";
import { useState } from "react";
import { getExpenseCategories } from "@/data/expenses";
import { useLoadedResource } from "@/lib/use-api-resource";
import { useCurrency } from "@/lib/currency-context";

export function ExpenseFields(props: FormProps) {
  const expense = props.expenseDraft;
  const currency = useCurrency();
  const loaded = useLoadedResource(
    () => getExpenseCategories(props.organizationId),
    [props.organizationId, props.section],
    [],
  );
  const categories = loaded.data;
  const { error } = loaded;
  // The draft names a category by name; the form needs its id. Derived rather than
  // stored, so choosing a different category does not leave the two out of step.
  const [chosen, setCategory] = useState("");
  const category =
    chosen ||
    categories.find((row) => row.name.toLowerCase() === expense?.category?.toLowerCase())?.id ||
    "";
  return (
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
        Amount ({currency})
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
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
