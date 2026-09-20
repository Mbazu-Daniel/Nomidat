import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sum } from "@nomidat/db";
import { contact, expense, expenseCategory, order, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class BusinessService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getSales(organizationId: string, limit = DEFAULT_LIMIT) {
    return this.db.db
      .select({
        id: order.id,
        customer: contact.name,
        status: order.status,
        totalKobo: order.totalKobo,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(eq(order.organizationId, organizationId))
      .orderBy(desc(order.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async getCustomers(organizationId: string, limit = DEFAULT_LIMIT) {
    return this.db.db
      .select({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        kind: contact.kind,
        createdAt: contact.createdAt,
      })
      .from(contact)
      .where(eq(contact.organizationId, organizationId))
      .orderBy(desc(contact.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async getProducts(organizationId: string, limit = DEFAULT_LIMIT) {
    return this.db.db
      .select({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
        priceKobo: product.priceKobo,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId))
      .orderBy(desc(product.updatedAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async getSummary(organizationId: string) {
    const [sales, credit, expenses, customers, products, lowStock] = await Promise.all([
      this.db.db.select({ totalKobo: sum(order.totalKobo) }).from(order).where(eq(order.organizationId, organizationId)),
      this.db.db.select({ totalKobo: sum(order.totalKobo) }).from(order).where(and(eq(order.organizationId, organizationId), eq(order.status, "pending"))),
      this.db.db.select({ totalKobo: sum(expense.amountKobo) }).from(expense).where(eq(expense.organizationId, organizationId)),
      this.db.db.select({ count: count() }).from(contact).where(eq(contact.organizationId, organizationId)),
      this.db.db.select({ count: count() }).from(product).where(eq(product.organizationId, organizationId)),
      this.db.db.select({ count: count() }).from(product).where(and(eq(product.organizationId, organizationId), eq(product.stockQuantity, 0))),
    ]);

    return {
      salesTotalKobo: Number(sales[0]?.totalKobo ?? 0),
      outstandingCreditKobo: Number(credit[0]?.totalKobo ?? 0),
      expensesTotalKobo: Number(expenses[0]?.totalKobo ?? 0),
      customerCount: Number(customers[0]?.count ?? 0),
      productCount: Number(products[0]?.count ?? 0),
      lowStockCount: Number(lowStock[0]?.count ?? 0),
    };
  }

  async getExpenses(organizationId: string, limit = DEFAULT_LIMIT) {
    return this.db.db
      .select({
        id: expense.id,
        description: expense.description,
        amountKobo: expense.amountKobo,
        spentAt: expense.spentAt,
        paymentMethod: expense.paymentMethod,
        category: expenseCategory.name,
      })
      .from(expense)
      .leftJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(eq(expense.organizationId, organizationId))
      .orderBy(desc(expense.spentAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }
}
