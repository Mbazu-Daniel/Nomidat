import { Link } from "@tanstack/react-router";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBell,
  IconBox,
  IconChevronRight,
  IconCreditCard,
  IconLayoutDashboard,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { StatCard } from "@/components/nomidat/stat-card";
import { Button } from "@/components/ui/button";
import { formatNaira, getBusinessData, type BusinessSummary } from "@/data/nomidat";

type Row = Awaited<ReturnType<typeof getBusinessData>>;

type Props = {
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
  summary: BusinessSummary | null;
  sales: Row;
  expenses: Row;
  loading: boolean;
  error: string | null;
};

export function DashboardView(props: Props) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <Sidebar {...props} />
        <section className="min-w-0 flex-1">
          <DashboardHeader {...props} />
          <DashboardBody {...props} />
        </section>
      </div>
    </main>
  );
}

function Sidebar({ organizations, organizationId, onOrganizationChange }: Props) {
  const nav = [
    ["Overview", IconLayoutDashboard, "/"],
    ["Sales", IconReceipt, "/sales"],
    ["Customers", IconUsers, "/customers"],
    ["Inventory", IconPackage, "/inventory"],
    ["Expenses", IconWallet, "/expenses"],
  ] as const;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-orange-100 bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b border-orange-100 px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-sm font-bold text-white">
            n
          </span>
          <span className="text-lg font-semibold tracking-tight">nomidat</span>
        </div>
      </div>
      <div className="p-4">
        {organizations.length > 0 ? (
          <OrganizationSwitcher
            organizations={organizations}
            currentOrganizationId={organizationId}
            onChange={onOrganizationChange}
          />
        ) : (
          <div className="rounded-xl bg-orange-50 p-3 text-xs text-muted-foreground">
            Loading businesses…
          </div>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {nav.map(([label, Icon, to]) => (
          <Link
            key={label}
            to={to}
            className={
              label === "Overview"
                ? "flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-700"
                : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-orange-50 hover:text-foreground"
            }
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-orange-100 p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-orange-50 hover:text-foreground"
        >
          <IconSettings className="size-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}

function DashboardHeader({
  organizations,
  organizationId,
  onOrganizationChange,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-background/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Overview</p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            Good afternoon 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            {organizations.length > 0 ? (
              <OrganizationSwitcher
                organizations={organizations}
                currentOrganizationId={organizationId}
                onChange={onOrganizationChange}
              />
            ) : null}
          </div>
          <Button variant="outline" size="icon" aria-label="Notifications">
            <IconBell />
          </Button>
          <Button className="hidden sm:inline-flex">
            <IconPlus data-icon="inline-start" />
            Record sale
          </Button>
        </div>
      </div>
    </header>
  );
}

function DashboardBody({
  organizations,
  organizationId,
  summary,
  sales,
  expenses,
  loading,
  error,
}: Props) {
  const organization = organizations.find((item) => item.id === organizationId);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Your business</p>
        <h2 className="mt-1 text-lg font-semibold">
          {organization?.name ?? "Your business"}
        </h2>
      </div>
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {!loading && organizations.length === 0 ? <EmptyBusiness /> : null}
      <DashboardStats summary={summary} />
      <DashboardActivity
        loading={loading}
        sales={sales}
        expenses={expenses}
        summary={summary}
      />
    </div>
  );
}

function EmptyBusiness() {
  return (
    <div className="mb-6 rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-muted-foreground">
      Create a business to start recording sales, expenses and customers.
    </div>
  );
}

function DashboardStats({ summary }: { summary: BusinessSummary | null }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Sales"
        value={formatNaira((summary?.salesTotalKobo ?? 0) / 100)}
        detail="All recorded sales"
        icon={<IconArrowUpRight className="size-4" />}
      />
      <StatCard
        label="Outstanding credit"
        value={formatNaira((summary?.outstandingCreditKobo ?? 0) / 100)}
        detail="Pending customer credit"
        icon={<IconCreditCard className="size-4" />}
      />
      <StatCard
        label="Expenses"
        value={formatNaira((summary?.expensesTotalKobo ?? 0) / 100)}
        detail="All recorded expenses"
        icon={<IconArrowDownRight className="size-4" />}
      />
      <StatCard
        label="Customers"
        value={String(summary?.customerCount ?? 0)}
        detail="Business contacts"
        icon={<IconUsers className="size-4" />}
      />
    </section>
  );
}

function DashboardActivity({
  loading,
  sales,
  expenses,
  summary,
}: {
  loading: boolean;
  sales: Row;
  expenses: Row;
  summary: BusinessSummary | null;
}) {
  return (
    <>
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
        <RecentSales loading={loading} sales={sales} />
        <AskCard />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
        <RecentExpenses loading={loading} expenses={expenses} />
        <InventoryCard summary={summary} />
      </section>
    </>
  );
}

function RecentSales({ loading, sales }: { loading: boolean; sales: Row }) {
  const items = sales.slice(0, 3);

  return (
    <Panel title="Recent sales" link="/sales">
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyText text="No sales recorded yet." />
      ) : (
        items.map((sale) => (
          <ActivityRow
            key={sale.id}
            icon={<IconReceipt className="size-5" />}
            title={sale.customer ?? "Walk-in customer"}
            description={sale.status ?? "Sale"}
            amount={formatNaira((sale.totalKobo ?? 0) / 100)}
            status={sale.status ?? undefined}
          />
        ))
      )}
    </Panel>
  );
}

function RecentExpenses({
  loading,
  expenses,
}: {
  loading: boolean;
  expenses: Row;
}) {
  const items = expenses.slice(0, 2);

  return (
    <Panel title="Recent expenses" link="/expenses">
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyText text="No expenses recorded yet." />
      ) : (
        items.map((expense) => (
          <ActivityRow
            key={expense.id}
            icon={<IconWallet className="size-5" />}
            title={expense.description ?? "Expense"}
            description={expense.category ?? "Uncategorised"}
            amount={formatNaira((expense.amountKobo ?? 0) / 100)}
          />
        ))
      )}
    </Panel>
  );
}

function Panel({
  title,
  link,
  children,
}: {
  title: string;
  link: "/sales" | "/expenses";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold">{title}</h2>
        <Link to={link} className="text-sm font-medium text-orange-700">
          View all
        </Link>
      </div>
      <div className="mt-5 divide-y divide-orange-100">{children}</div>
    </div>
  );
}

function AskCard() {
  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-500 p-5 text-white shadow-[0_12px_32px_rgba(234,88,12,0.18)]">
      <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
        <IconSparkles className="size-5" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">Ask Nomidat</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-orange-100">
        Record business activity or ask questions in plain language.
      </p>
      <div className="mt-6 rounded-xl bg-white/10 px-3 py-3 text-sm">
        “How much do customers owe me?”
      </div>
    </div>
  );
}

function InventoryCard({ summary }: { summary: BusinessSummary | null }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock needing attention.
          </p>
        </div>
        <IconBox className="size-5 text-orange-500" />
      </div>
      <div className="rounded-xl bg-orange-50 p-4">
        <p className="text-sm font-medium">
          {summary?.lowStockCount ?? 0} items need attention
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary?.productCount ?? 0} products tracked
        </p>
        <Link
          to="/inventory"
          className="mt-3 inline-flex text-xs font-medium text-orange-700"
        >
          Open inventory
          <IconChevronRight className="ml-1 size-3" />
        </Link>
      </div>
    </div>
  );
}

function Loading() {
  return <p className="py-8 text-sm text-muted-foreground">Loading…</p>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-8 text-sm text-muted-foreground">{text}</p>;
}
