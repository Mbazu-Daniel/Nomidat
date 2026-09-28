import type { FormProps, LineItem, BusinessRecord } from "./workspace.type";

export type PictureItem = {
  name: string | null;
  quantity: number | null;
  unitPriceNaira: number | null;
  unit: string | null;
};
export type ExpensePicture = {
  description: string | null;
  amountNaira: number | null;
  date: string | null;
  category: string | null;
  paymentMethod: "cash" | "transfer" | "card" | null;
};
export type InvoicePicture = {
  customerName: string | null;
  dueDate: string | null;
  taxNaira: number | null;
  discountNaira: number | null;
  totalNaira: number | null;
  notes: string | null;
};
export type PictureDraft =
  | { items: PictureItem[]; warnings: string[] }
  | { expense: ExpensePicture | null; warnings: string[] }
  | { items: PictureItem[]; invoice: InvoicePicture; warnings: string[] };
export type PictureImportProps = FormProps & {
  initialFile?: File;
  section: "sales" | "inventory" | "expenses" | "invoices";
};
export type InventoryPictureProps = FormProps & { section: "inventory"; items: PictureItem[] };

export type TransactionLineItemProps = {
  item: LineItem;
  index: number;
  products: BusinessRecord[];
  fromPicture: boolean;
  updateItem: (key: string, patch: Partial<LineItem>) => void;
  canRemove: boolean;
  onRemove: () => void;
};

export type PicturePickerProps = {
  section: PictureImportProps["section"];
  file: File | null;
  busy: boolean;
  setFile(file: File | null): void;
  setError(error: string): void;
};
