import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { and, count, desc, eq, or, isNull } from "@nomidat/db";
import { expense, expenseCategory } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
} from "./dto";

const MAX_LIMIT = 50;

/**
 * Whether Postgres refused the write on a unique index (SQLSTATE 23505).
 *
 * Drizzle wraps the driver's error, so the "duplicate key" text and the code
 * live on `cause` while `error.message` is just the failed SQL — matching the
 * message alone reported every name collision as a 500 instead of the 409 a
 * caller can act on.
 */
const isUniqueViolation = (error: unknown): boolean =>
  (error as { cause?: { code?: string } } | null)?.cause?.code === "23505";

@Injectable()
export class ExpensesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async list(organizationId: string, limit = 20, offset = 0) {
    return this.db
      .select({
        id: expense.id,
        categoryId: expense.categoryId,
        category: expenseCategory.name,
        amountMinor: expense.amountMinor,
        description: expense.description,
        spentAt: expense.spentAt,
        paymentMethod: expense.paymentMethod,
        receiptUrl: expense.receiptUrl,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
      })
      .from(expense)
      .leftJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(eq(expense.organizationId, organizationId))
      .orderBy(desc(expense.spentAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));
  }

  async get(organizationId: string, expenseId: string) {
    const [item] = await this.db
      .select()
      .from(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)))
      .limit(1);

    if (!item) throw new NotFoundException("Expense not found.");
    return item;
  }

  async create(organizationId: string, userId: string | null, input: CreateExpenseDto) {
    const [created] = await this.db
      .insert(expense)
      .values({
        organizationId,
        categoryId: await this.resolveCategoryId(organizationId, input.categoryId),
        amountMinor: input.amountMinor,
        description: input.description?.trim() || null,
        spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
        paymentMethod: input.paymentMethod?.trim() || "cash",
        receiptUrl: input.receiptUrl?.trim() || null,
        createdByUserId: userId,
      })
      .returning();

    return created;
  }

  async update(organizationId: string, expenseId: string, input: UpdateExpenseDto) {
    const existing = await this.get(organizationId, expenseId);
    const categoryId = input.categoryId
      ? await this.resolveCategoryId(organizationId, input.categoryId)
      : existing.categoryId;

    const [updated] = await this.db
      .update(expense)
      .set({
        categoryId,
        amountMinor: input.amountMinor ?? existing.amountMinor,
        description: input.description?.trim() || existing.description,
        spentAt: input.spentAt ? new Date(input.spentAt) : existing.spentAt,
        paymentMethod: input.paymentMethod?.trim() || existing.paymentMethod,
        receiptUrl: input.receiptUrl?.trim() || existing.receiptUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async remove(organizationId: string, expenseId: string) {
    await this.get(organizationId, expenseId);
    await this.db
      .delete(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)));
    return { id: expenseId, deleted: true };
  }

  async getCategories(organizationId: string) {
    return this.db
      .select()
      .from(expenseCategory)
      .where(
        or(
          eq(expenseCategory.organizationId, organizationId),
          and(isNull(expenseCategory.organizationId), eq(expenseCategory.isDefault, true)),
        ),
      )
      .orderBy(expenseCategory.name);
  }

  async createCategory(organizationId: string, input: CreateExpenseCategoryDto) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Category name is required.");

    try {
      const [created] = await this.db
        .insert(expenseCategory)
        .values({
          organizationId,
          name,
          description: input.description?.trim() || null,
          isDefault: false,
        })
        .returning();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An expense category with this name already exists.");
      }
      throw error;
    }
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    input: UpdateExpenseCategoryDto,
  ) {
    const existing = await this.getCategory(organizationId, categoryId);
    const name = input.name?.trim() ?? existing.name;
    if (!name) throw new BadRequestException("Category name is required.");

    try {
      const [updated] = await this.db
        .update(expenseCategory)
        .set({
          name,
          description:
            input.description === undefined
              ? existing.description
              : input.description?.trim() || null,
        })
        .where(
          and(
            eq(expenseCategory.id, categoryId),
            eq(expenseCategory.organizationId, organizationId),
          ),
        )
        .returning();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An expense category with this name already exists.");
      }
      throw error;
    }
  }

  async removeCategory(organizationId: string, categoryId: string) {
    await this.getCategory(organizationId, categoryId);

    // `expense.categoryId` references this row with onDelete "set null", so the
    // delete itself would succeed and quietly strip the category off history —
    // expense-by-category reporting would change with no error anywhere. Refuse
    // while anything still points here and send the caller to rename instead.
    const [used] = await this.db
      .select({ value: count() })
      .from(expense)
      .where(eq(expense.categoryId, categoryId));

    if (used.value > 0) {
      throw new ConflictException(
        `This category is used by ${used.value} expense${used.value === 1 ? "" : "s"}. ` +
          "Rename it instead of deleting it.",
      );
    }

    await this.db
      .delete(expenseCategory)
      .where(
        and(eq(expenseCategory.id, categoryId), eq(expenseCategory.organizationId, organizationId)),
      );

    return { id: categoryId, deleted: true };
  }

  /**
   * A category this organization owns, or a 404.
   *
   * The organization scope is what keeps the shared defaults safe: their
   * `organizationId` is NULL, and NULL never equals the caller's id, so the
   * rows every tenant reads are also the rows no tenant may rename or retire.
   * The same clause keeps one business out of another's rows.
   */
  private async getCategory(organizationId: string, categoryId: string) {
    const [category] = await this.db
      .select()
      .from(expenseCategory)
      .where(
        and(eq(expenseCategory.id, categoryId), eq(expenseCategory.organizationId, organizationId)),
      )
      .limit(1);

    if (!category) throw new NotFoundException("Expense category not found.");
    return category;
  }

  private async resolveCategoryId(organizationId: string, categoryId?: string) {
    if (!categoryId) return null;

    const [category] = await this.db
      .select({ id: expenseCategory.id })
      .from(expenseCategory)
      .where(
        and(
          eq(expenseCategory.id, categoryId),
          or(
            eq(expenseCategory.organizationId, organizationId),
            and(isNull(expenseCategory.organizationId), eq(expenseCategory.isDefault, true)),
          ),
        ),
      )
      .limit(1);

    if (!category) throw new NotFoundException("Expense category not found.");
    return category.id;
  }
}
