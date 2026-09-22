import { IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getBusinessData, getOrganizations } from "@/data/nomidat";

const sections = {
  sales: { title: "Sales", description: "Track recorded sales and credit transactions.", icon: IconReceipt },
  customers: { title: "Customers", description: "See customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Monitor stock levels and items that need attention.", icon: IconBox },
  expenses: { title: "Expenses", description: "Review business spending by category.", icon: IconWallet },
} as const;

type Section = keyof typeof sections;
type Rows = Awaited<ReturnType<typeof getBusinessData>>;

export function BusinessListPage({ section }: { section: Section }) {
  const { organizations, organizationId, setOrganizationId, rows, loading, error } = useBusinessData(section);
  const config = sections[section];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          config={config}
          organizations={organizations}
          organizationId={organizationId}
          onOrganizationChange={setOrganizationId}
        />
        <PageStatus error={error} organizationId={organizationId} loading={loading} title={config.title} />
        {!loading && organizationId ? <SectionContent section={section} rows={rows} /> : null}
      </div>
    </main>
  );
}

function useBusinessData(section: Section) {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [rows, setRows] = useState<Rows>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOrganizations()
      .then((result) => {
        if (cancelled) return;
        const options = result.map(({ id, name }) => ({ id, name }));
        setOrganizations(options);
        setOrganizationId((current) => current || options[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your businesses.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getBusinessData(organizationId, section)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError("Could not load this business data.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, section]);

  return { organizations, organizationId, setOrganizationId, rows, loading, error };
}

function PageHeader({
  config,
  organizations,
  organizationId,
  onOrganizationChange,
}: {
  config: (typeof sections)[Section];
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
}) {
  const Icon = config.icon;
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
          <Icon className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      </div>
      {organizations.length > 0 ? (
        <OrganizationSwitcher
          organizations={organizations}
          currentOrganizationId={organizationId}
          onChange={onOrganizationChange}
        />
      ) : null}
    </div>
  );
}

function PageStatus({
  error,
  organizationId,
  loading,
  title,
}: {
  error: string | null;
  organizationId: string;
  loading: boolean;
  title: string;
}) {
  return (
    <>
      <ErrorMessage error={error} />
      <NoBusinessMessage visible={!organizationId && !error} />
      <LoadingMessage visible={loading} title={title} />
    </>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
}

function NoBusinessMessage({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">
      No business found. Create a business to get started.
    </div>
  );
}

function LoadingMessage({ visible, title }: { visible: boolean; title: string }) {
  if (!visible) return null;
  return (
    <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">
      Loading {title.toLowerCase()}…
    </div>
  );
}

const sectionComponents: Record<Section, ({ rows }: { rows: Rows }) => ReactNode> = {
  sales: SalesSection,
  customers: CustomersSection,
  inventory: InventorySection,
  expenses: ExpensesSection,
};

function SectionContent({ section, rows }: { section: Section; rows: Rows }) {
  const Component = sectionComponents[section];
  return <Component rows={rows} />;
}

function SalesSection({ rows }: { rows: Rows }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4">
        <Metric label="Recent transactions" value={String(rows.length)} />
        <Metric label="Recent revenue" value={formatNaira(rows.reduce((sum, row) => sum + (row.totalKobo ?? 0), 0) / 100)} />
      </div>
      <div className="divide-y divide-orange-100">
        {rows.length === 0 ? (
          <EmptyState label="No sales recorded yet." action="Record sale" />
        ) : (
          rows.map((sale) => <SalesRow key={sale.id} sale={sale} />)
        )}
      </div>
    </div>
  );
}

function SalesRow({ sale }: { sale: Rows[number] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{sale.customer ?? "Walk-in customer"}</p>
        <p className="text-xs text-muted-foreground">
          {sale.status ?? "Sale"} · {sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "Recent"}
        </p>
      </div>
      <span className="text-sm font-semibold">{formatNaira((sale.totalKobo ?? 0) / 100)}</span>
      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{sale.status ?? "Recorded"}</span>
    </div>
  );
}

function CustomersSection({ rows }: { rows: Rows }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="border-b border-orange-100 px-4 py-3 text-sm font-medium">Customer list</div>
      <div className="divide-y divide-orange-100">
        {rows.length === 0 ? (
          <EmptyState label="No customers recorded yet." action="Add customer" />
        ) : (
          rows.map((customer) => <CustomerRow key={customer.id} customer={customer} />)
        )}
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: Rows[number] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4">
      <div className="flex size-10 items-center justify-center rounded-full bg-orange-50 font-semibold text-orange-700">
        {customer.name?.charAt(0) ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{customer.name ?? "Unnamed customer"}</p>
        <p className="text-xs text-muted-foreground">{customer.phone ?? "No phone number"}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{formatNaira((customer.outstandingKobo ?? 0) / 100)}</p>
        <p className="text-xs text-muted-foreground">Balance</p>
      </div>
    </div>
  );
}

function InventorySection({ rows }: { rows: Rows }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.length === 0 ? (
        <EmptyState label="No products recorded yet." action="Add product" />
      ) : (
        rows.map((item) => <InventoryCard key={item.id} item={item} />)
      )}
    </div>
  );
}

function InventoryCard({ item }: { item: Rows[number] }) {
  const low = (item.stockQuantity ?? 0) <= (item.lowStockThreshold ?? 0);
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <IconBox className="size-4" />
        </span>
        <span className={low ? "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800" : "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800"}>
          {low ? "Low stock" : "Healthy"}
        </span>
      </div>
      <p className="mt-5 font-medium">{item.name}</p>
      <p className="mt-1 text-2xl font-semibold">{item.stockQuantity ?? 0}</p>
      <p className="text-xs text-muted-foreground">{item.unit ?? "units"} · reorder at {item.lowStockThreshold ?? 0}</p>
    </div>
  );
}

function ExpensesSection({ rows }: { rows: Rows }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="grid grid-cols-2 gap-3 border-b border-orange-100 p-4">
        <Metric label="Recent total" value={formatNaira(rows.reduce((sum, row) => sum + (row.amountKobo ?? 0), 0) / 100)} />
        <Metric label="Entries" value={String(rows.length)} />
      </div>
      <div className="divide-y divide-orange-100">
        {rows.length === 0 ? (
          <EmptyState label="No expenses recorded yet." action="Record expense" />
        ) : (
          rows.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense }: { expense: Rows[number] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
        <IconWallet className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{expense.description ?? "Expense"}</p>
        <p className="text-xs text-muted-foreground">
          {expense.category ?? "Uncategorised"} · {expense.spentAt ? new Date(expense.spentAt).toLocaleString() : "Recent"}
        </p>
      </div>
      <span className="text-sm font-semibold">{formatNaira((expense.amountKobo ?? 0) / 100)}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-orange-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function EmptyState({ label, action }: { label: string; action: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <button type="button" className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white">{action}</button>
    </div>
  );
}
