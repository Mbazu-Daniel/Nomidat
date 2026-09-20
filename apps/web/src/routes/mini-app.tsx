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
import { useEffect, useState } from "react";
import {
  OrganizationSwitcher,
  type OrganizationOption,
} from "@/components/nomidat/organization-switcher";
import { StatCard } from "@/components/nomidat/stat-card";
import { ActivityRow } from "@/components/nomidat/activity-row";
import { createTelegramSession } from "@/lib/telegram-session";
import "@/lib/types/telegram-web-app.type";

export const Route = createFileRoute("/mini-app")({
  component: MiniAppPage,
  head: () => ({
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
  }),
});

function MiniAppPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Opening Telegram session…");
  const [userName, setUserName] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState("demo");

  const organizations: OrganizationOption[] = [
    { id: "demo", name: "My Business" },
    { id: "second", name: "Second Business" },
  ];

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

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-sm text-muted-foreground">
        {message}
      </div>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <IconSparkles className="size-7" />
          </div>
          <h1 className="text-xl font-semibold">Open Nomidat in Telegram</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] pb-28 text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-600">
              nomidat
            </p>
            <p className="mt-1 truncate text-lg font-semibold">
              Hi, {userName ?? "there"} 👋
            </p>
          </div>
          <OrganizationSwitcher
            organizations={organizations}
            currentOrganizationId={organizationId}
            onChange={setOrganizationId}
          />
        </header>

        <section className="mt-6 rounded-[28px] bg-orange-500 p-5 text-white shadow-[0_16px_40px_rgba(234,88,12,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-orange-100">Today's sales</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">₦245,000</p>
              <p className="mt-1 text-xs text-orange-100">12 transactions today</p>
            </div>
            <span className="rounded-full bg-white/15 p-2">
              <IconArrowUpRight className="size-5" />
            </span>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-white/15 px-2.5 py-1">+12.4%</span>
            <span className="text-orange-100">from yesterday</span>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <StatCard
            label="Credit owed"
            value="₦82,500"
            detail="4 customers"
            icon={<IconCreditCard className="size-4" />}
          />
          <StatCard
            label="Expenses"
            value="₦41,200"
            detail="Today"
            icon={<IconWallet className="size-4" />}
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Quick actions</h2>
            <button type="button" className="text-xs font-medium text-orange-600">
              See all
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Sale", IconReceipt],
              ["Expense", IconWallet],
              ["Customer", IconUsers],
              ["Stock", IconPackage],
            ].map(([label, Icon]) => (
              <button
                key={String(label)}
                type="button"
                className="flex flex-col items-center gap-2 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm active:scale-[0.98]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <Icon className="size-5" />
                </span>
                <span className="text-[11px] font-medium">{String(label)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Ask Nomidat</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Record sales, expenses or check your business.
              </p>
            </div>
            <button
              type="button"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-md"
            >
              <IconSparkles className="size-5" />
            </button>
          </div>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-orange-50 px-3 py-3 text-left text-sm text-orange-800"
          >
            <span>“I sold 5 bags of cement…”</span>
            <IconChevronRight className="size-4" />
          </button>
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent activity</h2>
            <button type="button" className="text-xs font-medium text-orange-600">
              View all
            </button>
          </div>
          <div className="divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white px-3">
            <ActivityRow
              icon={<IconReceipt className="size-5" />}
              title="Sale to Chinedu"
              description="5 bags of cement · Credit"
              amount="₦42,500"
              status="Credit"
            />
            <ActivityRow
              icon={<IconWallet className="size-5" />}
              title="Fuel expense"
              description="Today · Business expense"
              amount="₦18,000"
            />
            <ActivityRow
              icon={<IconUsers className="size-5" />}
              title="New customer"
              description="Amaka · Added today"
            />
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {[
            ["Home", IconChartDonut],
            ["Sales", IconReceipt],
            ["Customers", IconUsers],
            ["More", IconPackage],
          ].map(([label, Icon], index) => (
            <button
              key={String(label)}
              type="button"
              className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] ${index === 0 ? "bg-orange-50 text-orange-700" : "text-muted-foreground"}`}
            >
              <Icon className="size-4" />
              {String(label)}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
