import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, lt, sql, sum } from "@nomidat/db";
import {
  contact,
  expense,
  expenseCategory,
  order,
  orderItem,
  payment,
  product,
} from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

export type ReportRange = {
  from: Date;
  to: Date;
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const MAX_LIMIT = 50;

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  getDefaultRange(): ReportRange {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - DEFAULT_DAYS);
    return { from, to };
  }

  parseRange(from?: string, to?: string): ReportRange {
    const fallback = this.getDefaultRange();
    const fromDate = from ? this.parseDate(from, "from") : fallback.from;
    const toDate = to ? this.parseDate(to, "to") : fallback.to;
    this.validateRange(fromDate, toDate);
    return { from: fromDate, to: toDate };
  }

  private validateRange(from: Date, to: Date) {
    if (from >= to) {
      throw new BadRequestException("Report 'from' must be before 'to'.");
    }
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (days > MAX_DAYS) {
      throw new BadRequestException(`Report range cannot exceed ${MAX_DAYS} days.`);
    }
  }

  async getSummary(organizationId: string, range: ReportRange) {
    const [sales, payments, expenses, outstandingCreditKobo] = await Promise.all([
      this.getOrderMetrics(organizationId, range),
      this.getPaymentMetrics(organizationId, range),
      this.getExpenseMetrics(organizationId, range),
      this.getOutstandingCredit(organizationId, range.to),
    ]);

    return {
      from: range.from,
      to: range.to,
      salesKobo: sales.totalKobo,
      collectedKobo: payments.totalKobo,
      outstandingCreditKobo,
      expensesKobo: expenses.totalKobo,
      netCashflowKobo: payments.totalKobo - expenses.totalKobo,
      salesCount: sales.count,
      paymentCount: payments.count,
      expenseCount: expenses.count,
      profitApproxKobo: await this.getProfitApprox(organizationId, range, expenses.totalKobo),
    };
  }

  private async getOrderMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db.db
      .select({ totalKobo: sum(order.totalKobo), count: count() })
      .from(order)
      .where(this.rangeCondition(order.createdAt, order.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private async getPaymentMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db.db
      .select({ totalKobo: sum(payment.amountKobo), count: count() })
      .from(payment)
      .where(this.rangeCondition(payment.paidAt, payment.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private async getExpenseMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db.db
      .select({ totalKobo: sum(expense.amountKobo), count: count() })
      .from(expense)
      .where(this.rangeCondition(expense.spentAt, expense.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private rangeCondition(
    timestamp: typeof order.createdAt,
    organizationColumn: typeof order.organizationId,
    organizationId: string,
    range: ReportRange,
  ) {
    return and(
      eq(organizationColumn, organizationId),
      gte(timestamp, range.from),
      lt(timestamp, range.to),
    );
  }

  private toMetrics(row: { totalKobo?: number | null; count?: number | null } | undefined) {
    return {
      totalKobo: Number(row?.totalKobo ?? 0),
      count: Number(row?.count ?? 0),
    };
  }

  async getSalesTrend(organizationId: string, range: ReportRange) {
    const day = sql<string>`to_char(date_trunc('day', ${order.createdAt}), 'YYYY-MM-DD')`;
    const rows = await this.db.db
      .select({
        date: day,
        salesKobo: sum(order.totalKobo),
        saleCount: count(),
      })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          gte(order.createdAt, range.from),
          lt(order.createdAt, range.to),
        ),
      )
      .groupBy(day)
      .orderBy(day);

    return rows.map((row) => ({
      date: row.date,
      salesKobo: Number(row.salesKobo ?? 0),
      saleCount: Number(row.saleCount ?? 0),
    }));
  }

  async getExpenseBreakdown(organizationId: string, range: ReportRange) {
    const rows = await this.db.db
      .select({
        category: expenseCategory.name,
        amountKobo: sum(expense.amountKobo),
        expenseCount: count(),
      })
      .from(expense)
      .leftJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(
        and(
          eq(expense.organizationId, organizationId),
          gte(expense.spentAt, range.from),
          lt(expense.spentAt, range.to),
        ),
      )
      .groupBy(expenseCategory.name)
      .orderBy(desc(sum(expense.amountKobo)));

    return rows.map((row) => ({
      category: row.category ?? "Uncategorized",
      amountKobo: Number(row.amountKobo ?? 0),
      expenseCount: Number(row.expenseCount ?? 0),
    }));
  }

  async getTopProducts(
    organizationId: string,
    range: ReportRange,
    limit = 10,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const rows = await this.db.db
      .select({
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity: sum(orderItem.quantity),
        salesKobo: sum(orderItem.totalKobo),
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(
        and(
          eq(order.organizationId, organizationId),
          gte(order.createdAt, range.from),
          lt(order.createdAt, range.to),
        ),
      )
      .groupBy(orderItem.productId, orderItem.productName)
      .orderBy(desc(sum(orderItem.totalKobo)))
      .limit(safeLimit);

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName ?? "Unknown product",
      quantity: Number(row.quantity ?? 0),
      salesKobo: Number(row.salesKobo ?? 0),
    }));
  }

  async getCustomerBalances(organizationId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const pendingSales = await this.db.db
      .select({
        saleId: order.id,
        customerId: contact.id,
        customerName: contact.name,
        totalKobo: order.totalKobo,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(contact, eq(order.contactId, contact.id))
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.status, "pending"),
        ),
      )
      .orderBy(desc(order.createdAt));

    const balances = new Map<
      string,
      { customerId: string; customerName: string; balanceKobo: number }
    >();

    for (const sale of pendingSales) {
      const balanceKobo = await this.getSaleBalance(organizationId, sale.saleId, sale.totalKobo);
      this.addCustomerBalance(balances, sale, balanceKobo);
    }

    return [...balances.values()]
      .sort((a, b) => b.balanceKobo - a.balanceKobo)
      .slice(0, safeLimit);
  }

  private async getSaleBalance(organizationId: string, saleId: string, totalKobo: number) {
    const [paid] = await this.db.db
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, saleId)));
    return Math.max(0, totalKobo - Number(paid?.totalKobo ?? 0));
  }

  private addCustomerBalance(
    balances: Map<string, { customerId: string; customerName: string; balanceKobo: number }>,
    sale: { customerId: string; customerName: string },
    balanceKobo: number,
  ) {
    if (balanceKobo === 0) return;
    const current = balances.get(sale.customerId);
    balances.set(sale.customerId, {
      customerId: sale.customerId,
      customerName: sale.customerName,
      balanceKobo: (current?.balanceKobo ?? 0) + balanceKobo,
    });
  }

  async getInventoryHealth(organizationId: string) {
    const [totals, lowStock, inventoryValueKobo] = await Promise.all([
      this.getInventoryTotals(organizationId),
      this.getLowStockProducts(organizationId),
      this.getInventoryValue(organizationId),
    ]);
    return {
      ...totals,
      inventoryValueKobo,
      lowStock,
    };
  }

  private async getInventoryTotals(organizationId: string) {
    const [row] = await this.db.db
      .select({
        productCount: count(),
        lowStockCount: sql<number>`count(*) filter (where ${product.stockQuantity} <= ${product.lowStockThreshold})`,
        outOfStockCount: sql<number>`count(*) filter (where ${product.stockQuantity} <= 0)`,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId));
    return {
      productCount: Number(row?.productCount ?? 0),
      lowStockCount: Number(row?.lowStockCount ?? 0),
      outOfStockCount: Number(row?.outOfStockCount ?? 0),
    };
  }

  private async getLowStockProducts(organizationId: string) {
    return this.db.db
      .select({
        id: product.id,
        name: product.name,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
      })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), sql`${product.stockQuantity} <= ${product.lowStockThreshold}`))
      .orderBy(product.stockQuantity)
      .limit(MAX_LIMIT);
  }

  private async getProfitApprox(
    organizationId: string,
    range: ReportRange,
    expensesKobo: number,
  ): Promise<number> {
    const [margin] = await this.db.db
      .select({
        grossMarginKobo: sql<number>`coalesce(sum(${orderItem.totalKobo} - (${orderItem.quantity} * coalesce(${product.costKobo}, 0))), 0)`,
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .leftJoin(product, eq(orderItem.productId, product.id))
      .where(
        and(
          eq(order.organizationId, organizationId),
          gte(order.createdAt, range.from),
          lt(order.createdAt, range.to),
        ),
      );

    return Number(margin?.grossMarginKobo ?? 0) - expensesKobo;
  }

  private async getInventoryValue(organizationId: string): Promise<number> {
    const [value] = await this.db.db
      .select({
        totalKobo: sql<number>`coalesce(sum(${product.stockQuantity} * ${product.costKobo}), 0)`,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId));

    return Number(value?.totalKobo ?? 0);
  }

  private async getOutstandingCredit(
    organizationId: string,
    asOf: Date,
  ): Promise<number> {
    const pendingSales = await this.db.db
      .select({
        id: order.id,
        totalKobo: order.totalKobo,
      })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.status, "pending"),
          lt(order.createdAt, asOf),
        ),
      );

    let outstandingKobo = 0;
    for (const sale of pendingSales) {
      const [paid] = await this.db.db
        .select({ totalKobo: sum(payment.amountKobo) })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, organizationId),
            eq(payment.orderId, sale.id),
            lt(payment.paidAt, asOf),
          ),
        );

      outstandingKobo += Math.max(
        0,
        sale.totalKobo - Number(paid?.totalKobo ?? 0),
      );
    }

    return outstandingKobo;
  }

  private parseDate(value: string, name: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid report ${name} date.`);
    }
    return date;
  }
}
