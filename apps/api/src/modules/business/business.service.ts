import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, lte, sum } from "@nomidat/db";
import { contact, expense, expenseCategory, order, payment, product } from "@nomidat/db/schema";
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
      .limit(this.limit(limit));
  }

  async getCustomers(organizationId: string, limit = DEFAULT_LIMIT) {
    const customers = await this.db.db
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
      .limit(this.limit(limit));

    return Promise.all(
      customers.map(async (customer) => ({
        ...customer,
        outstandingKobo: await this.getOutstandingForCustomer(organizationId, customer.id),
      })),
    );
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
      .limit(this.limit(limit));
  }

  async getSummary(organizationId: string) {
    const [sales, pendingOrders, expenses, customerCount, productCount, lowStockCount] =
      await Promise.all([
        this.getSalesTotal(organizationId),
        this.getPendingOrders(organizationId),
        this.getExpenseTotal(organizationId),
        this.getContactCount(organizationId),
        this.getProductCount(organizationId),
        this.getLowStockCount(organizationId),
      ]);

    return {
      salesTotalKobo: this.firstNumber(sales),
      outstandingCreditKobo: await this.getOutstandingForOrders(organizationId, pendingOrders),
      expensesTotalKobo: this.firstNumber(expenses),
      customerCount: this.firstNumber(customerCount),
      productCount: this.firstNumber(productCount),
      lowStockCount: this.firstNumber(lowStockCount),
    };
  }

  private firstNumber(rows: Array<{ totalKobo?: number | null; count?: number | null }>) {
    const value = rows[0]?.totalKobo ?? rows[0]?.count ?? 0;
    return Number(value);
  }

  private getSalesTotal(organizationId: string) {
    return this.db.db
      .select({ totalKobo: sum(order.totalKobo) })
      .from(order)
      .where(eq(order.organizationId, organizationId));
  }

  private getPendingOrders(organizationId: string) {
    return this.db.db
      .select({ id: order.id, totalKobo: order.totalKobo })
      .from(order)
      .where(and(eq(order.organizationId, organizationId), eq(order.status, "pending")));
  }

  private getExpenseTotal(organizationId: string) {
    return this.db.db
      .select({ totalKobo: sum(expense.amountKobo) })
      .from(expense)
      .where(eq(expense.organizationId, organizationId));
  }

  private getContactCount(organizationId: string) {
    return this.db.db
      .select({ count: count() })
      .from(contact)
      .where(eq(contact.organizationId, organizationId));
  }

  private getProductCount(organizationId: string) {
    return this.db.db
      .select({ count: count() })
      .from(product)
      .where(eq(product.organizationId, organizationId));
  }

  private getLowStockCount(organizationId: string) {
    return this.db.db
      .select({ count: count() })
      .from(product)
      .where(and(
        eq(product.organizationId, organizationId),
        lte(product.stockQuantity, product.lowStockThreshold),
      ));
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
      .limit(this.limit(limit));
  }

  private limit(limit: number) {
    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private async getOutstandingForCustomer(organizationId: string, customerId: string) {
    const pendingSales = await this.db.db
      .select({ id: order.id, totalKobo: order.totalKobo })
      .from(order)
      .where(and(
        eq(order.organizationId, organizationId),
        eq(order.contactId, customerId),
        eq(order.status, "pending"),
      ));

    return this.getOutstandingForOrders(organizationId, pendingSales);
  }

  private async getOutstandingForOrders(
    organizationId: string,
    pendingOrders: Array<{ id: string; totalKobo: number }>,
  ) {
    const balances = await Promise.all(
      pendingOrders.map(async (sale) => sale.totalKobo - await this.getPaidAmount(organizationId, sale.id)),
    );
    return balances.reduce((total, balance) => total + Math.max(0, balance), 0);
  }

  private async getPaidAmount(organizationId: string, saleId: string) {
    const [paid] = await this.db.db
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, saleId)));
    return Number(paid?.totalKobo ?? 0);
  }
}
