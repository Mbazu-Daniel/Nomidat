import type { ParsedAction } from "./types";

function reviewCreateProduct(action: ParsedAction): string {
  return `Create a NEW product: ${action.productName}, stock ${action.stockQuantity} ${action.unit ?? "units"}, selling price NGN ${action.unitPriceNaira} per unit. This does not restock an existing product.`;
}

function reviewRecordSale(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  const amount = action.amountNaira?.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
  });
  if (action.items)
    return `Record sale: ${action.items.map((item) => `${item.quantity} × ${item.description} at NGN ${item.unitPriceNaira}`).join("; ")}. Tax NGN ${action.taxNaira ?? 0}, discount NGN ${action.discountNaira ?? 0}. ${action.paid ? "Fully paid" : "Unpaid, no payment recorded"}. ${customer}. Items are recorded as custom items; stock is not deducted.`;
  return `Record ${action.quantity ?? "?"} × ${action.productName ?? "item"} for ${customer}, total ${amount ?? "unspecified"}, ${action.paid ? "paid" : "on credit"}.`;
}

function reviewRecordExpense(action: ParsedAction): string {
  const amount = action.amountNaira?.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
  });
  return `Record an expense of ${amount ?? "unspecified"} for ${action.description ?? action.category ?? "business spending"}${action.date ? ` on ${action.date}` : " today"}. Payment: ${action.paymentMethod ?? "cash"}.`;
}

function reviewCreateContact(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Add ${customer} as a customer${action.customerPhone ? ` (${action.customerPhone})` : ""}.`;
}

function reviewCreateInvoice(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Create an invoice for ${customer}: ${action.items?.map((item) => `${item.quantity} × ${item.description} at NGN ${item.unitPriceNaira}`).join("; ") ?? "items required"}. Tax: NGN ${action.taxNaira ?? 0}. Discount: NGN ${action.discountNaira ?? 0}.${action.date ? ` Due ${action.date}.` : ""}`;
}

function reviewCreatePaymentLink(action: ParsedAction): string {
  return `Create a payment link for sale ${action.orderId ?? "unspecified"}, using ${action.email ?? "an email address"}.`;
}

function reviewSendInvoice(action: ParsedAction): string {
  return `Send invoice ${action.invoiceId ?? "unspecified"} to ${action.email ?? "an email address"}.`;
}

function reviewConvertLeadToCustomer(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Convert ${customer} from a lead to a customer.`;
}

function reviewAddNote(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Add a note for ${customer}: “${action.description ?? ""}”.`;
}

const reviews: Partial<Record<ParsedAction["intent"], (action: ParsedAction) => string>> = {
  create_product: reviewCreateProduct,
  record_sale: reviewRecordSale,
  record_expense: reviewRecordExpense,
  create_contact: reviewCreateContact,
  create_invoice: reviewCreateInvoice,
  create_payment_link: reviewCreatePaymentLink,
  send_invoice: reviewSendInvoice,
  convert_lead_to_customer: reviewConvertLeadToCustomer,
  add_note: reviewAddNote,
};

export function getActionReview(action: ParsedAction): string {
  return reviews[action.intent]?.(action) ?? "Review the requested action.";
}

export { getMissingActionDetails } from "./action-requirements";
