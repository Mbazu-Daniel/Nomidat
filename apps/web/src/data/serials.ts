import { createApiRequest } from "@/lib/api";

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export type SerialStatus = "in_stock" | "sold" | "returned" | "void";

export interface SerialNumberRow {
  id: string;
  code: string;
  productId: string;
  variantId: string | null;
  status: SerialStatus;
  soldAt: string | null;
  /** The sale that moved this unit. Null until it is sold. */
  orderId: string | null;
}

interface BatchRow {
  id: string;
  code: string;
  productId: string;
  variantId: string | null;
  expiresAt: string | null;
  quantityReceived: number;
  quantityConsumed: number;
  quantityRemaining: number;
}

export interface RegisterSerialsInput {
  productId: string;
  variantId?: string;
  /** One code per physical unit. */
  codes: string[];
  warehouseId?: string;
}

export interface RegisterBatchInput {
  productId: string;
  variantId?: string;
  /** Lot or batch code, unique within the business. */
  code: string;
  quantity: number;
  warehouseId?: string;
  expiresAt?: string;
  notes?: string;
}

/**
 * `status` is omitted rather than sent empty: the API pipes `productId` with
 * ParseUUIDPipe, which turns an empty string into a 400.
 */
export function getSerials(
  organizationId: string,
  filter: { productId?: string; status?: SerialStatus; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (filter.productId) params.set("productId", filter.productId);
  if (filter.status) params.set("status", filter.status);
  if (filter.limit) params.set("limit", String(filter.limit));
  const query = params.toString();
  return createApiRequest<SerialNumberRow[]>(
    `${base(organizationId)}/serial-numbers${query ? `?${query}` : ""}`,
  );
}

/** The units a till may still sell, for one serialised product. */
export function getAvailableSerials(organizationId: string, productId: string) {
  return getSerials(organizationId, { productId, status: "in_stock", limit: 100 });
}

export function registerSerials(organizationId: string, input: RegisterSerialsInput) {
  return createApiRequest<SerialNumberRow[]>(`${base(organizationId)}/serial-numbers`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSerialStatus(
  organizationId: string,
  serialNumberId: string,
  status: SerialStatus,
) {
  return createApiRequest<SerialNumberRow>(
    `${base(organizationId)}/serial-numbers/${encodeURIComponent(serialNumberId)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}

export function getBatches(organizationId: string, productId?: string) {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return createApiRequest<BatchRow[]>(`${base(organizationId)}/batches${query}`);
}

export function registerBatch(organizationId: string, input: RegisterBatchInput) {
  return createApiRequest<BatchRow>(`${base(organizationId)}/batches`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `type` decides why stock is leaving, so the movement ledger reads honestly. */
export function consumeBatch(
  organizationId: string,
  batchId: string,
  quantity: number,
  type: "outbound_ship" | "adjustment_remove" = "outbound_ship",
) {
  return createApiRequest<BatchRow>(
    `${base(organizationId)}/batches/${encodeURIComponent(batchId)}/consume`,
    { method: "POST", body: JSON.stringify({ quantity, type }) },
  );
}
