export const recordMetadata = {
  inventory: {
    title: "Inventory",
    subtitle: "A place for every product. A clear view of every unit.",
    action: "Add product",
    resource: "products",
  },
  customers: {
    title: "Contacts",
    subtitle: "Build relationships that go beyond the next sale.",
    action: "Add contact",
    resource: "contacts",
  },
  expenses: {
    title: "Expenses",
    subtitle: "Know where your money goes, down to the last naira.",
    action: "Record expense",
    resource: "expenses",
  },
  sales: {
    title: "Sales",
    subtitle: "Every transaction, every payment, all accounted for.",
    action: "Record sale",
    resource: "sales",
  },
  invoices: {
    title: "Invoices",
    subtitle: "Clear invoices. Smoother payments. Better business.",
    action: "Create invoice",
    resource: "invoices",
  },
} as const;
