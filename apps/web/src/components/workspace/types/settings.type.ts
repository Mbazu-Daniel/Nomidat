export type BusinessProfile = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: string | Record<string, unknown> | null;
};
export type ExpenseCategory = {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
};
export type ExpenseDetails = {
  id: string;
  amountKobo: number;
  description: string | null;
  categoryId: string | null;
  spentAt: string;
  paymentMethod: string | null;
  receiptUrl: string | null;
};
export type ReceiptData = {
  receiptNumber: string;
  sale: { customer: string | null; currency: string; createdAt: string; totalKobo: number };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPriceKobo: number;
    totalKobo: number;
  }[];
  payments: {
    id: string;
    amountKobo: number;
    method: string;
    reference?: string | null;
    paidAt: string;
  }[];
  paidKobo: number;
  balanceKobo: number;
};

