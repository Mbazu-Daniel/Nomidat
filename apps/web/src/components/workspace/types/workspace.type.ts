import type { ExpensePicture, InvoicePicture, PictureItem } from "./picture.type";
export type Section =
  | "overview"
  | "inventory"
  | "customers"
  | "sales"
  | "expenses"
  | "invoices"
  | "chat"
  | "settings"
  | "channels"
  | "reports";
export type BusinessRecord = {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  kind?: string;
  isActive?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  priceKobo?: number;
  costKobo?: number;
  sku?: string | null;
  unit?: string;
  customer?: string | null;
  description?: string | null;
  category?: string | null;
  totalKobo?: number;
  amountKobo?: number;
  balanceKobo?: number;
  paidKobo?: number;
  saleReference?: string;
  saleItems?: { productName: string; quantity: number }[];
  invoiceNumber?: string;
  dueDate?: string | null;
  status?: string;
  createdAt: string;
  spentAt?: string;
};
export type ClientFolder = {
  contact: BusinessRecord;
  orders: BusinessRecord[];
  invoices: BusinessRecord[];
  notes: { id: string; body: string; createdAt: string }[];
  balanceKobo: number;
};
export type FormProps = {
  pictureItems?: PictureItem[];
  expenseDraft?: ExpensePicture;
  invoiceDraft?: InvoicePicture;
  onSavingChange?: (saving: boolean) => void;
  organizationId: string;
  section: Section;
  onSaved: () => void;
  onCancel: () => void;
};
export type LineItem = {
  key: string;
  productId: string;
  description: string;
  quantity: number | null;
  unitPriceKobo: number | null;
};
export type InvoiceDetail = BusinessRecord & {
  businessName?: string;
  businessLogo?: string;
  businessDetails?: {
    address?: string;
    phone?: string;
    email?: string;
    shopNumber?: string;
    registrationNumber?: string;
  };
  customerEmail?: string | null;
  subtotalKobo: number;
  discountKobo: number;
  taxKobo: number;
  dueDate: string | null;
  notes: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPriceKobo: number;
    totalKobo: number;
  }[];
};

export type RecordDetailProps = {
  organizationId: string;
  section: Section;
  record: BusinessRecord;
  canWrite: boolean;
  onSaved: () => void;
  onClose: () => void;
};
export type SaleDetailProps = {
  path: string;
  record: BusinessRecord;
  canWrite: boolean;
  onSaved: () => void;
};
export type InvoiceDetailProps = {
  organizationId: string;
  invoiceId: string;
  canWrite: boolean;
};

export type ProductEditorProps = {
  record: BusinessRecord;
  busy: boolean;
  save: (resource: string, body: object, method?: string) => Promise<void>;
};

export type InvoiceRegisterProps = {
  rows: BusinessRecord[];
  onSelect: (row: BusinessRecord) => void;
};
export type InvoiceDocumentProps = { invoice: InvoiceDetail };

export type SalePaymentSummary = {
  totalKobo: number;
  paidKobo: number;
  balanceKobo: number;
};

export type SalesRegisterProps = {
  rows: BusinessRecord[];
  onSelect: (row: BusinessRecord) => void;
};

export interface RecordTableProps {
  section: Exclude<Section, "overview" | "chat" | "settings" | "channels" | "reports">;
  rows: BusinessRecord[];
  query: string;
  error: string;
  loading: boolean;
  retry(): void;
  onSelect(record: BusinessRecord): void;
}

export type RecordToolbarProps = {
  section: RecordTableProps["section"];
  count: number;
  query: string;
  filter: string;
  setQuery(value: string): void;
  setFilter(value: string): void;
};
