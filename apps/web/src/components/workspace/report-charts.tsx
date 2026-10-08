import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";
import { ReportCard } from "./report-card";
import type { ReportsData } from "./types/reports.type";
export function ReportCharts({ sales, expenses }: Pick<ReportsData, "sales" | "expenses">) {
  const currency = useCurrency();
  const recent = sales.slice(-14);
  const maxSales = Math.max(1, ...recent.map((row) => row.salesMinor));
  const expensesTotal = expenses.reduce((sum, row) => sum + row.amountMinor, 0);
  return (
    <div className="report-chart-grid">
      <ReportCard title="Sales over time" subtitle="Latest 14 recorded days in the selected period">
        {recent.length === 0 ? (
          <p className="report-empty">
            Sales will appear here when you record your first transaction.
          </p>
        ) : (
          <div className="report-bars" aria-label="Daily sales chart">
            {recent.map((row) => (
              <div className="report-bar-column" key={row.date}>
                <span className="report-bar-value">{formatMoney(row.salesMinor, currency)}</span>
                <div className="report-bar-track">
                  <div
                    className="report-bar"
                    style={{ height: `${(row.salesMinor / maxSales) * 100}%` }}
                    title={`${row.date}: ${formatMoney(row.salesMinor, currency)} · ${row.saleCount} sales`}
                  />
                </div>
                <span className="report-bar-date">
                  {new Date(row.date).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <small>Sales: {row.saleCount}</small>
              </div>
            ))}
          </div>
        )}
      </ReportCard>
      <ReportCard title="Where your money goes" subtitle="Expense categories · top 8 by amount">
        {expenses.length === 0 ? (
          <p className="report-empty">No expenses recorded in this period.</p>
        ) : (
          <div className="report-expenses">
            <div className="report-expense-total">
              <strong>{formatMoney(expensesTotal, currency)}</strong>
              <span>Total spending</span>
            </div>
            {expenses.slice(0, 8).map((row) => (
              <div className="report-expense" key={row.category}>
                <div>
                  <span>{row.category}</span>
                  <strong>{formatMoney(row.amountMinor, currency)}</strong>
                </div>
                <div className="report-progress">
                  <span
                    style={{
                      width: `${expensesTotal ? (row.amountMinor / expensesTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  Entries: {row.expenseCount} ·{" "}
                  {expensesTotal ? Math.round((row.amountMinor / expensesTotal) * 100) : 0}% of
                  spending
                </small>
              </div>
            ))}
          </div>
        )}
      </ReportCard>
    </div>
  );
}
