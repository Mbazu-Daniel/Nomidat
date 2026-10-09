import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";
import { useLoadedResource } from "@/lib/use-api-resource";
import { Link } from "@tanstack/react-router";
import {
  IconArrowUpRight,
  IconBox,
  IconCoin,
  IconPackage,
  IconReceipt,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { getOrganizationSummary } from "@/data/nomidat";
import { getReportProducts, getReportSales } from "@/data/reports";
import { SalesCategoryRing, SalesTrendChart } from "./dashboard-charts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OverviewPanel({ organizationId }: { organizationId: string }) {
  const currency = useCurrency();
  /*
   * The summary drives the tiles and the report endpoints drive the charts. They
   * are requested together so the page fills in one pass, but each report call is
   * settled on its own: a failure there must not blank out the numbers that did
   * load, which awaiting them as one promise would do.
   */
  const loaded = useLoadedResource(
    async () => {
      const [summary, sales, products] = await Promise.all([
        getOrganizationSummary(organizationId),
        getReportSales(organizationId, 30).catch(() => []),
        getReportProducts(organizationId, 30, 5).catch(() => []),
      ]);
      return { summary, sales, products };
    },
    [organizationId],
    null,
  );
  const summary = loaded.data?.summary ?? null;
  const sales = loaded.data?.sales ?? [];
  const products = loaded.data?.products ?? [];
  const error = loaded.error;
  const loading = loaded.loading;

  // Credit and expenses are both money out of the same till, so a business that
  // has spent more than it took shows a real negative rather than a clamped zero.
  const netMinor = summary ? summary.salesTotalMinor - summary.expensesTotalMinor : null;

  const tiles = [
    {
      label: "Recorded sales",
      value: summary ? formatMoney(summary.salesTotalMinor, currency) : "—",
      detail: "Everything sold so far",
      icon: IconReceipt,
    },
    {
      label: "Still to collect",
      value: summary ? formatMoney(summary.outstandingCreditMinor, currency) : "—",
      detail: `${summary?.customerCount ?? "—"} customers on credit`,
      icon: IconUsers,
    },
    {
      label: "Business expenses",
      value: summary ? formatMoney(summary.expensesTotalMinor, currency) : "—",
      detail: "All recorded spending",
      icon: IconWallet,
    },
    {
      label: "Products in stock",
      value: summary?.productCount ?? "—",
      detail: `${summary?.lowStockCount ?? "—"} need a restock`,
      icon: IconPackage,
    },
  ];

  const actions = [
    ["/inventory", "Check your inventory", "Add products and update stock levels"],
    ["/customers", "Get to know your customers", "Contacts, notes and purchase history"],
    ["/invoices", "Put it in writing", "Create an invoice for your next sale"],
    ["/channels", "Take your business with you", "Connect Telegram or WhatsApp"],
  ] as const;

  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Your business, at a glance</h1>
          <p>Keep an eye on what’s selling, what’s owed and what needs a restock.</p>
        </div>
        <Link to="/sales" className="workspace-primary">
          Record a sale <IconArrowUpRight size={18} />
        </Link>
      </div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="gap-1 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardDescription className="flex items-center justify-between text-[0.8125rem]">
                {tile.label}
                <tile.icon size={18} className="text-primary" aria-hidden="true" />
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              {/* Tabular figures so four amounts in a row share one decimal point. */}
              <p className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                {tile.value}
              </p>
              <p className="text-xs text-muted-foreground">{tile.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card className="gap-3 py-5 shadow-none">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Sales over the last 30 days</CardTitle>
            <CardAction>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline"
              >
                Full report <IconArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
            {loading ? (
              <p className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                Loading your sales…
              </p>
            ) : (
              <SalesTrendChart points={sales} />
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 py-5 shadow-none">
          <CardHeader className="px-5">
            <CardTitle className="text-base">What’s selling</CardTitle>
            <CardAction>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline"
              >
                Inventory <IconArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
            {loading ? (
              <p className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : (
              <SalesCategoryRing rows={products} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card className="gap-3 py-5 shadow-none">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Sales after expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5">
            <div className="flex items-center gap-3.5">
              <IconCoin size={22} className="text-primary" aria-hidden="true" />
              <div className="flex flex-col">
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {netMinor === null ? "—" : formatMoney(netMinor, currency)}
                </p>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {netMinor === null
                    ? "Once you record a sale"
                    : netMinor >= 0
                      ? "Left after paying every recorded expense"
                      : "Expenses currently exceed recorded sales"}
                </span>
              </div>
            </div>
            {/*
              Labelled plainly rather than "profit": this ignores cost of goods, so
              calling it profit would overstate the result to the person reading it.
            */}
            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              Recorded sales minus recorded expenses. This is not profit in the accounting sense —
              it ignores what the stock cost you. Open Reports for the full picture.
            </p>
            <Link
              to="/reports"
              className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline"
            >
              See the full breakdown <IconArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card className="gap-3 py-5 shadow-none">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Your daily toolkit</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <div className="flex flex-col gap-1">
              {actions.map(([to, title, description]) => (
                <Link
                  to={to}
                  key={to}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="flex flex-col">
                    <strong className="text-sm font-medium">{title}</strong>
                    <small className="text-xs text-muted-foreground">{description}</small>
                  </span>
                  <IconArrowUpRight
                    size={17}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary && summary.lowStockCount > 0 && (
        <Card className="gap-2 py-5 shadow-none">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconBox size={18} aria-hidden="true" /> Time to restock
            </CardTitle>
            <CardAction>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline"
              >
                Open inventory <IconArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-sm text-muted-foreground">
              {summary.lowStockCount} of your {summary.productCount} products are running low.
              Restock before they sell out.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
