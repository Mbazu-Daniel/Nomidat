import { createApiRequest } from "@/lib/api";

interface PlatformOverview {
  organizationCount: number;
  userCount: number;
  orderCount: number;
  /** Volume per currency. Never summed across currencies: that would be meaningless money. */
  collectedByCurrency: { currency: string; totalMinor: number }[];
  totalCollectedMinor: number;
  recentOrganizations: string[];
}

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string | null;
  currency: string;
  createdAt: string;
}

export interface PlatformOrganizationActivity {
  organizationId: string;
  name: string | null;
  slug: string | null;
  orderCount: number;
  paymentCount: number;
}

/**
 * Platform routes are not organization-scoped, so they sit at their own base.
 * Access is decided by the API from the caller's email; there is no client-side
 * check to keep in step with it.
 */
const BASE = "/platform";

export function getPlatformOverview() {
  return createApiRequest<PlatformOverview>(`${BASE}/overview`);
}

export function getPlatformOrganizations() {
  return createApiRequest<PlatformOrganization[]>(`${BASE}/organizations`);
}

export function getPlatformOrganizationActivity(organizationId: string) {
  return createApiRequest<PlatformOrganizationActivity>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}/activity`,
  );
}
