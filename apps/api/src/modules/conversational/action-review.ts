import { formatMinorAmount, majorToMinor } from "../../common/helpers/money-format";
import type { ParsedAction } from "./types";

/**
 * The confirmation a seller reads before a write happens.
 *
 * Every figure here is one the model was *given* — a typed or spoken whole-unit
 * amount — so it is converted to the business's currency rather than assumed to
 * be naira. What the seller approves in this sentence is what the record then
 * stores, which is the only reason it is worth quoting the amount precisely.
 */
function money(major: number | null | undefined, currency: string): string {
  return major == null ? "unspecified" : formatMinorAmount(majorToMinor(major, currency), currency);
}

function reviewCreateProduct(action: ParsedAction, currency: string): string {
  return `Create a NEW product: ${action.productName}, stock ${action.stockQuantity} ${action.unit ?? "units"}, selling price ${money(action.unitPriceNaira, currency)} per unit. This does not restock an existing product.`;
}

function reviewRecordSale(action: ParsedAction, currency: string): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  if (action.items)
    return `Record sale: ${action.items
      .map(
        (item) =>
          `${item.quantity} × ${item.description} at ${money(item.unitPriceNaira, currency)}`,
      )
      .join(
        "; ",
      )}. Tax ${money(action.taxNaira ?? 0, currency)}, discount ${money(action.discountNaira ?? 0, currency)}. ${action.paid ? "Fully paid" : "Unpaid, no payment recorded"}. ${customer}. Items are recorded as custom items; stock is not deducted.`;
  return `Record ${action.quantity ?? "?"} × ${action.productName ?? "item"} for ${customer}, total ${money(action.amountNaira, currency)}, ${action.paid ? "paid" : "on credit"}.`;
}

function reviewRecordExpense(action: ParsedAction, currency: string): string {
  return `Record an expense of ${money(action.amountNaira, currency)} for ${action.description ?? action.category ?? "business spending"}${action.date ? ` on ${action.date}` : " today"}. Payment: ${action.paymentMethod ?? "cash"}.`;
}

function reviewCreateContact(action: ParsedAction): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Add ${customer} as a customer${action.customerPhone ? ` (${action.customerPhone})` : ""}.`;
}

function reviewCreateInvoice(action: ParsedAction, currency: string): string {
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  return `Create an invoice for ${customer}: ${action.items?.map((item) => `${item.quantity} × ${item.description} at ${money(item.unitPriceNaira, currency)}`).join("; ") ?? "items required"}. Tax: ${money(action.taxNaira ?? 0, currency)}. Discount: ${money(action.discountNaira ?? 0, currency)}.${action.date ? ` Due ${action.date}.` : ""}`;
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

const reviews: Partial<
  Record<ParsedAction["intent"], (action: ParsedAction, currency: string) => string>
> = {
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

export function getActionReview(action: ParsedAction, currency: string): string {
  return reviews[action.intent]?.(action, currency) ?? "Review the requested action.";
}

export { getMissingActionDetails } from "./action-requirements";
