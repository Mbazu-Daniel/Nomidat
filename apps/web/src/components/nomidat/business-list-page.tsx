import { IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { businessData, formatNaira } from "@/data/nomidat";

const sections = {
  sales: { title: "Sales", description: "Track recorded sales and credit transactions.", icon: IconReceipt },
  customers: { title: "Customers", description: "See customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Monitor stock levels and items that need attention.", icon: IconBox },
  expenses: { title: "Expenses", description: "Review business spending by category.", icon: IconWallet },
} as const;

export function BusinessListPage({ section }: { section: keyof typeof sections }) {
  const config = sections[section];
  const Icon = config.icon;
  const action = section === "sales" ? "Record sale" : section === "customers" ? "Add customer" : section === "inventory" ? "Add product" : "Record expense";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div><div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></div><h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1><p className="mt-1 text-sm text-muted-foreground">{config.description}</p></div>
          <button type="button" className="hidden rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 sm:inline-flex">{action}</button>
        </div>
        {section === "sales" ? <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4 sm:grid-cols-4"><Metric label="Revenue" value={formatNaira(250900)} /><Metric label="Paid" value={formatNaira(156400)} /><Metric label="Credit" value={formatNaira(94500)} /><Metric label="Transactions" value={String(businessData.sales.length)} /></div><div className="divide-y divide-orange-100">{businessData.sales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="min-w-0 flex-1"><p className="font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">{sale.quantity} {sale.item} · {sale.date}</p></div><span className="text-sm font-semibold">{formatNaira(sale.amount)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sale.status === "Credit" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{sale.status}</span></div>)}</div></div> : null}
        {section === "customers" ? <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="border-b border-orange-100 px-4 py-3 text-sm font-medium">Customer list</div><div className="divide-y divide-orange-100">{businessData.customers.map((customer) => <div key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="flex size-10 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">{customer.name.charAt(0)}</div><div className="min-w-0 flex-1"><p className="font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone} · Last purchase {customer.lastPurchase}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatNaira(customer.outstanding)}</p><p className="text-xs text-muted-foreground">Outstanding</p></div></div>)}</div></div> : null}
        {section === "inventory" ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{businessData.products.map((product) => { const low = product.quantity <= product.reorderLevel; return <div key={product.id} className="rounded-2xl border border-orange-100 bg-white p-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconBox className="size-4" /></span><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{low ? "Low stock" : "Healthy"}</span></div><p className="mt-5 font-medium">{product.name}</p><p className="mt-1 text-2xl font-semibold">{product.quantity}</p><p className="text-xs text-muted-foreground">{product.unit} · reorder at {product.reorderLevel}</p></div>; })}</div> : null}
        {section === "expenses" ? <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4 sm:grid-cols-3"><Metric label="Total" value={formatNaira(38900)} /><Metric label="Categories" value="3" /><Metric label="Entries" value={String(businessData.expenses.length)} /></div><div className="divide-y divide-orange-100">{businessData.expenses.map((expense) => <div key={expense.id} className="flex items-center gap-3 px-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{expense.category} · {expense.date}</p></div><span className="text-sm font-semibold">{formatNaira(expense.amount)}</span></div>)}</div></div> : null}
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-orange-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
