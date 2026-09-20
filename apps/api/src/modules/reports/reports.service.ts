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

    if (fromDate >= toDate) {
      throw new BadRequestException("Report 'from' must be before 'to'.");
    }

    const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (days > MAX_DAYS) {
      throw new BadRequestException(`Report range cannot exceed ${MAX_DAYS} days.`);
    }

    return { from: fromDate, to: toDate };
  }

  async getSummary(organizationId: string, range: ReportRange) {
    const [sales, payments, expenses, salesCount, paymentCount, expenseCount] =
      await Promise.all([
        this.db.db
          .select({ totalKobo: sum(order.totalKobo) })
          .from(order)
          .where(
            and(
              eq(order.organizationId, organizationId),
              gte(order.createdAt, range.from),
              lt(order.createdAt, range.to),
            ),
          ),
        this.db.db
          .select({ totalKobo: sum(payment.amountKobo) })
          .from(payment)
          .where(
            and(
              eq(payment.organizationId, organizationId),
              gte(payment.paidAt, range.from),
              lt(payment.paidAt, range.to),
            ),
          ),
        this.db.db
          .select({ totalKobo: sum(expense.amountKobo) })
          .from(expense)
          .where(
            and(
              eq(expense.organizationId, organizationId),
              gte(expense.spentAt, range.from),
              lt(expense.spentAt, range.to),
            ),
          ),
        this.db.db
          .select({ count: count() })
          .from(order)
          .where(
            and(
              eq(order.organizationId, organizationId),
              gte(order.createdAt, range.from),
              lt(order.createdAt, range.to),
            ),
          ),
        this.db.db
          .select({ count: count() })
          .from(payment)
          .where(
            and(
              eq(payment.organizationId, organizationId),
              gte(payment.paidAt, range.from),
              lt(payment.paidAt, range.to),
            ),
          ),
        this.db.db
          .select({ count: count() })
          .from(expense)
          .where(
            and(
              eq(expense.organizationId, organizationId),
              gte(expense.spentAt, range.from),
              lt(expense.spentAt, range.to),
            ),
          ),
      ]);

    const outstandingCreditKobo = await this.getOutstandingCredit(
      organizationId,
      range.to,
    );
    const collectedKobo = Number(payments[0]?.totalKobo ?? 0);
    const expenseKobo = Number(expenses[0]?.totalKobo ?? 0);

    return {
      from: range.from,
      to: range.to,
      salesKobo: Number(sales[0]?.totalKobo ?? 0),
      collectedKobo,
      outstandingCreditKobo,
      expensesKobo: expenseKobo,
      netCashflowKobo: collectedKobo - expenseKobo,
      salesCount: Number(salesCount[0]?.count ?? 0),
      paymentCount: Number(paymentCount[0]?.count ?? 0),
      expenseCount: Number(expenseCount[0]?.count ?? 0),
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
      const [paid] = await this.db.db
        .select({ totalKobo: sum(payment.amountKobo) })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, organizationId),
            eq(payment.orderId, sale.saleId),
          ),
        );

      const balanceKobo = Math.max(
        0,
        sale.totalKobo - Number(paid?.totalKobo ?? 0),
      );
      if (balanceKobo === 0) continue;

      const current = balances.get(sale.customerId);
      balances.set(sale.customerId, {
        customerId: sale.customerId,
        customerName: sale.customerName,
        balanceKobo: (current?.balanceKobo ?? 0) + balanceKobo,
      });
    }

    return [...balances.values()]
      .sort((a, b) => b.balanceKobo - a.balanceKobo)
      .slice(0, safeLimit);
  }

  async getInventoryHealth(organizationId: string) {
    const [totals] = await this.db.db
      .select({
        productCount: count(),
        lowStockCount: sql<number>`count(*) filter (where ${product.stockQuantity} <= ${product.lowStockThreshold})`,
        outOfStockCount: sql<number>`count(*) filter (where ${product.stockQuantity} <= 0)`,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId));

    const lowStock = await this.db.db
      .select({
        id: product.id,
        name: product.name,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
      })
      .from(product)
      .where(
        and(
          eq(product.organizationId, organizationId),
          sql`${product.stockQuantity} <= ${product.lowStockThreshold}`,
        ),
      )
      .orderBy(product.stockQuantity)
      .limit(MAX_LIMIT);

    return {
      productCount: Number(totals?.productCount ?? 0),
      lowStockCount: Number(totals?.lowStockCount ?? 0),
      outOfStockCount: Number(totals?.outOfStockCount ?? 0),
      lowStock,
    };
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
