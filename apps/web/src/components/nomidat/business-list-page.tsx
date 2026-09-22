import { IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { BusinessListContent, type BusinessSection } from "@/components/nomidat/business-list-sections";

const sections = {
  sales: { title: "Sales", description: "Track recorded sales and credit transactions.", icon: IconReceipt },
  customers: { title: "Customers", description: "See customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Monitor stock levels and items that need attention.", icon: IconBox },
  expenses: { title: "Expenses", description: "Review business spending by category.", icon: IconWallet },
} as const;

export function BusinessListPage({ section }: { section: BusinessSection }) {
  const config = sections[section];
  const Icon = config.icon;
  const actionLabel = getActionLabel(section);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
          </div>
          <button type="button" disabled title="This action is not available yet" className="hidden cursor-not-allowed rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white opacity-60 sm:inline-flex">{actionLabel}</button>
        </header>
        <BusinessListContent section={section} />
      </div>
    </main>
  );
}

function getActionLabel(section: BusinessSection) {
  const labels: Record<BusinessSection, string> = {
    sales: "Record sale",
    customers: "Add customer",
    inventory: "Add product",
    expenses: "Record expense",
  };
  return labels[section];
}
