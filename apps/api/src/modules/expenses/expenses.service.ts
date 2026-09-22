import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { and, desc, eq, sql } from "@nomidat/db";
import { expense, expenseCategory } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateExpenseCategoryDto, CreateExpenseDto, UpdateExpenseDto } from "./dto";

const MAX_LIMIT = 50;

@Injectable()
export class ExpensesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async list(organizationId: string, limit = 20) {
    return this.db.db
      .select({
        id: expense.id,
        categoryId: expense.categoryId,
        category: expenseCategory.name,
        amountKobo: expense.amountKobo,
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
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async get(organizationId: string, expenseId: string) {
    const [item] = await this.db.db
      .select()
      .from(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)))
      .limit(1);

    if (!item) throw new NotFoundException("Expense not found.");
    return item;
  }

  async create(organizationId: string, userId: string | null, input: CreateExpenseDto) {
    const [created] = await this.db.db
      .insert(expense)
      .values({
        organizationId,
        categoryId: await this.resolveCategoryId(input.categoryId),
        amountKobo: input.amountKobo,
        description: input.description,
        spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
        paymentMethod: input.paymentMethod ?? "cash",
        receiptUrl: input.receiptUrl,
        createdByUserId: userId,
      })
      .returning();

    return created;
  }

  async update(organizationId: string, expenseId: string, input: UpdateExpenseDto) {
    await this.get(organizationId, expenseId);
    const { spentAt, categoryId, ...values } = input;
    const resolvedCategoryId = categoryId
      ? await this.resolveCategoryId(categoryId)
      : undefined;

    const [updated] = await this.db.db
      .update(expense)
      .set({
        ...values,
        categoryId: resolvedCategoryId,
        spentAt: spentAt ? new Date(spentAt) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)))
      .returning();

    return updated;
  }


  async remove(organizationId: string, expenseId: string) {
    await this.get(organizationId, expenseId);
    await this.db.db.delete(expense).where(and(eq(expense.id, expenseId), eq(expense.organizationId, organizationId)));
    return { id: expenseId, deleted: true };
  }

  async listCategories() {
    return this.db.db.select().from(expenseCategory).orderBy(expenseCategory.name);
  }

  async createCategory(input: CreateExpenseCategoryDto) {
    return this.insertCategory(this.requireCategoryName(input.name), input.description);
  }

  private requireCategoryName(name: string) {
    const normalized = name.trim();
    if (!normalized) throw new BadRequestException("Category name is required.");
    return normalized;
  }

  private async insertCategory(name: string, description?: string) {
    try {
      const [created] = await this.db.db
        .insert(expenseCategory)
        .values({ name, description: description?.trim() || null, isDefault: false })
        .returning();
      return created;
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) {
        throw new ConflictException("An expense category with this name already exists.");
      }
      throw error;
    }
  }

  private async resolveCategoryId(categoryId?: string) {
    if (!categoryId) return null;

    const [category] = await this.db.db
      .select({ id: expenseCategory.id })
      .from(expenseCategory)
      .where(eq(expenseCategory.id, categoryId))
      .limit(1);

    if (!category) throw new NotFoundException("Expense category not found.");
    return category.id;
  }
}
