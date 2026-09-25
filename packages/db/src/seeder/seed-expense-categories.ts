import { createDb } from "../index";
import { expenseCategory } from "../expenses/expense-category";
import { DEFAULT_EXPENSE_CATEGORIES } from "./expense-categories";

export async function seedExpenseCategories(connectionString: string) {
  const db = createDb(connectionString);
  try {
    const values = DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
      name: category.name,
      description: category.description,
      isDefault: true,
    }));
    const inserted = await db
      .insert(expenseCategory)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: expenseCategory.id });
    return { total: values.length, inserted: inserted.length };
  } finally {
    await db.close();
  }
}
