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




function product(action: ParsedAction) {
  if (
    !action.productName ||
    action.stockQuantity === undefined ||
    action.unitPriceNaira === undefined
  )
    return "Please provide the product name, stock quantity and selling price per unit.";
  return null;
}
function sale(action: ParsedAction) {
  if (action.items) return null;
  if (!action.productName || !action.quantity || !action.amountNaira)
    return "Please include the product, quantity and total selling amount.";
  return null;
}
function invoice(action: ParsedAction) {
  if (!action.items || (!action.customerName && !action.contactId))
    return "Please include the customer and invoice items with quantities and unit prices.";
  return null;
}
function contact(action: ParsedAction) {
  if (!action.customerName && !action.contactId) return "Which contact should I use?";
  return null;
}
function note(action: ParsedAction) {
  const missingContact = contact(action);
  if (missingContact) return missingContact;
  return action.description ? null : "What should the note say?";
}
const requirements: Partial<
  Record<ParsedAction["intent"], (action: ParsedAction) => string | null>
> = {
  create_product: product,
  record_sale: sale,
  record_expense: (action) => (action.amountNaira ? null : "How much was the expense?"),
  create_contact: (action) => (action.customerName ? null : "What is the customer's name?"),
  create_invoice: invoice,
  create_payment_link: (action) =>
    action.orderId && action.email ? null : "Please provide the sale ID and customer email.",
  send_invoice: (action) =>
    action.invoiceId && action.email ? null : "Please provide the invoice ID and recipient email.",
  convert_lead_to_customer: contact,
  add_note: note,
};

export function getMissingActionDetails(action: ParsedAction): string | null {
  return requirements[action.intent]?.(action) ?? null;
}
