import { createApiRequest } from "@/lib/api";
import type { ReportRange } from "@/components/workspace/types/reports.type";

type ReportSummary = {
  from: string;
  to: string;
  salesKobo: number;
  collectedKobo: number;
  outstandingCreditKobo: number;
  expensesKobo: number;
  netCashflowKobo: number;
  salesCount: number;
  paymentCount: number;
  expenseCount: number;
  profitApproxKobo: number;
};

type SalesReportRow = {
  date: string;
  salesKobo: number;
  saleCount: number;
};

type ExpenseReportRow = {
  category: string;
  amountKobo: number;
  expenseCount: number;
};

type ProductReportRow = {
  productId: string | null;
  productName: string;
  quantity: number;
  salesKobo: number;
};

type CustomerBalanceReportRow = {
  customerId: string;
  customerName: string;
  balanceKobo: number;
};

type InventoryReport = {
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValueKobo: number;
  lowStock: Array<{
    id: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
    unit: string;
  }>;
};

function reportsPath(organizationId: string, resource: string, days?: number | ReportRange) {
  const base = `/organizations/${encodeURIComponent(organizationId)}/reports/${resource}`;
  if (!days) return base;
  const to = typeof days === "number" ? new Date() : new Date(days.to + "T23:59:59.999");
  const from =
    typeof days === "number"
      ? new Date(to.getTime() - days * 86400000)
      : new Date(days.from + "T00:00:00");
  return `${base}?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`;
}

export function getReportSummary(organizationId: string, days?: number | ReportRange) {
  return createApiRequest<ReportSummary>(reportsPath(organizationId, "summary", days));
}

export function getReportSales(organizationId: string, days?: number | ReportRange) {
  return createApiRequest<SalesReportRow[]>(reportsPath(organizationId, "sales", days));
}

export function getReportExpenseBreakdown(organizationId: string, days?: number | ReportRange) {
  return createApiRequest<ExpenseReportRow[]>(reportsPath(organizationId, "expenses", days));
}

export function getReportProducts(organizationId: string, days?: number | ReportRange, limit = 10) {
  return createApiRequest<ProductReportRow[]>(
    reportsPath(organizationId, "products", days) + (days ? "&" : "?") + "limit=" + limit,
  );
}

export function getReportCustomerBalances(organizationId: string, limit = 20) {
  return createApiRequest<CustomerBalanceReportRow[]>(
    reportsPath(organizationId, "customers") + "?limit=" + limit,
  );
}

export function getReportInventory(organizationId: string) {
  return createApiRequest<InventoryReport>(reportsPath(organizationId, "inventory"));
}
