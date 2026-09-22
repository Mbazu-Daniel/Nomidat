import { IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getBusinessData } from "@/data/nomidat";

type Section = "sales" | "customers" | "inventory" | "expenses";
type BusinessRow = Awaited<ReturnType<typeof getBusinessData>>[number];

const sections = {
  sales: { title: "Sales", description: "Track recorded sales and credit transactions.", icon: IconReceipt },
  customers: { title: "Customers", description: "See customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Monitor stock levels and items that need attention.", icon: IconBox },
  expenses: { title: "Expenses", description: "Review business spending by category.", icon: IconWallet },
} as const;

export function BusinessListView(props: {
  section: Section;
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
  rows: BusinessRow[];
  loading: boolean;
  error: string | null;
}) {
  const config = sections[props.section];
  const Icon = config.icon;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div><div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></div><h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1><p className="mt-1 text-sm text-muted-foreground">{config.description}</p></div>
          {props.organizations.length > 0 ? <OrganizationSwitcher organizations={props.organizations} currentOrganizationId={props.organizationId} onChange={props.onOrganizationChange} /> : null}
        </header>
        {props.error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{props.error}</div> : null}
        {!props.loading && !props.organizationId && !props.error ? <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">No business found. Create a business to get started.</div> : null}
        {props.loading ? <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">Loading {config.title.toLowerCase()}…</div> : null}
        {!props.loading && props.organizationId ? <SectionRows section={props.section} rows={props.rows} /> : null}
      </div>
    </main>
  );
}

function SectionRows({ section, rows }: { section: Section; rows: BusinessRow[] }) {
  if (section === "sales") return <SalesRows rows={rows} />;
  if (section === "customers") return <CustomerRows rows={rows} />;
  if (section === "inventory") return <InventoryRows rows={rows} />;
  return <ExpenseRows rows={rows} />;
}

function SalesRows({ rows }: { rows: BusinessRow[] }) {
  return <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4"><Metric label="Recent transactions" value={String(rows.length)} /><Metric label="Recent revenue" value={formatNaira(rows.reduce((sum, row) => sum + (row.totalKobo ?? 0), 0) / 100)} /></div><div className="divide-y divide-orange-100">{rows.length === 0 ? <EmptyState label="No sales recorded yet." /> : rows.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="min-w-0 flex-1"><p className="font-medium">{sale.customer ?? "Walk-in customer"}</p><p className="text-xs text-muted-foreground">{sale.status ?? "Sale"} · {sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "Recent"}</p></div><span className="text-sm font-semibold">{formatNaira((sale.totalKobo ?? 0) / 100)}</span><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{sale.status ?? "Recorded"}</span></div>)}</div></div>;
}

function CustomerRows({ rows }: { rows: BusinessRow[] }) {
  return <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="border-b border-orange-100 px-4 py-3 text-sm font-medium">Customer list</div><div className="divide-y divide-orange-100">{rows.length === 0 ? <EmptyState label="No customers recorded yet." /> : rows.map((customer) => <div key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="flex size-10 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">{customer.name?.charAt(0) ?? "?"}</div><div className="min-w-0 flex-1"><p className="font-medium">{customer.name ?? "Unnamed customer"}</p><p className="text-xs text-muted-foreground">{customer.phone ?? "No phone number"}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatNaira((customer.outstandingBalanceKobo ?? 0) / 100)}</p><p className="text-xs text-muted-foreground">Balance</p></div></div>)}</div></div>;
}

function InventoryRows({ rows }: { rows: BusinessRow[] }) {
  return <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rows.length === 0 ? <EmptyState label="No products recorded yet." /> : rows.map((item) => { const low = (item.stockQuantity ?? 0) <= (item.lowStockThreshold ?? 0); return <div key={item.id} className="rounded-2xl border border-orange-100 bg-white p-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconBox className="size-4" /></span><span className={low ? "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800" : "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800"}>{low ? "Low stock" : "Healthy"}</span></div><p className="mt-5 font-medium">{item.name}</p><p className="mt-1 text-2xl font-semibold">{item.stockQuantity ?? 0}</p><p className="text-xs text-muted-foreground">{item.unit ?? "units"} · reorder at {item.lowStockThreshold ?? 0}</p></div>; })}</div>;
}

function ExpenseRows({ rows }: { rows: BusinessRow[] }) {
  return <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4"><Metric label="Recent total" value={formatNaira(rows.reduce((sum, row) => sum + (row.amountKobo ?? 0), 0) / 100)} /><Metric label="Entries" value={String(rows.length)} /></div><div className="divide-y divide-orange-100">{rows.length === 0 ? <EmptyState label="No expenses recorded yet." /> : rows.map((expense) => <div key={expense.id} className="flex items-center gap-3 px-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-medium">{expense.description ?? "Expense"}</p><p className="text-xs text-muted-foreground">{expense.category ?? "Uncategorised"} · {expense.spentAt ? new Date(expense.spentAt).toLocaleString() : "Recent"}</p></div><span className="text-sm font-semibold">{formatNaira((expense.amountKobo ?? 0) / 100)}</span></div>)}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-orange-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
function EmptyState({ label }: { label: string }) { return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>; }
