import type { ParsedAction } from "./types";

export function getActionReview(action: ParsedAction): string {
  const amount = action.amountNaira?.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
  });
  const customer = action.customerName ?? action.contactId ?? "walk-in customer";
  switch (action.intent) {
    case "create_product":
      return `Create a NEW product: ${action.productName}, stock ${action.stockQuantity} ${action.unit ?? "units"}, selling price NGN ${action.unitPriceNaira} per unit. This does not restock an existing product.`;
    case "record_sale":
      if (action.items)
        return `Record sale: ${action.items.map((item) => `${item.quantity} × ${item.description} at NGN ${item.unitPriceNaira}`).join("; ")}. Tax NGN ${action.taxNaira ?? 0}, discount NGN ${action.discountNaira ?? 0}. ${action.paid ? "Fully paid" : "Unpaid, no payment recorded"}. ${customer}. Items are recorded as custom items; stock is not deducted.`;
      return `Record ${action.quantity ?? "?"} × ${action.productName ?? "item"} for ${customer}, total ${amount ?? "unspecified"}, ${action.paid ? "paid" : "on credit"}.`;
    case "record_expense":
      return `Record an expense of ${amount ?? "unspecified"} for ${action.description ?? action.category ?? "business spending"}${action.date ? ` on ${action.date}` : " today"}. Payment: ${action.paymentMethod ?? "cash"}.`;
    case "create_contact":
      return `Add ${customer} as a customer${action.customerPhone ? ` (${action.customerPhone})` : ""}.`;
    case "create_invoice":
      return `Create an invoice for ${customer}: ${action.items?.map((item) => `${item.quantity} × ${item.description} at NGN ${item.unitPriceNaira}`).join("; ") ?? "items required"}. Tax: NGN ${action.taxNaira ?? 0}. Discount: NGN ${action.discountNaira ?? 0}.${action.date ? ` Due ${action.date}.` : ""}`;
    case "create_payment_link":
      return `Create a payment link for sale ${action.orderId ?? "unspecified"}, using ${action.email ?? "an email address"}.`;
    case "send_invoice":
      return `Send invoice ${action.invoiceId ?? "unspecified"} to ${action.email ?? "an email address"}.`;
    case "convert_lead_to_customer":
      return `Convert ${customer} from a lead to a customer.`;
    case "add_note":
      return `Add a note for ${customer}: “${action.description ?? ""}”.`;
    default:
      return "Review the requested action.";
  }
}

export function getMissingActionDetails(action: ParsedAction): string | null {
  if (
    action.intent === "create_product" &&
    (!action.productName ||
      action.stockQuantity === undefined ||
      action.unitPriceNaira === undefined)
  )
    return "Please provide the product name, stock quantity and selling price per unit.";
  if (
    action.intent === "record_sale" &&
    !action.items &&
    (!action.productName || !action.quantity || !action.amountNaira)
  )
    return "Please include the product, quantity and total selling amount.";
  if (action.intent === "record_expense" && !action.amountNaira) return "How much was the expense?";
  if (action.intent === "create_contact" && !action.customerName)
    return "What is the customer's name?";
  if (
    action.intent === "create_invoice" &&
    (!action.items || (!action.customerName && !action.contactId))
  )
    return "Please include the customer and invoice items with quantities and unit prices.";
  if (action.intent === "create_payment_link" && (!action.orderId || !action.email))
    return "Please provide the sale ID and customer email.";
  if (action.intent === "send_invoice" && (!action.invoiceId || !action.email))
    return "Please provide the invoice ID and recipient email.";
  if (
    ["add_note", "convert_lead_to_customer"].includes(action.intent) &&
    !action.customerName &&
    !action.contactId
  )
    return "Which contact should I use?";
  if (action.intent === "add_note" && !action.description) return "What should the note say?";
  return null;
}
