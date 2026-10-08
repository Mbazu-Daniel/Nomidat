import type { PosContact } from "@/data/pos";
import type { FormProps } from "./workspace.type";

export type TransactionCustomerFieldsProps = Pick<FormProps, "invoiceDraft" | "section"> & {
  /** Only what the picker reads: an id to send, and a name to show. */
  contacts: PosContact[];
};
export type TransactionPictureTotalProps = Pick<FormProps, "invoiceDraft"> & { total: number };
export type TransactionMoneyFieldsProps = TransactionPictureTotalProps &
  Pick<FormProps, "section"> & {
    tax: number | null;
    discount: number | null;
    setTax: (value: number | null) => void;
    setDiscount: (value: number | null) => void;
  };
