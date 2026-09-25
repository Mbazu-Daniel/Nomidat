import { BadRequestException } from "@nestjs/common";
import type { PictureDraft } from "../picture-import/types/picture.type";
import type { ParsedAction } from "./types";

function expenseAction(draft: Extract<PictureDraft, { expense: unknown }>): ParsedAction {
  if (!draft.expense)
    throw new BadRequestException("I couldn't read the receipt. Please send a clearer photo.");
  const item = draft.expense;
  return {
    intent: "record_expense",
    amountNaira: item.amountNaira ?? undefined,
    description: item.description ?? undefined,
    date: item.date ?? undefined,
    category: item.category ?? undefined,
    paymentMethod: item.paymentMethod ?? undefined,
  };
}
function productAction(draft: Extract<PictureDraft, { items: unknown }>): ParsedAction {
  if (draft.items.length !== 1)
    throw new BadRequestException(
      "For inventory, send one product at a time with its quantity and selling price in the picture.",
    );
  const item = draft.items[0];
  return {
    intent: "create_product",
    productName: item.name ?? undefined,
    stockQuantity: item.quantity ?? undefined,
    unitPriceNaira: item.unitPriceNaira ?? undefined,
    unit: item.unit ?? undefined,
  };
}
function transactionItems(draft: Extract<PictureDraft, { items: unknown }>) {
  if (!draft.items.every((item) => item.name && item.quantity && item.unitPriceNaira !== null))
    return undefined;
  return draft.items.map((item) => ({
    description: item.name!,
    quantity: item.quantity!,
    unitPriceNaira: item.unitPriceNaira!,
  }));
}
function invoiceAction(draft: Extract<PictureDraft, { invoice: unknown }>): ParsedAction {
  return {
    intent: "create_invoice",
    items: transactionItems(draft),
    customerName: draft.invoice.customerName ?? undefined,
    date: draft.invoice.dueDate ?? undefined,
    taxNaira: draft.invoice.taxNaira ?? undefined,
    discountNaira: draft.invoice.discountNaira ?? undefined,
  };
}
export function pictureAction(draft: PictureDraft, purpose: string): ParsedAction {
  if ("expense" in draft) return expenseAction(draft);
  if (!draft.items.length)
    throw new BadRequestException("I couldn't read any items. Please send a clearer photo.");
  if (draft.items.length > 10)
    throw new BadRequestException(
      "Please send up to 10 line items per picture so the full review fits in this chat.",
    );
  if (purpose === "inventory") return productAction(draft);
  if ("invoice" in draft) return invoiceAction(draft);
  return { intent: "record_sale", items: transactionItems(draft), paid: false };
}
