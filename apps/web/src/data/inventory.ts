import { createApiRequest } from "@/lib/api";

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  kind: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
}

export interface StockLevel {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  variantId: string | null;
  onHand: number;
  inTransit: number;
}

export interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  previousBalance: number;
  newBalance: number;
  productName: string;
  notes: string | null;
  referenceType: string | null;
  createdAt: string;
}

function page(extra = "") {
  return extra ? `?${extra}` : "";
}

export const getWarehouses = (organizationId: string) =>
  createApiRequest<Warehouse[]>(`${base(organizationId)}/warehouses`);

export const createWarehouse = (organizationId: string, body: Record<string, unknown>) =>
  createApiRequest<Warehouse>(`${base(organizationId)}/warehouses`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateWarehouse = (
  organizationId: string,
  warehouseId: string,
  body: Record<string, unknown>,
) =>
  createApiRequest<Warehouse>(
    `${base(organizationId)}/warehouses/${encodeURIComponent(warehouseId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );

/**
 * `warehouseId` is omitted rather than sent empty when no warehouse is chosen:
 * the API pipes it with ParseUUIDPipe, which rejects an empty string with a 400,
 * so "All warehouses" has to mean the param is absent.
 */
export const getStockLevels = (organizationId: string, warehouseId?: string, offset = 0) =>
  createApiRequest<StockLevel[]>(
    `${base(organizationId)}/stock-levels${page(
      `${warehouseId ? `warehouseId=${encodeURIComponent(warehouseId)}&` : ""}limit=100&offset=${offset}`,
    )}`,
  );

export const getStockMovements = (organizationId: string, offset = 0) =>
  createApiRequest<StockMovement[]>(
    `${base(organizationId)}/stock-movements${page(`limit=100&offset=${offset}`)}`,
  );
