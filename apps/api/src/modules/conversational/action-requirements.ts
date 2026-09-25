import type { ParsedAction } from "./types";

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
