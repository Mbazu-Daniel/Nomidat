import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowDownRight, IconArrowUpRight, IconBell, IconBox, IconChevronRight, IconCreditCard, IconFileInvoice, IconLayoutDashboard, IconPackage, IconPlus, IconReceipt, IconSettings, IconSparkles, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { StatCard } from "@/components/nomidat/stat-card";
import { Button } from "@/components/ui/button";
import { formatNaira, getBusinessData, getBusinessSummary, getOrganizations, type BusinessSummary } from "@/data/nomidat";

export const Route = createFileRoute("/")({ component: DashboardPage });

const navItems = [
  { label: "Overview", icon: IconLayoutDashboard, to: "/" },
  { label: "Sales", icon: IconReceipt, to: "/sales" },
  { label: "Customers", icon: IconUsers, to: "/customers" },
  { label: "Inventory", icon: IconPackage, to: "/inventory" },
  { label: "Expenses", icon: IconWallet, to: "/expenses" },
  { label: "Invoices", icon: IconFileInvoice, to: "/invoices" },
];

function DashboardPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOrganizations().then((result) => {
      const options = result.map((organization) => ({ id: organization.id, name: organization.name }));
      setOrganizations(options);
      setOrganizationId((current) => current || options[0]?.id || "");
    }).catch(() => setError("Could not load your businesses."));
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      getBusinessSummary(organizationId),
      getBusinessData(organizationId, "sales"),
      getBusinessData(organizationId, "expenses"),
    ]).then(([nextSummary, nextSales, nextExpenses]) => {
      if (cancelled) return;
      setSummary(nextSummary);
      setSales(nextSales);
      setExpenses(nextExpenses);
    }).catch(() => {
      if (!cancelled) setError("Could not load your business overview.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId]);

  const organization = organizations.find((item) => item.id === organizationId);
  const recentSales = sales.slice(0, 3);
  const recentExpenses = expenses.slice(0, 2);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-orange-100 bg-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center border-b border-orange-100 px-6"><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-sm font-bold text-white">n</span><span className="text-lg font-semibold tracking-tight">nomidat</span></div></div>
          <div className="p-4">{organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={setOrganizationId} /> : <div className="rounded-xl bg-orange-50 p-3 text-xs text-muted-foreground">Loading businesses…</div>}</div>
          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">{navItems.map(({ label, icon: Icon, to }) => <Link key={label} to={to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${label === "Overview" ? "bg-orange-50 text-orange-700" : "text-muted-foreground hover:bg-orange-50 hover:text-foreground"}`}><Icon className="size-4" />{label}</Link>)}</nav>
          <div className="border-t border-orange-100 p-3"><button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-orange-50 hover:text-foreground"><IconSettings className="size-4" />Settings</button></div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-orange-100 bg-background/95 backdrop-blur"><div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"><div className="min-w-0"><p className="text-sm text-muted-foreground">Overview</p><h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Good afternoon 👋</h1></div><div className="flex items-center gap-2"><div className="lg:hidden">{organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={setOrganizationId} /> : null}</div><Button variant="outline" size="icon" aria-label="Notifications"><IconBell /></Button><Button className="hidden sm:inline-flex"><IconPlus data-icon="inline-start" />Record sale</Button></div></div></header>

          <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Your business</p><h2 className="mt-1 text-lg font-semibold">{organization?.name ?? "Your business"}</h2></div></div>
            {error ? <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {!loading && organizations.length === 0 ? <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-muted-foreground">Create a business to start recording sales, expenses and customers.</div> : null}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Sales" value={formatNaira((summary?.salesTotalKobo ?? 0) / 100)} detail="All recorded sales" icon={<IconArrowUpRight className="size-4" />} />
              <StatCard label="Outstanding credit" value={formatNaira((summary?.outstandingCreditKobo ?? 0) / 100)} detail="Pending customer credit" icon={<IconCreditCard className="size-4" />} />
              <StatCard label="Expenses" value={formatNaira((summary?.expensesTotalKobo ?? 0) / 100)} detail="All recorded expenses" icon={<IconArrowDownRight className="size-4" />} />
              <StatCard label="Customers" value={String(summary?.customerCount ?? 0)} detail="Business contacts" icon={<IconUsers className="size-4" />} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Recent sales</h2><p className="mt-1 text-sm text-muted-foreground">Latest transactions recorded for this business.</p></div><Link to="/sales" className="text-sm font-medium text-orange-700">View all</Link></div><div className="mt-5 divide-y divide-orange-100">{loading ? <p className="py-8 text-sm text-muted-foreground">Loading…</p> : recentSales.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No sales recorded yet.</p> : recentSales.map((sale) => <ActivityRow key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} description={`${sale.status ?? "Sale"} · ${sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "Recent"}`} amount={formatNaira((sale.totalKobo ?? 0) / 100)} status={sale.status ?? undefined} />)}</div></div>

              <div className="rounded-2xl border border-orange-100 bg-orange-500 p-5 text-white shadow-[0_12px_32px_rgba(234,88,12,0.18)]"><span className="flex size-10 items-center justify-center rounded-xl bg-white/15"><IconSparkles className="size-5" /></span><h2 className="mt-5 text-xl font-semibold">Ask Nomidat</h2><p className="mt-2 max-w-xs text-sm leading-6 text-orange-100">Record business activity or ask questions in plain language.</p><div className="mt-6 rounded-xl bg-white/10 px-3 py-3 text-sm">“How much do customers owe me?”</div></div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Recent expenses</h2><p className="mt-1 text-sm text-muted-foreground">Latest business spending.</p></div><Link to="/expenses" className="text-sm font-medium text-orange-700">View all</Link></div><div className="divide-y divide-orange-100">{loading ? <p className="py-8 text-sm text-muted-foreground">Loading…</p> : recentExpenses.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No expenses recorded yet.</p> : recentExpenses.map((expense) => <ActivityRow key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} description={`${expense.category ?? "Uncategorised"} · ${expense.spentAt ? new Date(expense.spentAt).toLocaleString() : "Recent"}`} amount={formatNaira((expense.amountKobo ?? 0) / 100)} />)}</div></div>
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Inventory</h2><p className="mt-1 text-sm text-muted-foreground">Stock needing attention.</p></div><IconBox className="size-5 text-orange-500" /></div><div className="rounded-xl bg-orange-50 p-4"><p className="text-sm font-medium">{summary?.lowStockCount ?? 0} items need attention</p><p className="mt-1 text-xs text-muted-foreground">{summary?.productCount ?? 0} products tracked</p><Link to="/inventory" className="mt-3 inline-flex text-xs font-medium text-orange-700">Open inventory <IconChevronRight className="ml-1 size-3" /></Link></div></div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
