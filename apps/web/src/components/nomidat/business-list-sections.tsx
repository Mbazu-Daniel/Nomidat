import { IconBox, IconWallet } from "@tabler/icons-react";
import { businessData, formatNaira } from "@/data/nomidat";

export type BusinessSection = "sales" | "customers" | "inventory" | "expenses";

export function BusinessListContent({ section }: { section: BusinessSection }) {
  const renderers: Record<BusinessSection, React.ReactNode> = {
    sales: <SalesSection />,
    customers: <CustomersSection />,
    inventory: <InventorySection />,
    expenses: <ExpensesSection />,
  };
  return renderers[section];
}

function SalesSection() {
  const revenue = businessData.sales.reduce((sum, sale) => sum + sale.amount, 0);
  const paid = businessData.sales.filter((sale) => sale.status === "Paid").reduce((sum, sale) => sum + sale.amount, 0);
  const credit = businessData.sales.filter((sale) => sale.status === "Credit").reduce((sum, sale) => sum + sale.amount, 0);
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4 sm:grid-cols-4">
        <Metric label="Revenue" value={formatNaira(revenue)} /><Metric label="Paid" value={formatNaira(paid)} /><Metric label="Credit" value={formatNaira(credit)} /><Metric label="Transactions" value={String(businessData.sales.length)} />
      </div>
      <div className="divide-y divide-orange-100">{businessData.sales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="min-w-0 flex-1"><p className="font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">{sale.quantity} {sale.item} · {sale.date}</p></div><span className="text-sm font-semibold">{formatNaira(sale.amount)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sale.status === "Credit" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{sale.status}</span></div>)}</div>
    </div>
  );
}

function CustomersSection() {
  return <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="border-b border-orange-100 px-4 py-3 text-sm font-medium">Customer list</div><div className="divide-y divide-orange-100">{businessData.customers.map((customer) => <div key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="flex size-10 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">{customer.name.charAt(0)}</div><div className="min-w-0 flex-1"><p className="font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone} · Last purchase {customer.lastPurchase}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatNaira(customer.outstanding)}</p><p className="text-xs text-muted-foreground">Outstanding</p></div></div>)}</div></div>;
}

function InventorySection() {
  return <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{businessData.products.map((product) => { const low = product.quantity <= product.reorderLevel; return <div key={product.id} className="rounded-2xl border border-orange-100 bg-white p-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconBox className="size-4" /></span><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{low ? "Low stock" : "Healthy"}</span></div><p className="mt-5 font-medium">{product.name}</p><p className="mt-1 text-2xl font-semibold">{product.quantity}</p><p className="text-xs text-muted-foreground">{product.unit} · reorder at {product.reorderLevel}</p></div>; })}</div>;
}

function ExpensesSection() {
  const total = businessData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categories = new Set(businessData.expenses.map((expense) => expense.category)).size;
  return <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white"><div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4 sm:grid-cols-3"><Metric label="Total" value={formatNaira(total)} /><Metric label="Categories" value={String(categories)} /><Metric label="Entries" value={String(businessData.expenses.length)} /></div><div className="divide-y divide-orange-100">{businessData.expenses.map((expense) => <div key={expense.id} className="flex items-center gap-3 px-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{expense.category} · {expense.date}</p></div><span className="text-sm font-semibold">{formatNaira(expense.amount)}</span></div>)}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-orange-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
