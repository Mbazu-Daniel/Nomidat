import { createApiRequest } from "@/lib/api";

export type StorefrontTemplate = "minimal" | "catalog" | "boutique";

export interface StorefrontSettingsOverview {
  slug: string | null;
  name: string | null;
  currency: string;
  published: boolean;
  template: StorefrontTemplate;
  theme: Record<string, unknown>;
  seo: Record<string, unknown>;
  customCss: string | null;
  updatedAt: string;
}

export interface StorefrontDomainRow {
  id: string;
  hostname: string;
  kind: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  /** Already verified domains have no pending record to add. */
  dns?: { name: string; value: string } | null;
}

/**
 * What `POST /verify` answers with. `reason` explains why it is not verified yet,
 * and `dns` tells the seller exactly which record to create.
 */
interface StorefrontDomainVerification {
  verified: boolean;
  recordName?: string;
  reason?: string;
  dns?: { name: string; value: string } | null;
}

export const EMPTY_STOREFRONT_SETTINGS: StorefrontSettingsOverview = {
  slug: null,
  name: null,
  currency: "NGN",
  published: false,
  template: "minimal",
  theme: {},
  seo: {},
  customCss: null,
  updatedAt: "",
};

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export function getStorefrontSettings(organizationId: string) {
  return createApiRequest<StorefrontSettingsOverview>(`${base(organizationId)}/storefront`);
}

export function updateStorefrontSettings(
  organizationId: string,
  patch: Partial<{
    published: boolean;
    template: string;
    theme: Record<string, unknown>;
    customCss: string;
    seo: Record<string, unknown>;
  }>,
) {
  return createApiRequest<StorefrontSettingsOverview>(`${base(organizationId)}/storefront`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getStorefrontDomains(organizationId: string) {
  return createApiRequest<StorefrontDomainRow[]>(`${base(organizationId)}/storefront-domains`);
}

export function addStorefrontDomain(
  organizationId: string,
  input: { hostname: string; kind?: "subdomain" | "custom" },
) {
  return createApiRequest<StorefrontDomainRow & { verificationToken: string }>(
    `${base(organizationId)}/storefront-domains`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function verifyStorefrontDomain(organizationId: string, domainId: string) {
  return createApiRequest<StorefrontDomainVerification>(
    `${base(organizationId)}/storefront-domains/${encodeURIComponent(domainId)}/verify`,
    { method: "POST" },
  );
}
