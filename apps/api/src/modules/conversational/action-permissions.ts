export function actionWriteArea(intent: string): string {
  const areas: Record<string, string> = {
    create_product: "inventory",
    create_contact: "customers",
    convert_lead_to_customer: "customers",
    add_note: "customers",
    record_sale: "sales",
    create_payment_link: "sales",
    record_expense: "expenses",
    create_invoice: "invoices",
    send_invoice: "invoices",
  };
  return areas[intent] ?? "unsupported";
}
