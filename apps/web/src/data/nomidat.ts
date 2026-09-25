import { createApiRequest } from "@/lib/api";

export async function getOrganizations() {
  return createApiRequest<Array<{ id: string; name: string }>>("/organizations");
}

export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type BusinessSummary = {
  salesTotalKobo: number;
  outstandingCreditKobo: number;
  expensesTotalKobo: number;
  customerCount: number;
  productCount: number;
  lowStockCount: number;
};

export function getBusinessSummary(organizationId: string) {
  return createApiRequest<BusinessSummary>(
    `/organizations/${encodeURIComponent(organizationId)}/summary`,
  );
}

export {
  getReportSummary,
  getReportSales,
  getReportExpenseBreakdown,
  getReportProducts,
  getReportCustomerBalances,
  getReportInventory,
} from "./reports";
