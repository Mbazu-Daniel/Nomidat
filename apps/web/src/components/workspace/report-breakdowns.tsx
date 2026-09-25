import { Link } from "@tanstack/react-router";
import { IconArrowUpRight } from "@tabler/icons-react";
import { formatNaira } from "@/data/nomidat";
import { ReportCard } from "./report-card";
import type { ReportsData } from "./types/reports.type";
export function ReportBreakdowns({
  products,
  customers,
  inventory,
}: Pick<ReportsData, "products" | "customers" | "inventory">) {
  return (
    <>
      <div className="report-chart-grid">
        <ReportCard
          title="Best-selling products"
          subtitle="Ranked by recorded sales in this period"
        >
          {products.length === 0 ? (
            <p className="report-empty">No product sales in this period.</p>
          ) : (
            <div className="workspace-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units sold</th>
                    <th>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((row, index) => (
                    <tr key={row.productId ?? row.productName}>
                      <td>
                        <span className="report-rank">{String(index + 1).padStart(2, "0")}</span>
                        {row.productName}
                      </td>
                      <td>{row.quantity}</td>
                      <td>{formatNaira(row.salesKobo / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>
        <ReportCard title="Customers owing" subtitle="Current outstanding balances · all time">
          {customers.length === 0 ? (
            <p className="report-empty">You’re all caught up. No outstanding customer balances.</p>
          ) : (
            <div className="report-customer-list">
              {customers.map((row) => (
                <div key={row.customerId}>
                  <span className="report-avatar">{row.customerName.charAt(0).toUpperCase()}</span>
                  <strong>{row.customerName}</strong>
                  <span>{formatNaira(row.balanceKobo / 100)}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/customers" className="report-card-link">
            View your contacts <IconArrowUpRight size={16} />
          </Link>
        </ReportCard>
      </div>
      <ReportCard
        title="Inventory health"
        subtitle="A snapshot of your stock right now"
        className="report-inventory"
      >
        <div className="report-stock-stats">
          <div>
            <span>Products</span>
            <strong>{inventory.productCount}</strong>
          </div>
          <div>
            <span>Low stock</span>
            <strong>{inventory.lowStockCount}</strong>
          </div>
          <div>
            <span>Out of stock</span>
            <strong>{inventory.outOfStockCount}</strong>
          </div>
          <div>
            <span>Inventory value</span>
            <strong>{formatNaira(inventory.inventoryValueKobo / 100)}</strong>
          </div>
        </div>
        {inventory.lowStock.length > 0 && (
          <div className="report-stock-alert">
            <div>
              <span className="workspace-eyebrow">TIME TO RESTOCK</span>
              <p>Keep these products ready for your next sale.</p>
            </div>
            <div>
              {inventory.lowStock.slice(0, 5).map((item) => (
                <span className="report-stock-chip" key={item.id}>
                  {item.name}
                  <strong>
                    {item.stockQuantity} {item.unit}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        )}
        <Link to="/inventory" className="report-card-link">
          Manage inventory <IconArrowUpRight size={16} />
        </Link>
      </ReportCard>
    </>
  );
}
