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

export function transactionPayload(
  data: FormData,
  items: LineItem[],
  section: FormProps["section"],
  tax: number | null,
  discount: number | null,
  paymentAmountKobo: number,
) {
  return {
    customerId: data.get("customer") === "walk-in" ? undefined : data.get("customer") || undefined,
    items: items.map((item) => ({
      productId: item.productId || undefined,
      ...(section === "sales"
        ? { productName: item.description }
        : { description: item.description }),
      quantity: item.quantity,
      unitPriceKobo: item.unitPriceKobo,
    })),
    taxKobo: tax,
    discountKobo: discount,
    notes: data.get("notes") || undefined,
    ...(section === "sales"
      ? { paymentAmountKobo, paymentMethod: data.get("method") }
      : { dueDate: data.get("due") || undefined }),
  };
}

export function transactionTotal(items: LineItem[], tax: number | null, discount: number | null) {
  return (
    items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.unitPriceKobo ?? 0), 0) +
    (tax ?? 0) -
    (discount ?? 0)
  );
}
export function hasIncompleteItems(items: LineItem[]) {
  return items.some(
    (item) => !item.description.trim() || item.quantity === null || item.unitPriceKobo === null,
  );
}
