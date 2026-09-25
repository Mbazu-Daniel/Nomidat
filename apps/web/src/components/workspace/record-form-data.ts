import type { FormProps } from "./types";

function inventory(fields: FormData) {
  return {
    name: fields.get("name"),
    sku: fields.get("sku") || undefined,
    description: fields.get("description") || undefined,
    costKobo: Math.round(Number(fields.get("cost")) * 100),
    unit: fields.get("unit"),
    stockQuantity: Number(fields.get("stock")),
    lowStockThreshold: Number(fields.get("threshold")),
    priceKobo: Math.round(Number(fields.get("price")) * 100),
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
function expenses(fields: FormData) {
  return {
    description: fields.get("description"),
    amountKobo: Math.round(Number(fields.get("amount")) * 100),
    categoryId: fields.get("category") || undefined,
    spentAt: new Date(`${fields.get("date")}T12:00:00+01:00`).toISOString(),
    paymentMethod: fields.get("paymentMethod"),
  };
}

const forms = {
  inventory: { resource: "products", title: "Add a product", payload: inventory },
  customers: { resource: "contacts", title: "Add a contact", payload: customers },
  expenses: { resource: "expenses", title: "Record an expense", payload: expenses },
};
export function recordFormDefinition(section: FormProps["section"]) {
  return forms[section as keyof typeof forms];
}
