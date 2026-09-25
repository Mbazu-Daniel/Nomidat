import type { BusinessRecord, FormProps } from "./workspace.type";
export type TransactionCustomerFieldsProps = Pick<FormProps, "invoiceDraft" | "section"> & {
  contacts: BusinessRecord[];
};
export type TransactionPictureTotalProps = Pick<FormProps, "invoiceDraft"> & { total: number };
export type TransactionMoneyFieldsProps = TransactionPictureTotalProps &
  Pick<FormProps, "section"> & {
    tax: number | null;
    discount: number | null;
    setTax: (value: number | null) => void;
    setDiscount: (value: number | null) => void;
  };
