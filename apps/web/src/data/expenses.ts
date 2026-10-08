import { createApiRequest } from "@/lib/api";

/**
 * Expenses and the categories they are filed under.
 *
 * The organization base path is built once here, as in every other `data/` module,
 * so a component names the thing it wants rather than the URL it lives at.
 */
const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

interface ExpenseCategory {
  id: string;
  name: string;
}

export function getExpenseCategories(organizationId: string) {
  return createApiRequest<ExpenseCategory[]>(`${base(organizationId)}/expense-categories`);
}
