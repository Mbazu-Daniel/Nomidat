import { createApiRequest } from "@/lib/api";

export type OrganizationSummary = { id: string; name: string; slug?: string };

/**
 * A contact's outstanding balance arrives with the client folder rather than from
 * its own endpoint: both answer "what does this contact owe", and reading two of
 * them would be a second place for that number to disagree with itself.
 */

export async function getOrganizations() {
  return createApiRequest<OrganizationSummary[]>("/organizations");
}

/** Whether a business handle is still free. Rejects when it is taken. */
export async function checkBusinessHandle(slug: string): Promise<boolean> {
  const result = await createApiRequest<{ status: boolean }>("/organizations/check-slug", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  return result.status;
}

export type BusinessSummary = {
  salesTotalMinor: number;
  outstandingCreditMinor: number;
  expensesTotalMinor: number;
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
