import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { expense, expenseCategory, organization } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExpensesService } from "../src/modules/expenses/expenses.service";

/**
 * Renaming and retiring an expense category.
 *
 * Names are typed by someone in a hurry, so a typo used to be permanent and a
 * category could never be retired. The delete is the case with teeth:
 * `expense.categoryId` references the row with onDelete "set null", so a naive
 * delete succeeds and quietly strips the category off history — expense-by-
 * category reporting changes with no error anywhere. These run against a real
 * database because the behaviour under test is partly the query: the tenant
 * scope that must not match a shared default or another business's row.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("expense categories", () => {
  let db: DatabaseClient;
  let expenses: ExpensesService;
  let orgId: string;
  let rivalOrgId: string;
  /** Shared defaults cascade from no owner, so they are removed by hand. */
  const sharedDefaults: string[] = [];

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    expenses = new ExpensesService(db);

    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `expense-cats-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;

    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    rivalOrgId = rival.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    for (const id of sharedDefaults) {
      await db.delete(expenseCategory).where(eq(expenseCategory.id, id));
    }
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.delete(organization).where(eq(organization.id, rivalOrgId));
    await db.close();
  });

  async function givenACategory(
    name = `Category ${crypto.randomUUID().slice(0, 8)}`,
    ownerId = orgId,
  ) {
    const [row] = await db
      .insert(expenseCategory)
      .values({ organizationId: ownerId, name, isDefault: false })
      .returning();
    return row;
  }

  /** Shared across every tenant, which is why no tenant may edit or retire it. */
  async function givenASharedDefaultCategory() {
    const [row] = await db
      .insert(expenseCategory)
      .values({
        name: `Default ${crypto.randomUUID()}`,
        isDefault: true,
        organizationId: null,
      })
      .returning();
    sharedDefaults.push(row.id);
    return row;
  }

  async function givenAnExpenseUsing(categoryId: string) {
    const [row] = await db
      .insert(expense)
      .values({ organizationId: orgId, categoryId, amountMinor: 1_500 })
      .returning({ id: expense.id });
    return row.id;
  }

  async function storedCategory(categoryId: string) {
    const [row] = await db.select().from(expenseCategory).where(eq(expenseCategory.id, categoryId));
    return row;
  }

  it("renamesACategory", async () => {
    const category = await givenACategory();
    const name = `Renamed ${crypto.randomUUID().slice(0, 8)}`;

    const updated = await expenses.updateCategory(orgId, category.id, { name });

    // The whole point of the route: a mistyped name used to be unfixable.
    expect(updated.name).toBe(name);
    expect(updated.id).toBe(category.id);
    expect(updated.organizationId).toBe(orgId);
  });

  it("keepsTheDescription_whenOnlyTheNameIsSent", async () => {
    const category = await givenACategory();
    await expenses.updateCategory(orgId, category.id, { description: "Fares and fuel" });

    const updated = await expenses.updateCategory(orgId, category.id, {
      name: `Transport ${crypto.randomUUID().slice(0, 8)}`,
    });

    // A partial edit must not blank what it was not asked to change.
    expect(updated.description).toBe("Fares and fuel");
    expect(updated.name.startsWith("Transport ")).toBe(true);
  });

  it("refusesARename_whenAnotherCategoryAlreadyHasThatName", async () => {
    const taken = `Taken ${crypto.randomUUID().slice(0, 8)}`;
    await givenACategory(taken);
    const other = await givenACategory();

    await expect(expenses.updateCategory(orgId, other.id, { name: taken })).rejects.toThrow(
      "An expense category with this name already exists.",
    );

    // And the change did not land either.
    expect((await storedCategory(other.id)).name).toBe(other.name);
  });

  it("refusesARename_thatNamesNothing", async () => {
    const category = await givenACategory();

    // Otherwise an all-space name would store a blank chip in every expense
    // form that offers this category.
    await expect(expenses.updateCategory(orgId, category.id, { name: "   " })).rejects.toThrow(
      "Category name is required.",
    );
    expect((await storedCategory(category.id)).name).toBe(category.name);
  });

  it("refusesToEditASharedDefaultCategory", async () => {
    const shared = await givenASharedDefaultCategory();

    // Defaults belong to every tenant, so a rename here would rename them for
    // everyone — it has to read as "no such category" rather than succeed.
    await expect(
      expenses.updateCategory(orgId, shared.id, { name: `Renamed ${crypto.randomUUID()}` }),
    ).rejects.toThrow("Expense category not found.");
    expect((await storedCategory(shared.id)).name).toBe(shared.name);
  });

  it("refusesToEditACategoryThatBelongsToAnotherBusiness", async () => {
    const theirs = await givenACategory(`Theirs ${crypto.randomUUID().slice(0, 8)}`, rivalOrgId);

    await expect(
      expenses.updateCategory(orgId, theirs.id, { name: `Stolen ${crypto.randomUUID()}` }),
    ).rejects.toThrow("Expense category not found.");

    // And the change did not land either.
    expect((await storedCategory(theirs.id)).name).toBe(theirs.name);
  });

  it("deletesACategoryThatNoExpenseUses", async () => {
    const category = await givenACategory();

    await expect(expenses.removeCategory(orgId, category.id)).resolves.toEqual({
      id: category.id,
      deleted: true,
    });

    expect(await storedCategory(category.id)).toBeUndefined();
  });

  it("refusesToDeleteACategory_whenAnExpenseStillUsesIt", async () => {
    const category = await givenACategory();
    const expenseId = await givenAnExpenseUsing(category.id);

    // The FK would strip the category off history instead of failing, so the
    // report would change with no error anywhere. The caller is told to rename.
    await expect(expenses.removeCategory(orgId, category.id)).rejects.toThrow(
      "This category is used by 1 expense. Rename it instead of deleting it.",
    );

    // Neither the category nor the expense's reference to it moved.
    expect(await storedCategory(category.id)).toBeDefined();
    const [spent] = await db.select().from(expense).where(eq(expense.id, expenseId));
    expect(spent.categoryId).toBe(category.id);
  });

  it("refusesToDeleteACategoryThatBelongsToAnotherBusiness", async () => {
    const theirs = await givenACategory(`Theirs ${crypto.randomUUID().slice(0, 8)}`, rivalOrgId);

    await expect(expenses.removeCategory(orgId, theirs.id)).rejects.toThrow(
      "Expense category not found.",
    );
    expect(await storedCategory(theirs.id)).toBeDefined();
  });
});
