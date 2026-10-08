import type { FormProps, LineItem } from "./types";

/**
 * A picture-extracted amount, in naira, to minor units.
 *
 * The multiply by 100 is deliberate rather than a leftover: the picture schema
 * returns `unitPriceNaira`, so this value is naira by name and the two-decimal
 * scale follows from that field, not from an assumption about the business's
 * currency. Money a seller types goes through `parseMoneyToMinor` instead, which
 * reads the scale from the currency.
 */
export function draftMoney(value: number | null | undefined): number | null {
  return value === null ? null : Math.round((value ?? 0) * 100);
}
export function initialTransactionItems(pictureItems: FormProps["pictureItems"]): LineItem[] {
  if (!pictureItems)
    return [{ key: "first", productId: "", description: "", quantity: 1, unitPriceMinor: 0 }];
  return pictureItems.map((item, index) => ({
    key: String(index),
    productId: "",
    description: item.name ?? "",
    quantity: item.quantity,
    unitPriceMinor: draftMoney(item.unitPriceNaira),
  }));
}

export function transactionPayload(
  data: FormData,
  items: LineItem[],
  section: FormProps["section"],
  tax: number | null,
  discount: number | null,
  paymentAmountMinor: number,
) {
  return {
    customerId: data.get("customer") === "walk-in" ? undefined : data.get("customer") || undefined,
    items: items.map((item) => ({
      productId: item.productId || undefined,
      ...(section === "sales"
        ? { productName: item.description }
        : { description: item.description }),
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
    })),
    taxMinor: tax,
    discountMinor: discount,
    notes: data.get("notes") || undefined,
    ...(section === "sales"
      ? { paymentAmountMinor, paymentMethod: data.get("method") }
      : { dueDate: data.get("due") || undefined }),
  };
}

/** What the seller has typed so far, in minor units. Advisory: the server re-derives it. */
export function transactionTotal(items: LineItem[], tax: number | null, discount: number | null) {
  return (
    items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.unitPriceMinor ?? 0), 0) +
    (tax ?? 0) -
    (discount ?? 0)
  );
}

/** Blocks submit rather than sending a half-typed line the server would reject. */
export function hasIncompleteItems(items: LineItem[]) {
  return items.some(
    (item) => !item.description.trim() || item.quantity === null || item.unitPriceMinor === null,
  );
}
