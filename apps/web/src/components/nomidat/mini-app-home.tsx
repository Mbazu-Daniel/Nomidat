import { IconPackage, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { StatCard } from "@/components/nomidat/stat-card";
import { formatNaira, getBusinessData, type BusinessSummary } from "@/data/nomidat";

type Row = Awaited<ReturnType<typeof getBusinessData>>;
type View = "home" | "sales" | "customers" | "stock" | "expenses" | "more";

export function MiniAppHome({ summary, sales, expenses, onNavigate }: {
  summary: BusinessSummary | null; sales: Row; expenses: Row; onNavigate: (view: View) => void;
}) {
  return <><Hero summary={summary} /><Stats summary={summary} /><QuickActions onNavigate={onNavigate} /><Prompt /><RecentActivity sales={sales} expenses={expenses} onNavigate={onNavigate} /></>;
}
function Hero({ summary }: { summary: BusinessSummary | null }) {
  return <section className="mt-6 rounded-[28px] bg-orange-500 p-5 text-white shadow-[0_16px_40px_rgba(234,88,12,0.22)]"><p className="text-sm text-orange-100">Recorded sales</p><p className="mt-2 text-3xl font-semibold tracking-tight">{formatNaira((summary?.salesTotalKobo ?? 0) / 100)}</p><p className="mt-1 text-xs text-orange-100">{summary?.customerCount ?? 0} customers · {summary?.productCount ?? 0} products</p></section>;
}
function Stats({ summary }: { summary: BusinessSummary | null }) {
  return <section className="mt-4 grid grid-cols-2 gap-3"><StatCard label="Credit owed" value={formatNaira((summary?.outstandingCreditKobo ?? 0) / 100)} detail="Pending credit" icon={<IconReceipt className="size-4" />} /><StatCard label="Expenses" value={formatNaira((summary?.expensesTotalKobo ?? 0) / 100)} detail="Recorded expenses" icon={<IconWallet className="size-4" />} /></section>;
}
function QuickActions({ onNavigate }: { onNavigate: (view: View) => void }) {
  return <section className="mt-6"><h2 className="mb-3 text-base font-semibold">Quick actions</h2><div className="grid grid-cols-4 gap-2">{([["Sale","sales",IconReceipt],["Expense","expenses",IconWallet],["Customer","customers",IconUsers],["Stock","stock",IconPackage]] as const).map(([label,target,Icon]) => <button key={label} type="button" onClick={() => onNavigate(target)} className="flex flex-col items-center gap-2 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Icon className="size-5" /></span><span className="text-[11px] font-medium">{label}</span></button>)}</div></section>;
}
function Prompt() {
  return <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Ask Nomidat</h2><p className="mt-1 text-xs text-muted-foreground">Record activity or ask a business question.</p></div></div><div className="mt-4 rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">“I sold 5 bags of cement to Chinedu for ₦42,500 on credit.”</div></section>;
}
function RecentActivity({ sales, expenses, onNavigate }: { sales: Row; expenses: Row; onNavigate: (view: View) => void }) {
  return <section className="mt-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold">Recent activity</h2><button type="button" onClick={() => onNavigate("sales")} className="text-xs font-medium text-orange-600">View all</button></div><div className="divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white px-3">{sales.slice(0,2).map((sale) => <ActivityRow key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} description={sale.status ?? "Sale"} amount={formatNaira((sale.totalKobo ?? 0) / 100)} status={sale.status ?? undefined} />)}{expenses.slice(0,1).map((expense) => <ActivityRow key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} description={expense.category ?? "Uncategorised"} amount={formatNaira((expense.amountKobo ?? 0) / 100)} />)}</div></section>;
}
