import { createFileRoute } from "@tanstack/react-router";
import {
  IconArrowUpRight,
  IconChartDonut,
  IconChevronRight,
  IconCreditCard,
  IconPackage,
  IconReceipt,
  IconSparkles,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { StatCard } from "@/components/nomidat/stat-card";
import { businessData, formatNaira } from "@/data/nomidat";
import { createTelegramSession } from "@/lib/telegram-session";
import "@/lib/types/telegram-web-app.type";

export const Route = createFileRoute("/mini-app")({
  component: MiniAppPage,
  head: () => ({ scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }] }),
});

type View = "home" | "sales" | "customers" | "stock" | "expenses" | "more";

function MiniAppPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Opening Telegram session…");
  const [userName, setUserName] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");

  useEffect(() => {
    let cancelled = false;
    void createTelegramSession(window.Telegram?.WebApp).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setUserName(result.userName);
        setStatus("ready");
        setMessage("");
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-sm text-muted-foreground">{message}</div>;
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconSparkles className="size-7" /></div>
          <h1 className="text-xl font-semibold">Open Nomidat in Telegram</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] pb-24 text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-600">nomidat</p>
            <p className="mt-1 truncate text-lg font-semibold">Hi, {userName ?? "there"} 👋</p>
          </div>
        </header>

        {view === "home" ? <HomeView onNavigate={setView} /> : null}
        {view === "sales" ? <SalesView /> : null}
        {view === "customers" ? <CustomersView /> : null}
        {view === "stock" ? <StockView /> : null}
        {view === "expenses" ? <ExpensesView /> : null}
        {view === "more" ? <MoreView onNavigate={setView} /> : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {([
            ["Home", "home", IconChartDonut],
            ["Sales", "sales", IconReceipt],
            ["Customers", "customers", IconUsers],
            ["More", "more", IconPackage],
          ] as const).map(([label, target, Icon]) => (
            <button key={label} type="button" onClick={() => setView(target)} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] ${view === target ? "bg-orange-50 text-orange-700" : "text-muted-foreground"}`}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function HomeView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const todaySales = businessData.sales.filter((sale) => sale.date.startsWith("Today")).reduce((sum, sale) => sum + sale.amount, 0);
  const credit = businessData.customers.reduce((sum, customer) => sum + customer.outstanding, 0);
  const expenses = businessData.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <section className="mt-6 rounded-[28px] bg-orange-500 p-5 text-white shadow-[0_16px_40px_rgba(234,88,12,0.22)]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-orange-100">Today's sales</p><p className="mt-2 text-3xl font-semibold tracking-tight">{formatNaira(todaySales)}</p><p className="mt-1 text-xs text-orange-100">{businessData.sales.length} transactions recorded</p></div><span className="rounded-full bg-white/15 p-2"><IconArrowUpRight className="size-5" /></span></div>
      </section>
      <section className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Credit owed" value={formatNaira(credit)} detail={`${businessData.customers.filter((c) => c.outstanding > 0).length} customers`} icon={<IconCreditCard className="size-4" />} />
        <StatCard label="Expenses" value={formatNaira(expenses)} detail="Recorded expenses" icon={<IconWallet className="size-4" />} />
      </section>
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Quick actions</h2><button type="button" onClick={() => onNavigate("more")} className="text-xs font-medium text-orange-600">See all</button></div>
        <div className="grid grid-cols-4 gap-2">
          {([
            ["Sale", "sales", IconReceipt],
            ["Expense", "expenses", IconWallet],
            ["Customer", "customers", IconUsers],
            ["Stock", "stock", IconPackage],
          ] as const).map(([label, target, Icon]) => (
            <button key={label} type="button" onClick={() => onNavigate(target)} className="flex flex-col items-center gap-2 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm active:scale-[0.98]"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Icon className="size-5" /></span><span className="text-[11px] font-medium">{label}</span></button>
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Ask Nomidat</h2><p className="mt-1 text-xs text-muted-foreground">Record sales, expenses or check your business.</p></div><button type="button" className="flex size-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-md"><IconSparkles className="size-5" /></button></div>
        <div className="mt-4 rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">“I sold 5 bags of cement to Chinedu for ₦42,500 on credit.”</div>
      </section>
      <section className="mt-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold">Recent activity</h2><button type="button" onClick={() => onNavigate("sales")} className="text-xs font-medium text-orange-600">View all</button></div><div className="divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white px-3"><ActivityRow icon={<IconReceipt className="size-5" />} title={`Sale to ${businessData.sales[0].customer}`} description={`${businessData.sales[0].quantity} ${businessData.sales[0].item} · ${businessData.sales[0].status}`} amount={formatNaira(businessData.sales[0].amount)} status={businessData.sales[0].status} /><ActivityRow icon={<IconWallet className="size-5" />} title={businessData.expenses[0].description} description={`${businessData.expenses[0].category} · ${businessData.expenses[0].date}`} amount={formatNaira(businessData.expenses[0].amount)} /><ActivityRow icon={<IconUsers className="size-5" />} title={`New customer: ${businessData.customers[0].name}`} description={`Last purchase ${businessData.customers[0].lastPurchase}`} /></div></section>
    </>
  );
}

function SalesView() {
  return <ListView title="Sales" description="Recent recorded transactions.">{businessData.sales.map((sale) => <div key={sale.id} className="flex items-center gap-3 border-b border-orange-100 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconReceipt className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">{sale.quantity} {sale.item} · {sale.date}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatNaira(sale.amount)}</p><span className="text-[11px] text-orange-700">{sale.status}</span></div></div>)}</ListView>;
}
function CustomersView() {
  return <ListView title="Customers" description="Customer balances and recent activity.">{businessData.customers.map((customer) => <div key={customer.id} className="flex items-center gap-3 border-b border-orange-100 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">{customer.name[0]}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatNaira(customer.outstanding)}</p><p className="text-[11px] text-muted-foreground">owed</p></div></div>)}</ListView>;
}
function StockView() {
  return <ListView title="Inventory" description="Current stock levels.">{businessData.products.map((product) => { const low = product.quantity <= product.reorderLevel; return <div key={product.id} className="flex items-center gap-3 border-b border-orange-100 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconPackage className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.quantity} {product.unit}</p></div><span className={`rounded-full px-2 py-1 text-[11px] ${low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{low ? "Low stock" : "Healthy"}</span></div>; })}</ListView>;
}
function ExpensesView() {
  return <ListView title="Expenses" description="Recent business spending.">{businessData.expenses.map((expense) => <div key={expense.id} className="flex items-center gap-3 border-b border-orange-100 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{expense.category} · {expense.date}</p></div><p className="text-sm font-semibold">{formatNaira(expense.amount)}</p></div>)}</ListView>;
}
function MoreView({ onNavigate }: { onNavigate: (view: View) => void }) {
  return <section className="mt-6 space-y-3"><h1 className="text-xl font-semibold">More</h1><p className="text-sm text-muted-foreground">Business tools available from Nomidat.</p><button type="button" onClick={() => onNavigate("expenses")} className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white p-4 text-left"><span><span className="block text-sm font-medium">Expenses</span><span className="text-xs text-muted-foreground">Review business spending</span></span><IconChevronRight className="size-4 text-muted-foreground" /></button><button type="button" onClick={() => onNavigate("stock")} className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white p-4 text-left"><span><span className="block text-sm font-medium">Inventory</span><span className="text-xs text-muted-foreground">Check stock levels</span></span><IconChevronRight className="size-4 text-muted-foreground" /></button></section>;
}
function ListView({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="mt-6 rounded-2xl border border-orange-100 bg-white px-4 pb-2 pt-4"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-1 text-xs text-muted-foreground">{description}</p><div className="mt-2">{children}</div></section>;
}
