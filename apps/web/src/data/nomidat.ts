import { createApiRequest } from "@/lib/api";
import { uploadToBucket } from "@/lib/upload-to-bucket";

export type OrganizationSummary = { id: string; name: string; slug?: string };

/**
 * A contact's outstanding balance arrives with the client folder rather than from
 * its own endpoint: both answer "what does this contact owe", and reading two of
 * them would be a second place for that number to disagree with itself.
 */

export async function getOrganizations() {
  return createApiRequest<OrganizationSummary[]>("/organizations");
}

/** Whether an organization handle is still free. Rejects when it is taken. */
export async function checkOrganizationHandle(slug: string): Promise<boolean> {
  const result = await createApiRequest<{ status: boolean }>("/organizations/check-slug", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  return result.status;
}

/**
 * Creates an organization, then attaches a logo if one was chosen.
 *
 * Two calls, in this order, because a presigned URL is scoped to an
 * organization: there is none to sign against until the organization exists, so
 * the logo cannot go up first. Saving the key last also means a failed upload
 * leaves no organization pointing at an object that was never written.
 *
 * A logo that fails to upload does not fail the call. The organization now
 * exists, it is a picture, and a picture can be set from settings. Blocking
 * creation on an optional image would be the wrong trade — the caller reports
 * the logo problem and carries on.
 */
export async function createOrganization(
  details: {
    name: string;
    slug: string;
    metadata?: Record<string, unknown>;
    businessDetails?: Record<string, unknown>;
  },
  logo?: Blob | null,
): Promise<{ id: string; logoError?: string }> {
  const created = await createApiRequest<{ id: string; name: string }>("/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: details.name,
      slug: details.slug,
      ...(details.businessDetails ? { businessDetails: details.businessDetails } : {}),
      ...(details.metadata ? { metadata: details.metadata } : {}),
    }),
  });

  if (!logo) return { id: created.id };

  try {
    const { fileKey } = await uploadToBucket(
      created.id,
      logo,
      "organization-logos",
      // A Blob carries no original file name, so the logo is named for what it is
      // rather than for something the seller never named.
      `logo.${logo.type.split("/")[1] ?? "png"}`,
    );
    await createApiRequest(`/organizations/${created.id}/logo`, {
      method: "PATCH",
      body: JSON.stringify({ logoKey: fileKey }),
    });
  } catch (reason) {
    return {
      id: created.id,
      logoError: reason instanceof Error ? reason.message : "Could not upload the logo.",
    };
  }

  return { id: created.id };
}

type OrganizationSummaryCounts = {
  salesTotalMinor: number;
  outstandingCreditMinor: number;
  expensesTotalMinor: number;
  customerCount: number;
  productCount: number;
  lowStockCount: number;
};

export function getOrganizationSummary(organizationId: string) {
  return createApiRequest<OrganizationSummaryCounts>(
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
