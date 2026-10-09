import type { ExpensePicture, InvoicePicture, PictureItem } from "./picture.type";
import type { ChannelIdentity } from "@/lib/types";
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
export type OrganizationRecord = {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  kind?: string;
  isActive?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  priceMinor?: number;
  costMinor?: number;
  sku?: string | null;
  unit?: string;
  customer?: string | null;
  description?: string | null;
  category?: string | null;
  /** Picture for a product, resolved from its stored bucket key. */
  imageUrl?: string | null;
  totalMinor?: number;
  amountMinor?: number;
  balanceMinor?: number;
  paidMinor?: number;
  saleReference?: string;
  saleItems?: { productName: string; quantity: number }[];
  invoiceNumber?: string;
  dueDate?: string | null;
  status?: string;
  createdAt: string;
  spentAt?: string;
};
export type ClientFolder = {
  contact: OrganizationRecord;
  orders: OrganizationRecord[];
  invoices: OrganizationRecord[];
  notes: { id: string; body: string; createdAt: string }[];
  balanceMinor: number;
};
export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  toolName: string | null;
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
export type WorkspaceProps = { section: Section; miniApp?: boolean };
export type LineItem = {
  key: string;
  productId: string;
  description: string;
  quantity: number | null;
  unitPriceMinor: number | null;
};
export type InvoiceDetail = OrganizationRecord & {
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
  /** The API returns it; money on this panel is rendered in the invoice's own currency. */
  currency: string;
  /**
   * Free text on the table, but the API refuses to change an invoice once it is
   * paid, void or cancelled — this panel hides the controls for those.
   */
  status?: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  dueDate: string | null;
  notes: string | null;
  items: {
    id: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
};

export type RecordDetailProps = {
  organizationId: string;
  section: Section;
  record: OrganizationRecord;
  canWrite: boolean;
  onSaved: () => void;
  onClose: () => void;
};
export type SaleDetailProps = {
  path: string;
  record: OrganizationRecord;
  canWrite: boolean;
  onSaved: () => void;
};
export type InvoiceDetailProps = {
  organizationId: string;
  invoiceId: string;
  canWrite: boolean;
  /** Called after a save so the register above can reload its rows. */
  onSaved: () => void;
  /** Called after a delete, so the open detail can close. */
  onClose: () => void;
};

export type ProductEditorProps = {
  organizationId: string;
  record: OrganizationRecord;
  busy: boolean;
  save: (resource: string, body: object, method?: string) => Promise<void>;
  onSaved: () => void;
};

export type InvoiceRegisterProps = {
  organizationId: string;
  rows: OrganizationRecord[];
  onSelect: (row: OrganizationRecord) => void;
};
export type InvoiceDocumentProps = { invoice: InvoiceDetail };

export type ChannelsPanelProps = { organizationId: string; canWrite: boolean };

export type ChannelProviderCardsProps = {
  identities: ChannelIdentity[];
  loading: boolean;
  busy: boolean;
  onConnect: (provider: string) => Promise<void>;
};

export type SalePaymentSummary = {
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
};

export type SalesRegisterProps = {
  rows: OrganizationRecord[];
  onSelect: (row: OrganizationRecord) => void;
};

export interface RecordTableProps {
  section: Exclude<Section, "overview" | "chat" | "settings" | "channels" | "reports">;
  organizationId: string;
  rows: OrganizationRecord[];
  query: string;
  error: string;
  loading: boolean;
  retry(): void;
  onSelect(record: OrganizationRecord): void;
}

export type ChannelLinkInstructionsProps = {
  linkCode: import("@/lib/types").ChannelLinkCode;
  provider: string;
  expired: boolean;
  busy: boolean;
  copied: boolean;
  dismiss(): void;
  copyCode(): Promise<void>;
  createCode(provider: string): Promise<void>;
};
export type RecordToolbarProps = {
  section: RecordTableProps["section"];
  count: number;
  query: string;
  filter: string;
  setQuery(value: string): void;
  setFilter(value: string): void;
};
