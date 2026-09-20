import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useState } from "react";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { StatCard } from "@/components/nomidat/stat-card";
import { Button } from "@/components/ui/button";
import { businessData, formatNaira } from "@/data/nomidat";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

const organizations: OrganizationOption[] = [
  { id: "demo", name: "My Business" },
  { id: "second", name: "Second Business" },
];

const navItems = [
  { label: "Overview", icon: IconLayoutDashboard },
  { label: "Sales", icon: IconReceipt, to: "/sales" },
  { label: "Customers", icon: IconUsers, to: "/customers" },
  { label: "Inventory", icon: IconPackage, to: "/inventory" },
  { label: "Expenses", icon: IconWallet, to: "/expenses" },
];

const sales = [
  { day: "Mon", value: 62 },
  { day: "Tue", value: 78 },
  { day: "Wed", value: 54 },
  { day: "Thu", value: 86 },
  { day: "Fri", value: 72 },
  { day: "Sat", value: 94 },
  { day: "Sun", value: 68 },
];

function DashboardPage() {
  const [organizationId, setOrganizationId] = useState("demo");
  const [activeNav] = useState("Overview");

  const organization =
    organizations.find((item) => item.id === organizationId) ?? organizations[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
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
            <OrganizationSwitcher
              organizations={organizations}
              currentOrganizationId={organizationId}
              onChange={setOrganizationId}
            />
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {navItems.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${activeNav === label ? "bg-orange-50 text-orange-700" : "text-muted-foreground hover:bg-orange-50 hover:text-foreground"}`}
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

        <section className="min-w-0 flex-1">
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
                  <OrganizationSwitcher
                    organizations={organizations}
                    currentOrganizationId={organizationId}
                    onChange={setOrganizationId}
                  />
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

          <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Your business</p>
                <h2 className="mt-1 text-lg font-semibold">{organization.name}</h2>
              </div>
              <Button variant="outline" className="hidden sm:inline-flex">
                Last 7 days
                <IconChevronRight data-icon="inline-end" />
              </Button>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Sales" value={formatNaira(businessData.sales.reduce((sum, sale) => sum + sale.amount, 0))} detail="Recorded sales" icon={<IconArrowUpRight className="size-4" />} />
              <StatCard label="Outstanding credit" value={formatNaira(businessData.customers.reduce((sum, customer) => sum + customer.outstanding, 0))} detail="Customers with balances" icon={<IconCreditCard className="size-4" />} />
              <StatCard label="Expenses" value={formatNaira(businessData.expenses.reduce((sum, expense) => sum + expense.amount, 0))} detail="Recorded expenses" icon={<IconArrowDownRight className="size-4" />} />
              <StatCard label="Customers" value={String(businessData.customers.length)} detail="Active customers" icon={<IconUsers className="size-4" />} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">Sales overview</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Revenue recorded across your business.</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">₦1.84m</span>
                </div>
                <div className="mt-8 flex h-56 items-end gap-2 sm:gap-4">
                  {sales.map((item) => (
                    <div key={item.day} className="flex h-full flex-1 flex-col justify-end gap-2">
                      <div className="flex h-full items-end">
                        <div
                          className="w-full rounded-t-lg bg-orange-400/80 transition-all hover:bg-orange-500"
                          style={{ height: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-center text-xs text-muted-foreground">{item.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-500 p-5 text-white shadow-[0_12px_32px_rgba(234,88,12,0.18)]">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                  <IconSparkles className="size-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">Ask Nomidat</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-orange-100">
                  Record business activity or ask questions in plain language.
                </p>
                <button type="button" className="mt-6 flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-3 text-left text-sm hover:bg-white/15">
                  <span>“How much do customers owe me?”</span>
                  <IconChevronRight className="size-4" />
                </button>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Recent activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Latest sales, expenses and customer activity.</p>
                  </div>
                  <Button variant="ghost" size="sm">View all</Button>
                </div>
                <div className="divide-y divide-orange-100">
                  <ActivityRow icon={<IconReceipt className="size-5" />} title="Sale to Chinedu" description="5 bags of cement · Credit" amount="₦42,500" status="Credit" />
                  <ActivityRow icon={<IconWallet className="size-5" />} title="Fuel expense" description="Today · Business expense" amount="₦18,000" />
                  <ActivityRow icon={<IconUsers className="size-5" />} title="New customer" description="Amaka · Added today" />
                </div>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-[0_2px_12px_rgba(124,45,18,0.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Inventory</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Items needing attention.</p>
                  </div>
                  <IconBox className="size-5 text-orange-500" />
                </div>
                <div className="space-y-3">
                  {[
                    ["Cement", "12 bags left", "Low stock"],
                    ["Diesel", "48 litres left", "Healthy"],
                    ["Iron rods", "6 pieces left", "Low stock"],
                  ].map(([name, quantity, status]) => (
                    <div key={name} className="flex items-center justify-between gap-4 rounded-xl bg-orange-50/70 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{quantity}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                        status === "Low stock" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
