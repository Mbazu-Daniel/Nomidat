import { Inject, Injectable } from "@nestjs/common";
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
import type { ReportRange } from "./report-range";

// fallow-ignore-file code-duplication -- report queries intentionally share organization/range predicates and result shaping

const MAX_LIMIT = 50;

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getSummary(organizationId: string, range: ReportRange) {
    const [sales, payments, expenses, outstandingCreditMinor] = await Promise.all([
      this.getOrderMetrics(organizationId, range),
      this.getPaymentMetrics(organizationId, range),
      this.getExpenseMetrics(organizationId, range),
      this.getOutstandingCredit(organizationId, range.to),
    ]);

    return {
      from: range.from,
      to: range.to,
      salesMinor: sales.totalMinor,
      collectedMinor: payments.totalMinor,
      outstandingCreditMinor,
      expensesMinor: expenses.totalMinor,
      netCashflowMinor: payments.totalMinor - expenses.totalMinor,
      salesCount: sales.count,
      paymentCount: payments.count,
      expenseCount: expenses.count,
      profitApproxMinor: await this.getProfitApprox(organizationId, range, expenses.totalMinor),
    };
  }

  private async getOrderMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db
      .select({ totalMinor: sum(order.totalMinor), count: count() })
      .from(order)
      .where(this.rangeCondition(order.createdAt, order.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private async getPaymentMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db
      .select({ totalMinor: sum(payment.amountMinor), count: count() })
      .from(payment)
      .where(this.rangeCondition(payment.paidAt, payment.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private async getExpenseMetrics(organizationId: string, range: ReportRange) {
    const [row] = await this.db
      .select({ totalMinor: sum(expense.amountMinor), count: count() })
      .from(expense)
      .where(this.rangeCondition(expense.spentAt, expense.organizationId, organizationId, range));
    return this.toMetrics(row);
  }

  private rangeCondition(
    timestamp: typeof order.createdAt | typeof payment.paidAt | typeof expense.spentAt,
    organizationColumn:
      | typeof order.organizationId
      | typeof payment.organizationId
      | typeof expense.organizationId,
    organizationId: string,
    range: ReportRange,
  ) {
    return sql`${organizationColumn} = ${organizationId}
      and ${timestamp} >= ${range.from.toISOString()}
      and ${timestamp} < ${range.to.toISOString()}`;
  }

  private toMetrics(
    row: { totalMinor?: string | number | null; count?: number | null } | undefined,
  ) {
    return {
      totalMinor: this.toNumber(row?.totalMinor),
      count: this.toNumber(row?.count),
    };
  }

  private toNumber(value: string | number | null | undefined): number {
    return value === null || value === undefined ? 0 : Number(value);
  }

  async getSalesTrend(organizationId: string, range: ReportRange) {
    const day = sql<string>`to_char(date_trunc('day', ${order.createdAt}), 'YYYY-MM-DD')`;
    const rows = await this.db
      .select({
        date: day,
        salesMinor: sum(order.totalMinor),
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
      salesMinor: Number(row.salesMinor ?? 0),
      saleCount: Number(row.saleCount ?? 0),
    }));
  }

  async getExpenseBreakdown(organizationId: string, range: ReportRange) {
    const rows = await this.db
      .select({
        category: expenseCategory.name,
        amountMinor: sum(expense.amountMinor),
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
      .orderBy(desc(sum(expense.amountMinor)));

    return rows.map((row) => ({
      category: row.category ?? "Uncategorized",
      amountMinor: Number(row.amountMinor ?? 0),
      expenseCount: Number(row.expenseCount ?? 0),
    }));
  }

  async getTopProducts(organizationId: string, range: ReportRange, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const rows = await this.db
      .select({
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity: sum(orderItem.quantity),
        salesMinor: sum(orderItem.totalMinor),
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
      .orderBy(desc(sum(orderItem.totalMinor)))
      .limit(safeLimit);

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName ?? "Unknown product",
      quantity: Number(row.quantity ?? 0),
      salesMinor: Number(row.salesMinor ?? 0),
    }));
  }

  async getCustomerBalances(organizationId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const pendingSales = await this.db
      .select({
        saleId: order.id,
        customerId: contact.id,
        customerName: contact.name,
        totalMinor: order.totalMinor,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(contact, eq(order.contactId, contact.id))
      .where(and(eq(order.organizationId, organizationId), eq(order.status, "pending")))
      .orderBy(desc(order.createdAt));

    const balances = new Map<
      string,
      { customerId: string; customerName: string; balanceMinor: number }
    >();

    for (const sale of pendingSales) {
      const balanceMinor = await this.getSaleBalance(organizationId, sale.saleId, sale.totalMinor);
      this.addCustomerBalance(balances, sale, balanceMinor);
    }

    return [...balances.values()]
      .sort((a, b) => b.balanceMinor - a.balanceMinor)
      .slice(0, safeLimit);
  }

  private async getSaleBalance(organizationId: string, saleId: string, totalMinor: number) {
    const [paid] = await this.db
      .select({ totalMinor: sum(payment.amountMinor) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, saleId)));
    return Math.max(0, totalMinor - Number(paid?.totalMinor ?? 0));
  }

  private addCustomerBalance(
    balances: Map<string, { customerId: string; customerName: string; balanceMinor: number }>,
    sale: { customerId: string; customerName: string },
    balanceMinor: number,
  ) {
    if (balanceMinor === 0) return;
    const current = balances.get(sale.customerId);
    balances.set(sale.customerId, {
      customerId: sale.customerId,
      customerName: sale.customerName,
      balanceMinor: (current?.balanceMinor ?? 0) + balanceMinor,
    });
  }

  private async getProfitApprox(
    organizationId: string,
    range: ReportRange,
    expensesMinor: number,
  ): Promise<number> {
    const [margin] = await this.db
      .select({
        grossMarginMinor: sql<number>`coalesce(sum(${orderItem.totalMinor} - (${orderItem.quantity} * coalesce(${product.costMinor}, 0))), 0)`,
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

    return Number(margin?.grossMarginMinor ?? 0) - expensesMinor;
  }

  private async getOutstandingCredit(organizationId: string, asOf: Date): Promise<number> {
    const pendingSales = await this.db
      .select({
        id: order.id,
        totalMinor: order.totalMinor,
      })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.status, "pending"),
          lt(order.createdAt, asOf),
        ),
      );

    let outstandingMinor = 0;
    for (const sale of pendingSales) {
      const [paid] = await this.db
        .select({ totalMinor: sum(payment.amountMinor) })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, organizationId),
            eq(payment.orderId, sale.id),
            lt(payment.paidAt, asOf),
          ),
        );

      outstandingMinor += Math.max(0, sale.totalMinor - Number(paid?.totalMinor ?? 0));
    }

    return outstandingMinor;
  }
}
