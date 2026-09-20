import { IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { businessData, formatNaira, getBusinessData, getOrganizations } from "@/data/nomidat";

const sections = {
  sales: { title: "Sales", description: "Track recorded sales and credit transactions.", icon: IconReceipt },
  customers: { title: "Customers", description: "See customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Monitor stock levels and items that need attention.", icon: IconBox },
  expenses: { title: "Expenses", description: "Review business spending by category.", icon: IconWallet },
} as const;

type Section = keyof typeof sections;

export function BusinessListPage({ section }: { section: Section }) {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOrganizations().then((result) => {
      if (cancelled) return;
      const options = result.map((organization) => ({ id: organization.id, name: organization.name }));
      setOrganizations(options);
      setOrganizationId((current) => current || options[0]?.id || "");
    }).catch(() => {
      if (!cancelled) setError("Could not load your businesses.");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getBusinessData(organizationId, section).then((result) => {
      if (!cancelled) setRows(result);
    }).catch(() => {
      if (!cancelled) {
        setRows([]);
        setError("Could not load this business data.");
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId, section]);

  const config = sections[section];
  const Icon = config.icon;
  const action = section === "sales" ? "Record sale" : section === "customers" ? "Add customer" : section === "inventory" ? "Add product" : "Record expense";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
          </div>
          {organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={setOrganizationId} /> : null}
        </div>

        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!organizationId && !error ? <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">No business found. Create a business to get started.</div> : null}
        {loading ? <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">Loading {config.title.toLowerCase()}…</div> : null}

        {!loading && organizationId && section === "sales" ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
            <div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4 sm:grid-cols-2">
              <Metric label="Recent transactions" value={String(rows.length)} />
              <Metric label="Recent revenue" value={formatNaira(rows.reduce((sum, sale) => sum + (sale.totalKobo ?? 0), 0) / 100)} />
            </div>
            <div className="divide-y divide-orange-100">
              {rows.length === 0 ? <EmptyState label="No sales recorded yet." action={action} /> : rows.map((sale) => (
                <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1"><p className="font-medium">{sale.customer ?? "Walk-in customer"}</p><p className="text-xs text-muted-foreground">{sale.status ?? "Sale"} · {sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "Recent"}</p></div>
                  <span className="text-sm font-semibold">{formatNaira((sale.totalKobo ?? 0) / 100)}</span>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{sale.status ?? "Recorded"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && organizationId && section === "customers" ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
            <div className="border-b border-orange-100 px-4 py-3 text-sm font-medium">Customer list</div>
            <div className="divide-y divide-orange-100">
              {rows.length === 0 ? <EmptyState label="No customers recorded yet." action={action} /> : rows.map((customer) => (
                <div key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">{customer.name?.charAt(0) ?? "?"}</div>
                  <div className="min-w-0 flex-1"><p className="font-medium">{customer.name ?? "Unnamed customer"}</p><p className="text-xs text-muted-foreground">{customer.phone ?? "No phone number"}</p></div>
                  <div className="text-right"><p className="text-sm font-semibold">—</p><p className="text-xs text-muted-foreground">Balance</p></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && organizationId && section === "inventory" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.length === 0 ? <EmptyState label="No products recorded yet." action={action} /> : rows.map((product) => {
              const low = (product.stockQuantity ?? 0) <= (product.lowStockThreshold ?? 0);
              return <div key={product.id} className="rounded-2xl border border-orange-100 bg-white p-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconBox className="size-4" /></span><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{low ? "Low stock" : "Healthy"}</span></div><p className="mt-5 font-medium">{product.name}</p><p className="mt-1 text-2xl font-semibold">{product.stockQuantity ?? 0}</p><p className="text-xs text-muted-foreground">{product.unit ?? "units"} · reorder at {product.lowStockThreshold ?? 0}</p></div>;
            })}
          </div>
        ) : null}

        {!loading && organizationId && section === "expenses" ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
            <div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4"><Metric label="Recent total" value={formatNaira(rows.reduce((sum, expense) => sum + (expense.amountKobo ?? 0), 0) / 100)} /><Metric label="Entries" value={String(rows.length)} /></div>
            <div className="divide-y divide-orange-100">
              {rows.length === 0 ? <EmptyState label="No expenses recorded yet." action={action} /> : rows.map((expense) => <div key={expense.id} className="flex items-center gap-3 px-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-medium">{expense.description ?? "Expense"}</p><p className="text-xs text-muted-foreground">{expense.category ?? "Uncategorised"} · {expense.spentAt ? new Date(expense.spentAt).toLocaleString() : "Recent"}</p></div><span className="text-sm font-semibold">{formatNaira((expense.amountKobo ?? 0) / 100)}</span></div>)}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-orange-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function EmptyState({ label, action }: { label: string; action: string }) {
  return <div className="px-4 py-10 text-center"><p className="text-sm text-muted-foreground">{label}</p><button type="button" className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white">{action}</button></div>;
}
