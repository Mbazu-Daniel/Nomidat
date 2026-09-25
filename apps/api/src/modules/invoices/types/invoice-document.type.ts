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
  subtotalKobo: number;
  discountKobo: number;
  taxKobo: number;
  totalKobo: number;
  dueDate: Date | null;
  notes: string | null;
  items: {
    description: string | null;
    quantity: number;
    unitPriceKobo: number;
    totalKobo: number;
  }[];
};
