import type { ReactNode } from "react";
import type {
  getReportSummary,
  getReportSales,
  getReportExpenseBreakdown,
  getReportProducts,
  getReportCustomerBalances,
  getReportInventory,
} from "@/data/nomidat";
export type ReportsData = {
  summary: Awaited<ReturnType<typeof getReportSummary>>;
  sales: Awaited<ReturnType<typeof getReportSales>>;
  expenses: Awaited<ReturnType<typeof getReportExpenseBreakdown>>;
  products: Awaited<ReturnType<typeof getReportProducts>>;
  customers: Awaited<ReturnType<typeof getReportCustomerBalances>>;
  inventory: Awaited<ReturnType<typeof getReportInventory>>;
};
export type ReportsPanelProps = { organizationId: string };
export type ReportCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
};

export type ReportRange = { from: string; to: string };
