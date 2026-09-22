import { IconAlertTriangle, IconBox, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, type getBusinessData } from "@/data/nomidat";

type Section = "sales" | "customers" | "inventory" | "expenses";
type Row = Awaited<ReturnType<typeof getBusinessData>>[number];
type Rows = Awaited<ReturnType<typeof getBusinessData>>;
type Props = {
  section: Section;
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
  rows: Rows;
  loading: boolean;
  error: string | null;
};

const sectionMeta: Record<Section, { title: string; description: string; icon: typeof IconReceipt }> = {
  sales: { title: "Sales", description: "Recorded sales for this business.", icon: IconReceipt },
  customers: { title: "Customers", description: "Customers and their outstanding balances.", icon: IconUsers },
  inventory: { title: "Inventory", description: "Products and current stock levels.", icon: IconBox },
  expenses: { title: "Expenses", description: "Recorded business expenses.", icon: IconWallet },
};

export function BusinessListView(props: Props) {
  const meta = sectionMeta[props.section];
  const Icon = meta.icon;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        <BusinessHeader {...props} meta={meta} icon={Icon} />
        {props.error ? <BusinessError message={props.error} /> : null}
        <BusinessRows {...props} meta={meta} icon={Icon} />
      </div>
    </main>
  );
}

type HeaderProps = Props & {
  meta: (typeof sectionMeta)[Section];
  icon: typeof IconReceipt;
};

function BusinessHeader({
  organizations,
  organizationId,
  onOrganizationChange,
  meta,
  icon: Icon,
}: HeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Icon className="size-5" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">Business</p>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
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

function BusinessError({ message }: { message: string }) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <IconAlertTriangle className="size-4 shrink-0" />
      {message}
    </div>
  );
}

type RowsProps = Props & {
  meta: (typeof sectionMeta)[Section];
  icon: typeof IconReceipt;
};

function BusinessRows({ section, rows, loading, meta, icon: Icon }: RowsProps) {
  if (loading) {
    return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="p-10 text-center">
          <Icon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No {meta.title.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">There is no recorded data for this business.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="divide-y">{rows.map((row) => <BusinessRow key={row.id} row={row} section={section} />)}</div>
    </section>
  );
}

function BusinessRow({ row, section }: { row: Row; section: Section }) {
  if (section === "sales") return <SalesRow row={row} />;
  if (section === "customers") return <CustomerRow row={row} />;
  if (section === "inventory") return <InventoryRow row={row} />;
  return <ExpenseRow row={row} />;
}

function RowShell({ title, detail, value }: { title: string; detail: string; value?: string }) {
  return (
    <article className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      {value ? <p className="text-sm font-semibold">{value}</p> : null}
    </article>
  );
}

function SalesRow({ row }: { row: Row }) {
  return (
    <RowShell
      title={row.customer ?? "Walk-in customer"}
      detail={row.status ?? "Sale"}
      value={formatNaira((row.totalKobo ?? 0) / 100)}
    />
  );
}

function CustomerRow({ row }: { row: Row }) {
  return <RowShell title={row.name ?? "Unnamed customer"} detail={row.phone ?? "No phone number"} value={formatNaira((row.outstandingKobo ?? 0) / 100)} />;
}

function InventoryRow({ row }: { row: Row }) {
  const stock = row.stockQuantity ?? 0;
  const unit = row.unit ?? "units";
  return <RowShell title={row.name ?? "Unnamed product"} detail={stock + " " + unit + " in stock"} value={"Reorder at " + (row.lowStockThreshold ?? 0) + " " + unit} />;
}

function ExpenseRow({ row }: { row: Row }) {
  return <RowShell title={row.description ?? "Expense"} detail={row.category ?? "Uncategorised"} value={formatNaira((row.amountKobo ?? 0) / 100)} />;
}
