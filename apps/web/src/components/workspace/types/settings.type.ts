export type BusinessDetails = {
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  shopNumber?: string;
  registrationNumber?: string;
};
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
export type AccountSession = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    phoneNumber?: string;
    phoneNumberVerified?: boolean;
  };
  session: { id: string };
};
export type LoginSession = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
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

export interface SettingsNavigationProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  hasBusiness: boolean;
  canManage: boolean;
  canWrite: boolean;
  hasAccess: boolean;
}
