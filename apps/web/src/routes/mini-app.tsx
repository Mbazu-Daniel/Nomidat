import { createFileRoute } from "@tanstack/react-router";
import { IconChartDonut, IconChevronRight, IconPackage, IconReceipt, IconSparkles, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { MiniAppHome } from "@/components/nomidat/mini-app-home";
import { loadMiniAppData } from "@/components/nomidat/mini-app-loader";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getBusinessData, getOrganizations, type BusinessSummary } from "@/data/nomidat";
import { createTelegramSession } from "@/lib/telegram-session";
import "@/lib/types/telegram-web-app.type";

export const Route = createFileRoute("/mini-app")({
  component: MiniAppPage,
  head: () => ({ scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }] }),
});

type View = "home" | "sales" | "customers" | "stock" | "expenses" | "more";
type BusinessRow = Awaited<ReturnType<typeof getBusinessData>>;

function MiniAppPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Opening Telegram session…");
  const [userName, setUserName] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [sales, setSales] = useState<BusinessRow>([]);
  const [customers, setCustomers] = useState<BusinessRow>([]);
  const [products, setProducts] = useState<BusinessRow>([]);
  const [expenses, setExpenses] = useState<BusinessRow>([]);
  const [view, setView] = useState<View>("home");

  useEffect(() => {
    let cancelled = false;
    void createTelegramSession(window.Telegram?.WebApp).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setUserName(result.userName);
        setStatus("ready");
        setMessage("");
        void getOrganizations().then((items) => {
          if (cancelled) return;
          const options = items.map((organization) => ({ id: organization.id, name: organization.name }));
          setOrganizations(options);
          setOrganizationId(options[0]?.id ?? "");
        }).catch(() => {
          if (!cancelled) setMessage("Could not load your businesses.");
        });
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!organizationId) { setLoading(false); setSummary(null); setSales([]); setCustomers([]); setProducts([]); setExpenses([]); return; }
    let cancelled = false;
    void loadMiniAppData(view, organizationId).then((data) => {
      if (cancelled) return;
      if (data.summary) setSummary(data.summary);
      if (data.sales) setSales(data.sales);
      if (data.customers) setCustomers(data.customers);
      if (data.products) setProducts(data.products);
      if (data.expenses) setExpenses(data.expenses);
    }).catch(() => {
      if (!cancelled) setMessage("Could not load this business data.");
    });
    return () => { cancelled = true; };
  }, [organizationId, view]);

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-sm text-muted-foreground">{message}</div>;
  if (status === "error") return <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] px-6 text-center"><div className="max-w-sm"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconSparkles className="size-7" /></div><h1 className="text-xl font-semibold">Open Nomidat in Telegram</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>;

  return (
    <main className="min-h-screen bg-[#fffaf7] pb-24 text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-600">nomidat</p><p className="mt-1 truncate text-lg font-semibold">Hi, {userName ?? "there"} 👋</p></div>{organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={setOrganizationId} /> : null}</header>
        {message && status === "ready" ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
        {view === "home" ? <MiniAppHome summary={summary} sales={sales} expenses={expenses} onNavigate={setView} /> : null}
        {view === "sales" ? <ListView title="Sales" description="Recent recorded transactions.">{sales.length === 0 ? <EmptyMessage label="No sales recorded yet." /> : sales.map((sale) => <Row key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} detail={sale.status ?? "Sale"} value={formatNaira((sale.totalKobo ?? 0) / 100)} />)}</ListView> : null}
        {view === "customers" ? <ListView title="Customers" description="Customers in this business.">{customers.length === 0 ? <EmptyMessage label="No customers recorded yet." /> : customers.map((customer) => <Row key={customer.id} icon={<IconUsers className="size-5" />} title={customer.name ?? "Unnamed customer"} detail={customer.phone ?? "No phone number"} />)}</ListView> : null}
        {view === "stock" ? <ListView title="Inventory" description="Current stock levels.">{products.length === 0 ? <EmptyMessage label="No products recorded yet." /> : products.map((product) => { const low = (product.stockQuantity ?? 0) <= (product.lowStockThreshold ?? 0); return <Row key={product.id} icon={<IconPackage className="size-5" />} title={product.name ?? "Product"} detail={`${product.stockQuantity ?? 0} ${product.unit ?? "units"} · ${low ? "Low stock" : "Healthy"}`} />; })}</ListView> : null}
        {view === "expenses" ? <ListView title="Expenses" description="Recent business spending.">{expenses.length === 0 ? <EmptyMessage label="No expenses recorded yet." /> : expenses.map((expense) => <Row key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} detail={expense.category ?? "Uncategorised"} value={formatNaira((expense.amountKobo ?? 0) / 100)} />)}</ListView> : null}
        {view === "more" ? <MoreView onNavigate={setView} /> : null}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 py-2 backdrop-blur"><div className="mx-auto flex max-w-md items-center justify-between">{([["Home","home",IconChartDonut],["Sales","sales",IconReceipt],["Customers","customers",IconUsers],["More","more",IconPackage]] as const).map(([label,target,Icon]) => <button key={label} type="button" onClick={() => setView(target)} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] ${view === target ? "bg-orange-50 text-orange-700" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</button>)}</div></nav>
    </main>
  );
}
function EmptyMessage({ label }: { label: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{label}</p>; }