import { createApiRequest } from "@/lib/api";

export interface PosCatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  priceMinor: number;
  stockQuantity: number;
  unit: string;
  /** Present when this row is one variant of a product rather than the product itself. */
  variantId: string | null;
  variantName: string | null;
  /** The product is tracked unit by unit, so a serial must be named to sell it. */
  isSerialized: boolean;
}

export interface PosSaleLineInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  /** The exact units sold, for a serialised product. */
  serialNumberIds?: string[];
}

export interface CreatePosSaleInput {
  items: PosSaleLineInput[];
  customerId?: string;
  discountMinor?: number;
  tenderedMinor?: number;
  paymentMethod?: "cash" | "bank_transfer" | "card";
  paymentReference?: string;
  notes?: string;
  clientReference?: string;
}

export interface PosSaleResult {
  id: string;
  orderNumber?: string;
  status: string;
  totalMinor: number;
  posTotals: { subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number };
  changeMinor: number;
}

export function getPosCatalog(organizationId: string) {
  return createApiRequest<PosCatalogProduct[]>(
    `/organizations/${encodeURIComponent(organizationId)}/pos/catalog`,
  );
}

export function createPosSale(organizationId: string, input: CreatePosSaleInput) {
  return createApiRequest<PosSaleResult>(
    `/organizations/${encodeURIComponent(organizationId)}/pos/sales`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** One page of contacts, matching the API's own maximum page size. */
const CONTACT_PAGE_SIZE = 100;

export interface PosContact {
  id: string;
  name: string;
  phone?: string | null;
}

/**
 * Every contact the till can attach a sale to.
 *
 * Pages until the API returns a short page rather than stopping at the first
 * one. A shop with more customers than fit in a single page could otherwise not
 * select one of them from the till at all, which is not a truncation you can
 * explain to a seller mid-queue.
 */
export async function getOrganizationContacts(organizationId: string): Promise<PosContact[]> {
  const base = `/organizations/${encodeURIComponent(organizationId)}/contacts`;
  const all: PosContact[] = [];

  for (let offset = 0; ; offset += CONTACT_PAGE_SIZE) {
    const page = await createApiRequest<PosContact[]>(
      `${base}?limit=${CONTACT_PAGE_SIZE}&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < CONTACT_PAGE_SIZE) return all;
  }
}