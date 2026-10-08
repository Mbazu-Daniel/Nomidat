import type { FormProps } from "./types";
import { parseMoneyToMinor } from "@/lib/money";

/**
 * Money typed into these forms is read against the business's own minor-unit
 * scale, not a fixed x100.
 *
 * `recordFormDefinition` is a pure function taking only the section, so the
 * currency is passed in rather than read from context here: the caller is a
 * component and already has it.
 */
function inventory(fields: FormData, currency: string) {
  return {
    name: fields.get("name"),
    sku: fields.get("sku") || undefined,
    description: fields.get("description") || undefined,
    costMinor: parseMoneyToMinor(String(fields.get("cost")), currency) ?? 0,
    unit: fields.get("unit"),
    stockQuantity: Number(fields.get("stock")),
    lowStockThreshold: Number(fields.get("threshold")),
    priceMinor: parseMoneyToMinor(String(fields.get("price")), currency) ?? 0,
  };
}
function customers(fields: FormData) {
  return {
    name: fields.get("name"),
    phone: fields.get("phone") || undefined,
    email: fields.get("email") || undefined,
    kind: fields.get("kind"),
  };
}
function expenses(fields: FormData, currency: string) {
  return {
    description: fields.get("description"),
    amountMinor: parseMoneyToMinor(String(fields.get("amount")), currency) ?? 0,
    categoryId: fields.get("category") || undefined,
    spentAt: new Date(`${fields.get("date")}T12:00:00+01:00`).toISOString(),
    paymentMethod: fields.get("paymentMethod"),
  };
}

const forms = {
  inventory: {
    resource: "products",
    title: "Add a product",
    payload: (fields: FormData, currency: string) => inventory(fields, currency),
  },
  customers: {
    resource: "contacts",
    title: "Add a contact",
    payload: (fields: FormData) => customers(fields),
  },
  expenses: {
    resource: "expenses",
    title: "Record an expense",
    payload: (fields: FormData, currency: string) => expenses(fields, currency),
  },
};
/**
 * The definition for a section: where to post it and how to read its fields.
 *
 * `currency` is not taken here. The payload builders that touch money close over
 * nothing and take it as an argument, so the two forms that scale amounts read
 * the business's currency and `customers` — which has no money in it — does not
 * have to pretend to.
 */
export function recordFormDefinition(section: FormProps["section"]) {
  return forms[section as keyof typeof forms];
}
