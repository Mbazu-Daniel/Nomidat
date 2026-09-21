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

type ReportsData = {
  summary: ReportSummary | null;
  sales: Awaited<ReturnType<typeof getReportSales>>;
  expenses: Awaited<ReturnType<typeof getReportExpenseBreakdown>>;
  products: Awaited<ReturnType<typeof getReportProducts>>;
  customers: Awaited<ReturnType<typeof getReportCustomerBalances>>;
  inventory: Awaited<ReturnType<typeof getReportInventory>> | null;
  loading: boolean;
  error: string | null;
};

function useReportsData(organizationId: string): ReportsData {
  const [data, setData] = useState<ReportsData>({
    summary: null,
    sales: [],
    expenses: [],
    products: [],
    customers: [],
    inventory: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setData((current) => ({ ...current, loading: true, error: null }));

    void Promise.all([
      getReportSummary(organizationId),
      getReportSales(organizationId),
      getReportExpenseBreakdown(organizationId),
      getReportProducts(organizationId),
      getReportCustomerBalances(organizationId),
      getReportInventory(organizationId),
    ])
      .then(([summary, sales, expenses, products, customers, inventory]) => {
        if (!cancelled) {
          setData({ summary, sales, expenses, products, customers, inventory, loading: false, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) setData((current) => ({ ...current, loading: false, error: "Could not load your reports." }));
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return data;
}

function ReportsPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const data = useReportsData(organizationId);

  useEffect(() => {
    void getOrganizations()
      .then((items) => {
        const options = items.map((organization) => ({ id: organization.id, name: organization.name }));
        setOrganizations(options);
        setOrganizationId((current) => current || options[0]?.id || "");
      })
      .catch(() => {
        setOrganizations([]);
      });
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ReportsHeader organizations={organizations} organizationId={organizationId} onOrganizationChange={setOrganizationId} />
        {data.error ? <ErrorMessage message={data.error} /> : null}
        <ReportsContent {...data} />
      </div>
    </main>
  );
}

function ReportsHeader({
  organizations,
  organizationId,
  onOrganizationChange,
}: {
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
}) {
  return (
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
          onChange={onOrganizationChange}
        />
      ) : null}
    </header>
  );
}

function ReportsContent(data: ReportsData) {
  if (data.loading) {
    return <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">Loading reports…</div>;
  }
  if (!data.summary) return null;

  return (
    <>
      <Metrics summary={data.summary} />
      <ReportGrid
        sales={data.sales}
        expenses={data.expenses}
        products={data.products}
        customers={data.customers}
        inventory={data.inventory}
      />
    </>
  );
}

function Metrics({ summary }: { summary: ReportSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metric icon={<IconReceipt className="size-4" />} label="Sales" value={formatNaira(summary.salesKobo / 100)} />
      <Metric icon={<IconWallet className="size-4" />} label="Collected" value={formatNaira(summary.collectedKobo / 100)} />
      <Metric icon={<IconCreditCard className="size-4" />} label="Outstanding" value={formatNaira(summary.outstandingCreditKobo / 100)} />
      <Metric icon={<IconWallet className="size-4" />} label="Profit approx." value={formatNaira(summary.profitApproxKobo / 100)} />
      <Metric icon={<IconWallet className="size-4" />} label="Net cash flow" value={formatNaira(summary.netCashflowKobo / 100)} />
    </section>
  );
}

function ReportGrid({
  sales,
  expenses,
  products,
  customers,
  inventory,
}: Pick<ReportsData, "sales" | "expenses" | "products" | "customers" | "inventory">) {
  return (
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
            <Row label="Inventory value" value={formatNaira(inventory.inventoryValueKobo / 100)} />
            {inventory.lowStock.slice(0, 5).map((item) => (
              <Row key={item.id} label={item.name} value={`${item.stockQuantity} ${item.unit}`} detail={`Reorder at ${item.lowStockThreshold}`} />
            ))}
          </>
        ) : <Empty label="No inventory data." />}
      </ReportCard>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-orange-100 bg-white p-4"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function ReportCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-orange-100 bg-white p-4"><h2 className="font-semibold">{title}</h2><div className="mt-3 divide-y divide-orange-100">{children}</div></section>;
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{label}</p>{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}</div><span className="text-sm font-semibold">{value}</span></div>;
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{label}</p>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}
