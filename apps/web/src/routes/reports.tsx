import { createFileRoute } from "@tanstack/react-router";
import { IconChartBar, IconCreditCard, IconReceipt, IconWallet } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import {
  formatNaira,
  getOrganizations,
  getReportCustomerBalances,
  getReportExpenseBreakdown,
  getReportInventory,
  getReportProducts,
  getReportSummary,
  getReportSales,
  type ReportSummary,
} from "@/data/nomidat";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getReportSales>>>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof getReportExpenseBreakdown>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof getReportProducts>>>([]);
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof getReportCustomerBalances>>>([]);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getReportInventory>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOrganizations()
      .then((items) => {
        const options = items.map((organization) => ({ id: organization.id, name: organization.name }));
        setOrganizations(options);
        setOrganizationId((current) => current || options[0]?.id || "");
      })
      .catch(() => setError("Could not load your businesses."));
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      getReportSummary(organizationId),
      getReportSales(organizationId),
      getReportExpenseBreakdown(organizationId),
      getReportProducts(organizationId),
      getReportCustomerBalances(organizationId),
      getReportInventory(organizationId),
    ])
      .then(([nextSummary, nextSales, nextExpenses, nextProducts, nextCustomers, nextInventory]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setSales(nextSales);
        setExpenses(nextExpenses);
        setProducts(nextProducts);
        setCustomers(nextCustomers);
        setInventory(nextInventory);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your reports.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <IconChartBar className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">Last 30 days of sales, collections, expenses and inventory.</p>
          </div>
          {organizations.length > 0 ? (
            <OrganizationSwitcher
              organizations={organizations}
              currentOrganizationId={organizationId}
              onChange={setOrganizationId}
            />
          ) : null}
        </header>

        {error ? <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">Loading reports…</div> : null}

        {!loading && summary ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={<IconReceipt className="size-4" />} label="Sales" value={formatNaira(summary.salesKobo / 100)} />
              <Metric icon={<IconWallet className="size-4" />} label="Collected" value={formatNaira(summary.collectedKobo / 100)} />
              <Metric icon={<IconCredit className="size-4" />} label="Outstanding" value={formatNaira(summary.outstandingCreditKobo / 100)} />
              <Metric icon={<IconWallet className="size-4" />} label="Net cash flow" value={formatNaira(summary.netCashflowKobo / 100)} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ReportCard title="Daily sales">
                {sales.length === 0 ? <Empty label="No sales in this period." /> : sales.slice(-10).map((row) => (
                  <Row key={row.date} label={row.date} value={formatNaira(row.salesKobo / 100)} detail={`${row.saleCount} sales`} />
                ))}
              </ReportCard>

              <ReportCard title="Expenses by category">
                {expenses.length === 0 ? <Empty label="No expenses in this period." /> : expenses.slice(0, 8).map((row) => (
                  <Row key={row.category} label={row.category} value={formatNaira(row.amountKobo / 100)} detail={`${row.expenseCount} entries`} />
                ))}
              </ReportCard>

              <ReportCard title="Top products">
                {products.length === 0 ? <Empty label="No product sales in this period." /> : products.map((row) => (
                  <Row key={row.productId ?? row.productName} label={row.productName} value={formatNaira(row.salesKobo / 100)} detail={`${row.quantity} units`} />
                ))}
              </ReportCard>

              <ReportCard title="Customers owing">
                {customers.length === 0 ? <Empty label="No outstanding customer balances." /> : customers.map((row) => (
                  <Row key={row.customerId} label={row.customerName} value={formatNaira(row.balanceKobo / 100)} />
                ))}
              </ReportCard>

              <ReportCard title="Inventory health">
                {inventory ? (
                  <>
                    <Row label="Products" value={String(inventory.productCount)} />
                    <Row label="Low stock" value={String(inventory.lowStockCount)} />
                    <Row label="Out of stock" value={String(inventory.outOfStockCount)} />
                    {inventory.lowStock.slice(0, 5).map((item) => (
                      <Row key={item.id} label={item.name} value={`${item.stockQuantity} ${item.unit}`} detail={`Reorder at ${item.lowStockThreshold}`} />
                    ))}
                  </>
                ) : <Empty label="No inventory data." />}
              </ReportCard>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-orange-100 bg-white p-4"><h2 className="font-semibold">{title}</h2><div className="mt-3 divide-y divide-orange-100">{children}</div></section>;
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{label}</p>{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}</div><span className="text-sm font-semibold">{value}</span></div>;
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{label}</p>;
}
