import { IconAlertTriangle, IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, type getBusinessData } from "@/data/nomidat";

type Section = "sales" | "customers" | "inventory" | "expenses";
type Row = Awaited<ReturnType<typeof getBusinessData>>[number];
type Props = { section: Section; organizations: OrganizationOption[]; organizationId: string; onOrganizationChange: (id: string) => void; rows: Awaited<ReturnType<typeof getBusinessData>>; loading: boolean; error: string | null };

const sectionMeta: Record<Section, { title: string; description: string; icon: typeof IconReceipt }> = {
  sales: { title: "Sales", description: "Recorded sales for this business.", icon: IconReceipt },
  customers: { title: "Customers", description: "Customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Products and current stock levels.", icon: IconBox },
  expenses: { title: "Expenses", description: "Recorded business expenses.", icon: IconWallet },
};

export function BusinessListView({ section, organizations, organizationId, onOrganizationChange, rows, loading, error }: Props) {
  const meta = sectionMeta[section];
  const Icon = meta.icon;
  return (
    <main className="min-h-screen bg-background text-foreground"><div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"><div>
        <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></span><p className="text-sm font-medium text-muted-foreground">Business</p></div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{meta.title}</h1><p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
      </div>{organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={onOrganizationChange} /> : null}</header>
      {error ? <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><IconAlertTriangle className="size-4 shrink-0" />{error}</div> : null}
      <section className="overflow-hidden rounded-2xl border bg-white">{loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> : rows.length === 0 ? <div className="p-10 text-center"><Icon className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No {meta.title.toLowerCase()} yet</p><p className="mt-1 text-sm text-muted-foreground">There is no recorded data for this business.</p></div> : <div className="divide-y">{rows.map((row) => <BusinessRow key={row.id} row={row} section={section} />)}</div>}</section>
    </div></main>
  );
}

function BusinessRow({ row, section }: { row: Row; section: Section }) {
  const title = section === "sales" ? row.customer ?? "Walk-in customer" : section === "customers" ? row.name ?? "Unnamed customer" : section === "inventory" ? row.name ?? "Unnamed product" : row.description ?? "Expense";
  const detail = section === "sales" ? row.status ?? "Sale" : section === "customers" ? row.phone ?? "No phone number" : section === "inventory" ? String(row.stockQuantity ?? 0) + " " + (row.unit ?? "units") + " in stock" : row.category ?? "Uncategorised";
  const amount = section === "sales" ? row.totalKobo : section === "customers" ? row.outstandingKobo : section === "expenses" ? row.amountKobo : undefined;
  return <article className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><p className="truncate text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>{amount != null ? <p className="text-sm font-semibold">{formatNaira(amount / 100)}</p> : section === "inventory" ? <p className="text-xs text-muted-foreground">Reorder at {row.lowStockThreshold ?? 0} {row.unit ?? "units"}</p> : null}</article>;
}
