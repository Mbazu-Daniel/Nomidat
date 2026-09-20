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
    const categoryId = await this.resolveCategoryId(input.categoryId, organizationId);
    const [created] = await this.db.db
      .insert(expense)
      .values({
        organizationId,
        categoryId,
        amountKobo: input.amountKobo,
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
    const categoryId = input.categoryId === undefined ? existing.categoryId : await this.resolveCategoryId(input.categoryId, organizationId);

    const [updated] = await this.db.db
      .update(expense)
      .set({
        categoryId,
        amountKobo: input.amountKobo ?? existing.amountKobo,
        description: input.description === undefined ? existing.description : input.description.trim() || null,
        spentAt: input.spentAt ? new Date(input.spentAt) : existing.spentAt,
        paymentMethod:
          input.paymentMethod === undefined ? existing.paymentMethod : input.paymentMethod.trim() || existing.paymentMethod,
        receiptUrl: input.receiptUrl === undefined ? existing.receiptUrl : input.receiptUrl.trim() || null,
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

  async listCategories(organizationId: string) {
    return this.db.db
      .select()
      .from(expenseCategory)
      .where(sql`(${expenseCategory.organizationId} IS NULL OR ${expenseCategory.organizationId} = ${organizationId})`)
      .orderBy(expenseCategory.name);
  }

  async createCategory(organizationId: string, input: CreateExpenseCategoryDto) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Category name is required.");

    try {
      const [created] = await this.db.db
        .insert(expenseCategory)
        .values({ organizationId, name, description: input.description?.trim() || null, isDefault: false })
        .returning();
      return created;
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) {
        throw new ConflictException("An expense category with this name already exists.");
      }
      throw error;
    }
  }

  private async resolveCategoryId(categoryId?: string, organizationId?: string) {
    if (!categoryId) return null;
    if (!organizationId) throw new BadRequestException("Organization is required.");

    const [category] = await this.db.db
      .select({ id: expenseCategory.id })
      .from(expenseCategory)
.where(and(eq(expenseCategory.id, categoryId), sql`(${expenseCategory.organizationId} IS NULL OR ${expenseCategory.organizationId} = ${organizationId})`))
      .limit(1);

    if (!category) throw new NotFoundException("Expense category not found.");
    return category.id;
  }
}
