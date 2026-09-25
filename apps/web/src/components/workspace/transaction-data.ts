import type { FormProps, LineItem } from "./types";

// Missing photo amounts remain blank; manual forms start at zero.
export function draftMoney(value: number | null | undefined): number | null {
  return value === null ? null : Math.round((value ?? 0) * 100);
}
export function initialTransactionItems(pictureItems: FormProps["pictureItems"]): LineItem[] {
  if (!pictureItems)
    return [{ key: "first", productId: "", description: "", quantity: 1, unitPriceKobo: 0 }];
  return pictureItems.map((item, index) => ({
    key: String(index),
    productId: "",
    description: item.name ?? "",
    quantity: item.quantity,
    unitPriceKobo: draftMoney(item.unitPriceNaira),
  }));
}
