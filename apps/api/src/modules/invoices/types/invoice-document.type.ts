export type InvoiceDocument = {
  businessLogo?: string;
  businessDetails?: {
    address?: string;
    phone?: string;
    email?: string;
    shopNumber?: string;
    registrationNumber?: string;
  };
  invoiceNumber: string;
  createdAt: Date;
  customerEmail?: string | null;
  customer: string | null;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  dueDate: Date | null;
  notes: string | null;
  items: {
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
};
