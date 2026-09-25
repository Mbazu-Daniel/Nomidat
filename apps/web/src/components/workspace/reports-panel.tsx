import { useEffect, useState } from "react";
import {
  IconCalendar,
  IconRefresh,
  IconReceipt,
  IconWallet,
  IconArrowDownLeft,
  IconChartBar,
  IconCreditCard,
  IconTrendingUp,
} from "@tabler/icons-react";
import {
  formatNaira,
  getReportSummary,
  getReportSales,
  getReportExpenseBreakdown,
  getReportProducts,
  getReportCustomerBalances,
  getReportInventory,
} from "@/data/nomidat";
import type { ReportsData, ReportsPanelProps } from "./types/reports.type";
import { ReportCharts } from "./report-charts";
import { ReportBreakdowns } from "./report-breakdowns";
import "./reports.css";

export function ReportsPanel({ organizationId }: ReportsPanelProps) {
  const [days, setDays] = useState(30);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [productLimit, setProductLimit] = useState(10);
  const [customerLimit, setCustomerLimit] = useState(20);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (days === 0 && (!from || !to || from > to)) {
      setError("Choose a valid date range.");
      setLoading(false);
      return;
    }
    const range = days || { from, to };
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([
      getReportSummary(organizationId, range),
      getReportSales(organizationId, range),
      getReportExpenseBreakdown(organizationId, range),
      getReportProducts(organizationId, range, productLimit),
      getReportCustomerBalances(organizationId, customerLimit),
      getReportInventory(organizationId),
    ])
      .then(([summary, sales, expenses, products, customers, inventory]) => {
        if (!cancelled) setData({ summary, sales, expenses, products, customers, inventory });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your reports. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, days, from, to, productLimit, customerLimit, version]);
  const metrics = data
    ? [
        {
          label: "Recorded sales",
          amount: data.summary.salesKobo,
          detail: `Sales recorded: ${data.summary.salesCount}`,
          icon: IconReceipt,
        },
        {
          label: "Money collected",
          amount: data.summary.collectedKobo,
          detail: `Payments received: ${data.summary.paymentCount}`,
          icon: IconArrowDownLeft,
        },
        {
          label: "Business expenses",
          amount: data.summary.expensesKobo,
          detail: `Expenses recorded: ${data.summary.expenseCount}`,
          icon: IconWallet,
        },
        {
          label: "Net cash flow",
          amount: data.summary.netCashflowKobo,
          detail: "Collections minus expenses",
          icon: IconTrendingUp,
        },
        {
          label: "Approximate profit",
          amount: data.summary.profitApproxKobo,
          detail: "Sales less product costs and expenses",
          icon: IconChartBar,
        },
        {
          label: "Outstanding credit",
          amount: data.summary.outstandingCreditKobo,
          detail: "Current balance across all sales",
          icon: IconCreditCard,
        },
      ]
    : [];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Reports & insights</h1>
          <p>See what’s selling, where money goes, and what needs your attention.</p>
        </div>
        <div className="report-controls">
          <label>
            <IconCalendar size={17} />
            <select
              aria-label="Report period"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={0}>Custom dates</option>
            </select>
          </label>
          <button
            className="workspace-secondary"
            aria-label="Refresh reports"
            disabled={loading}
            onClick={() => setVersion((value) => value + 1)}
          >
            <IconRefresh size={17} />
          </button>
        </div>
      </div>
      <div className="workspace-actions report-range-controls">
        {days === 0 && (
          <>
            <label>
              From{" "}
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Top products{" "}
          <select value={productLimit} onChange={(e) => setProductLimit(Number(e.target.value))}>
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customers owing{" "}
          <select value={customerLimit} onChange={(e) => setCustomerLimit(Number(e.target.value))}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <div className="workspace-error" role="alert">
          {error}
          <button className="workspace-secondary" onClick={() => setVersion((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="workspace-card workspace-empty" role="status">
          Preparing your business reports…
        </div>
      ) : (
        !error &&
        data && (
          <>
            <div className="report-period-caption">
              <span className="workspace-dot" />
              {new Date(data.summary.from).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              —{" "}
              {new Date(data.summary.to).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              <span>All amounts in NGN</span>
            </div>
            <section className="report-metrics" aria-label="Financial summary">
              {metrics.map((metric) => (
                <div className="workspace-stat" key={metric.label}>
                  <div>
                    {metric.label}
                    <metric.icon size={18} />
                  </div>
                  <strong>{formatNaira(metric.amount / 100)}</strong>
                  <p>{metric.detail}</p>
                </div>
              ))}
            </section>
            <ReportCharts sales={data.sales} expenses={data.expenses} />
            <ReportBreakdowns
              products={data.products}
              customers={data.customers}
              inventory={data.inventory}
            />
          </>
        )
      )}
    </>
  );
}
