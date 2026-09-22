import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, lte, sum } from "@nomidat/db";
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
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const [customers, credit] = await Promise.all([
      this.db.db.select({ id: contact.id, name: contact.name, phone: contact.phone, kind: contact.kind, createdAt: contact.createdAt })
        .from(contact)
        .where(and(eq(contact.organizationId, organizationId), eq(contact.kind, "customer")))
        .orderBy(desc(contact.createdAt))
        .limit(safeLimit),
      this.db.db.select({ customerId: order.contactId, totalKobo: sum(order.totalKobo) })
        .from(order)
        .where(and(eq(order.organizationId, organizationId), eq(order.status, "pending")))
        .groupBy(order.contactId),
    ]);
    const balances = new Map(credit.map((row) => [row.customerId, Number(row.totalKobo ?? 0)]));
    return customers.map((customer) => ({ ...customer, outstandingBalanceKobo: balances.get(customer.id) ?? 0 }));
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
      this.getOrderTotal(organizationId),
      this.getPendingCredit(organizationId),
      this.getExpenseTotal(organizationId),
      this.getContactCount(organizationId),
      this.getProductCount(organizationId),
      this.getLowStockCount(organizationId),
    ]);
    return {
      salesTotalKobo: sales,
      outstandingCreditKobo: credit,
      expensesTotalKobo: expenses,
      customerCount: customers,
      productCount: products,
      lowStockCount: lowStock,
    };
  }

  private async getOrderTotal(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ totalKobo: sum(order.totalKobo) }).from(order).where(eq(order.organizationId, organizationId));
    return Number(row?.totalKobo ?? 0);
  }

  private async getPendingCredit(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ totalKobo: sum(order.totalKobo) }).from(order).where(and(eq(order.organizationId, organizationId), eq(order.status, "pending")));
    return Number(row?.totalKobo ?? 0);
  }

  private async getExpenseTotal(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ totalKobo: sum(expense.amountKobo) }).from(expense).where(eq(expense.organizationId, organizationId));
    return Number(row?.totalKobo ?? 0);
  }

  private async getContactCount(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ count: count() }).from(contact).where(eq(contact.organizationId, organizationId));
    return Number(row?.count ?? 0);
  }

  private async getProductCount(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ count: count() }).from(product).where(eq(product.organizationId, organizationId));
    return Number(row?.count ?? 0);
  }

  private async getLowStockCount(organizationId: string): Promise<number> {
    const [row] = await this.db.db.select({ count: count() }).from(product).where(and(
      eq(product.organizationId, organizationId),
      lte(product.stockQuantity, product.lowStockThreshold),
    ));
    return Number(row?.count ?? 0);
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
