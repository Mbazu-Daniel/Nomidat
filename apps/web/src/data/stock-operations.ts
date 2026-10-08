import { createApiRequest } from "@/lib/api";

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export interface TransferLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CountLineInput {
  productId: string;
  variantId?: string;
  countedQuantity: number;
}

export interface ReturnLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceMinor?: number;
}

export interface PurchaseOrderLineInput {
  productId: string;
  variantId?: string;
  quantityOrdered: number;
  unitCostMinor: number;
}

export interface StockTransfer {
  id: string;
  reference: string;
  status: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
}

export interface CycleCount {
  id: string;
  reference: string;
  status: string;
  warehouseId: string;
  countedAt: string | null;
}

export interface StockReturn {
  id: string;
  reference: string;
  status: string;
  restock: boolean;
  totalMinor: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  status: string;
  supplierId: string | null;
  totalMinor: number;
  expectedAt: string | null;
}

export const getTransfers = (organizationId: string) =>
  createApiRequest<StockTransfer[]>(`${base(organizationId)}/stock-transfers`);

export const createTransfer = (
  organizationId: string,
  input: {
    fromWarehouseId: string;
    toWarehouseId: string;
    items: TransferLineInput[];
    notes?: string;
  },
) =>
  createApiRequest<StockTransfer>(`${base(organizationId)}/stock-transfers`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const dispatchTransfer = (organizationId: string, transferId: string) =>
  createApiRequest<StockTransfer>(
    `${base(organizationId)}/stock-transfers/${encodeURIComponent(transferId)}/dispatch`,
    { method: "POST" },
  );

export const receiveTransfer = (organizationId: string, transferId: string) =>
  createApiRequest<StockTransfer>(
    `${base(organizationId)}/stock-transfers/${encodeURIComponent(transferId)}/receive`,
    { method: "POST" },
  );

export const cancelTransfer = (organizationId: string, transferId: string) =>
  createApiRequest<StockTransfer>(
    `${base(organizationId)}/stock-transfers/${encodeURIComponent(transferId)}/cancel`,
    { method: "POST" },
  );

export const getCycleCounts = (organizationId: string) =>
  createApiRequest<CycleCount[]>(`${base(organizationId)}/cycle-counts`);

export const createCycleCount = (
  organizationId: string,
  input: { warehouseId: string; items: CountLineInput[]; notes?: string },
) =>
  createApiRequest<CycleCount>(`${base(organizationId)}/cycle-counts`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const applyCycleCount = (organizationId: string, cycleCountId: string) =>
  createApiRequest<CycleCount>(
    `${base(organizationId)}/cycle-counts/${encodeURIComponent(cycleCountId)}/apply`,
    { method: "POST" },
  );

export const getReturns = (organizationId: string) =>
  createApiRequest<StockReturn[]>(`${base(organizationId)}/returns`);

export const createReturn = (
  organizationId: string,
  input: {
    orderId?: string;
    contactId?: string;
    items: ReturnLineInput[];
    restock?: boolean;
    reason?: string;
    notes?: string;
  },
) =>
  createApiRequest<StockReturn>(`${base(organizationId)}/returns`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/** The warehouse the goods land in is a query parameter, not a body field. */
export const receiveReturn = (organizationId: string, returnId: string, warehouseId: string) =>
  createApiRequest<StockReturn>(
    `${base(organizationId)}/returns/${encodeURIComponent(returnId)}/receive?warehouseId=${encodeURIComponent(warehouseId)}`,
    { method: "POST" },
  );

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  variantId: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  productName: string;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderLine[];
}

export const getPurchaseOrders = (organizationId: string) =>
  createApiRequest<PurchaseOrder[]>(`${base(organizationId)}/purchase-orders`);

export const getPurchaseOrder = (organizationId: string, purchaseOrderId: string) =>
  createApiRequest<PurchaseOrderDetail>(
    `${base(organizationId)}/purchase-orders/${encodeURIComponent(purchaseOrderId)}`,
  );

export const createPurchaseOrder = (
  organizationId: string,
  input: {
    supplierId?: string;
    warehouseId: string;
    items: PurchaseOrderLineInput[];
    expectedAt?: string;
    notes?: string;
  },
) =>
  createApiRequest<PurchaseOrder>(`${base(organizationId)}/purchase-orders`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/** Receiving states what actually arrived, which may be less than what was ordered. */
export const receivePurchaseOrder = (
  organizationId: string,
  purchaseOrderId: string,
  input: { items: CountLineInput[]; receivedAt?: string },
) =>
  createApiRequest<PurchaseOrder>(
    `${base(organizationId)}/purchase-orders/${encodeURIComponent(purchaseOrderId)}/receive`,
    { method: "POST", body: JSON.stringify(input) },
  );
