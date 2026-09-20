export type Sale = {
  id: string;
  customer: string;
  item: string;
  quantity: number;
  amount: number;
  status: "Paid" | "Credit";
  date: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  outstanding: number;
  lastPurchase: string;
};

export type Product = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
};

export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
};

export const businessData = {
  sales: [
    { id: "sale-1", customer: "Chinedu", item: "Cement", quantity: 5, amount: 42500, status: "Credit", date: "Today, 10:42 AM" },
    { id: "sale-2", customer: "Amaka", item: "Iron rods", quantity: 10, amount: 78000, status: "Paid", date: "Today, 9:18 AM" },
    { id: "sale-3", customer: "Emeka", item: "Diesel", quantity: 48, amount: 62400, status: "Paid", date: "Yesterday, 4:30 PM" },
    { id: "sale-4", customer: "Ngozi", item: "Cement", quantity: 8, amount: 68000, status: "Credit", date: "Yesterday, 1:12 PM" },
  ] satisfies Sale[],
  customers: [
    { id: "customer-1", name: "Chinedu", phone: "0803 000 0001", outstanding: 42500, lastPurchase: "Today" },
    { id: "customer-2", name: "Amaka", phone: "0803 000 0002", outstanding: 0, lastPurchase: "Today" },
    { id: "customer-3", name: "Emeka", phone: "0803 000 0003", outstanding: 0, lastPurchase: "Yesterday" },
    { id: "customer-4", name: "Ngozi", phone: "0803 000 0004", outstanding: 68000, lastPurchase: "Yesterday" },
  ] satisfies Customer[],
  products: [
    { id: "product-1", name: "Cement", quantity: 12, unit: "bags", reorderLevel: 20 },
    { id: "product-2", name: "Diesel", quantity: 48, unit: "litres", reorderLevel: 20 },
    { id: "product-3", name: "Iron rods", quantity: 6, unit: "pieces", reorderLevel: 10 },
    { id: "product-4", name: "Paint", quantity: 31, unit: "cans", reorderLevel: 10 },
  ] satisfies Product[],
  expenses: [
    { id: "expense-1", description: "Fuel", category: "Transport", amount: 18000, date: "Today, 8:15 AM" },
    { id: "expense-2", description: "Shop electricity", category: "Utilities", amount: 12500, date: "Yesterday" },
    { id: "expense-3", description: "Packaging", category: "Operations", amount: 8400, date: "Yesterday" },
  ] satisfies Expense[],
} as const;

import { createApiRequest } from "@/lib/api";

export async function getBusinessData<T extends keyof typeof businessData>(
  organizationId: string,
  resource: T,
) {
  const apiResource = resource === "inventory" ? "products" : resource;
  return createApiRequest<Array<{
    id: string;
    name?: string | null;
    customer?: string | null;
    phone?: string | null;
    kind?: string | null;
    status?: string | null;
    totalKobo?: number | null;
    stockQuantity?: number | null;
    lowStockThreshold?: number | null;
    unit?: string | null;
    priceKobo?: number | null;
    description?: string | null;
    amountKobo?: number | null;
    category?: string | null;
    spentAt?: string | null;
    createdAt?: string | null;
  }>>(`/organizations/${encodeURIComponent(organizationId)}/${apiResource}`);
}

export async function getOrganizations() {
  return createApiRequest<Array<{ id: string; name: string }>>("/organizations");
}

export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
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
  return createApiRequest<BusinessSummary>(`/organizations/${encodeURIComponent(organizationId)}/summary`);
}
