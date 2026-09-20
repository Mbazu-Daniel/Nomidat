import { createFileRoute } from "@tanstack/react-router";
import { IconArrowUpRight, IconChartDonut, IconChevronRight, IconCreditCard, IconPackage, IconReceipt, IconSparkles, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { StatCard } from "@/components/nomidat/stat-card";
import { formatNaira, getBusinessData, getBusinessSummary, getOrganizations, type BusinessSummary } from "@/data/nomidat";
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
    if (!organizationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (view === "home") {
          const [nextSummary, nextSales, nextExpenses] = await Promise.all([getBusinessSummary(organizationId), getBusinessData(organizationId, "sales"), getBusinessData(organizationId, "expenses")]);
          if (!cancelled) { setSummary(nextSummary); setSales(nextSales); setExpenses(nextExpenses); }
        } else if (view === "sales") setSales(await getBusinessData(organizationId, "sales"));
        else if (view === "customers") setCustomers(await getBusinessData(organizationId, "customers"));
        else if (view === "stock") setProducts(await getBusinessData(organizationId, "inventory"));
        else if (view === "expenses") setExpenses(await getBusinessData(organizationId, "expenses"));
      } catch {
        if (!cancelled) setMessage("Could not load this business data.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [organizationId, view]);

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-sm text-muted-foreground">{message}</div>;
  if (status === "error") return <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] px-6 text-center"><div className="max-w-sm"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconSparkles className="size-7" /></div><h1 className="text-xl font-semibold">Open Nomidat in Telegram</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>;

  return (
    <main className="min-h-screen bg-[#fffaf7] pb-24 text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-600">nomidat</p><p className="mt-1 truncate text-lg font-semibold">Hi, {userName ?? "there"} 👋</p></div>{organizations.length > 0 ? <OrganizationSwitcher organizations={organizations} currentOrganizationId={organizationId} onChange={setOrganizationId} /> : null}</header>
        {message && status === "ready" ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
        {view === "home" ? <HomeView summary={summary} sales={sales} expenses={expenses} onNavigate={setView} /> : null}
        {view === "sales" ? <ListView title="Sales" description="Recent recorded transactions.">{sales.map((sale) => <Row key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} detail={sale.status ?? "Sale"} value={formatNaira((sale.totalKobo ?? 0) / 100)} />)}</ListView> : null}
        {view === "customers" ? <ListView title="Customers" description="Customers in this business.">{customers.map((customer) => <Row key={customer.id} icon={<IconUsers className="size-5" />} title={customer.name ?? "Unnamed customer"} detail={customer.phone ?? "No phone number"} />)}</ListView> : null}
        {view === "stock" ? <ListView title="Inventory" description="Current stock levels.">{products.map((product) => { const low = (product.stockQuantity ?? 0) <= (product.lowStockThreshold ?? 0); return <Row key={product.id} icon={<IconPackage className="size-5" />} title={product.name ?? "Product"} detail={`${product.stockQuantity ?? 0} ${product.unit ?? "units"} · ${low ? "Low stock" : "Healthy"}`} />; })}</ListView> : null}
        {view === "expenses" ? <ListView title="Expenses" description="Recent business spending.">{expenses.map((expense) => <Row key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} detail={expense.category ?? "Uncategorised"} value={formatNaira((expense.amountKobo ?? 0) / 100)} />)}</ListView> : null}
        {view === "more" ? <MoreView onNavigate={setView} /> : null}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 py-2 backdrop-blur"><div className="mx-auto flex max-w-md items-center justify-between">{[["Home","home",IconChartDonut],["Sales","sales",IconReceipt],["Customers","customers",IconUsers],["More","more",IconPackage]] as const).map(([label,target,Icon]) => <button key={label} type="button" onClick={() => setView(target)} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] ${view === target ? "bg-orange-50 text-orange-700" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</button>)}</div></nav>
    </main>
  );
}

function HomeView({ summary, sales, expenses, onNavigate }: { summary: BusinessSummary | null; sales: BusinessRow; expenses: BusinessRow; onNavigate: (view: View) => void }) {
  return <><section className="mt-6 rounded-[28px] bg-orange-500 p-5 text-white shadow-[0_16px_40px_rgba(234,88,12,0.22)]"><p className="text-sm text-orange-100">Recorded sales</p><p className="mt-2 text-3xl font-semibold tracking-tight">{formatNaira((summary?.salesTotalKobo ?? 0) / 100)}</p><p className="mt-1 text-xs text-orange-100">{summary?.customerCount ?? 0} customers · {summary?.productCount ?? 0} products</p></section><section className="mt-4 grid grid-cols-2 gap-3"><StatCard label="Credit owed" value={formatNaira((summary?.outstandingCreditKobo ?? 0) / 100)} detail="Pending credit" icon={<IconCreditCard className="size-4" />} /><StatCard label="Expenses" value={formatNaira((summary?.expensesTotalKobo ?? 0) / 100)} detail="Recorded expenses" icon={<IconWallet className="size-4" />} /></section><section className="mt-6"><h2 className="mb-3 text-base font-semibold">Quick actions</h2><div className="grid grid-cols-4 gap-2">{[["Sale","sales",IconReceipt],["Expense","expenses",IconWallet],["Customer","customers",IconUsers],["Stock","stock",IconPackage]] as const).map(([label,target,Icon]) => <button key={label} type="button" onClick={() => onNavigate(target)} className="flex flex-col items-center gap-2 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Icon className="size-5" /></span><span className="text-[11px] font-medium">{label}</span></button>)}</div></section><section className="mt-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Ask Nomidat</h2><p className="mt-1 text-xs text-muted-foreground">Record activity or ask a business question.</p></div><span className="flex size-11 items-center justify-center rounded-full bg-orange-500 text-white"><IconSparkles className="size-5" /></span></div><div className="mt-4 rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">“I sold 5 bags of cement to Chinedu for ₦42,500 on credit.”</div></section><section className="mt-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold">Recent activity</h2><button type="button" onClick={() => onNavigate("sales")} className="text-xs font-medium text-orange-600">View all</button></div><div className="divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white px-3">{sales.slice(0,2).map((sale) => <ActivityRow key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} description={sale.status ?? "Sale"} amount={formatNaira((sale.totalKobo ?? 0) / 100)} status={sale.status ?? undefined} />)}{expenses.slice(0,1).map((expense) => <ActivityRow key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} description={expense.category ?? "Uncategorised"} amount={formatNaira((expense.amountKobo ?? 0) / 100)} />)}</div></section></>;
}

function ListView({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="mt-6 rounded-2xl border border-orange-100 bg-white px-4 pb-2 pt-4"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-1 text-xs text-muted-foreground">{description}</p><div className="mt-2">{children}</div></section>; }
function Row({ icon, title, detail, value }: { icon: ReactNode; title: string; detail: string; value?: string }) { return <div className="flex items-center gap-3 border-b border-orange-100 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div>{value ? <span className="text-sm font-semibold">{value}</span> : null}</div>; }
function MoreView({ onNavigate }: { onNavigate: (view: View) => void }) { return <section className="mt-6 space-y-3"><h1 className="text-xl font-semibold">More</h1><p className="text-sm text-muted-foreground">Business tools available from Nomidat.</p><button type="button" onClick={() => onNavigate("expenses")} className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white p-4 text-left"><span><span className="block text-sm font-medium">Expenses</span><span className="text-xs text-muted-foreground">Review business spending</span></span><IconChevronRight className="size-4 text-muted-foreground" /></button><button type="button" onClick={() => onNavigate("stock")} className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white p-4 text-left"><span><span className="block text-sm font-medium">Inventory</span><span className="text-xs text-muted-foreground">Check stock levels</span></span><IconChevronRight className="size-4 text-muted-foreground" /></button></section>; }
