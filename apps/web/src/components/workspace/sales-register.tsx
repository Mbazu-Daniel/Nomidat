import { IconArrowUpRight } from "@tabler/icons-react";
import { formatInvoiceMoney } from "./invoice-format";
import type { SalesRegisterProps } from "./types/workspace.type";
import "./sales-register.css";

export function SalesRegister({ rows, onSelect }: SalesRegisterProps) {
  return (
    <div className="workspace-table-scroll sales-register">
      <table>
        <thead>
          <tr>
            <th>Sale / customer</th>
            <th>Items</th>
            <th className="sales-money">Total</th>
            <th className="sales-money">Paid</th>
            <th className="sales-money">Balance</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Open sale</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = row.totalKobo ?? 0;
            const paid = row.paidKobo ?? 0;
            const balance = row.balanceKobo ?? Math.max(0, total - paid);
            const status =
              row.status === "cancelled"
                ? "Cancelled"
                : balance === 0
                  ? "Paid"
                  : paid > 0
                    ? "Partially paid"
                    : "Unpaid";
            const reference =
              row.saleReference ?? `SALE-${row.id.replaceAll("-", "").slice(-12).toUpperCase()}`;
            return (
              <tr key={row.id}>
                <td>
                  <button
                    className="workspace-record-name"
                    title={row.id}
                    onClick={() => onSelect(row)}
                  >
                    {reference}
                  </button>
                  <span className="sales-customer">{row.customer ?? "Walk-in customer"}</span>
                  <small>
                    {new Date(row.createdAt).toLocaleDateString("en-NG", {
                      timeZone: "Africa/Lagos",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                </td>
                <td className="sales-items" data-label="Items">
                  {row.saleItems?.length ? (
                    <>
                      {row.saleItems.slice(0, 2).map((item, index) => (
                        <span key={index}>
                          {item.productName} × {item.quantity}
                        </span>
                      ))}
                      {row.saleItems.length > 2 && (
                        <small>+{row.saleItems.length - 2} more items</small>
                      )}
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="sales-money" data-label="Total">
                  {formatInvoiceMoney(total)}
                </td>
                <td className="sales-money" data-label="Paid">
                  {formatInvoiceMoney(paid)}
                </td>
                <td
                  data-label="Balance"
                  className={`sales-money ${balance > 0 ? "sales-owed" : ""}`}
                >
                  {formatInvoiceMoney(balance)}
                </td>
                <td data-label="Status">
                  <span
                    data-status={status}
                    className={`sales-status ${status === "Paid" ? "paid" : status === "Cancelled" ? "cancelled" : "owing"}`}
                  >
                    {status}
                  </span>
                </td>
                <td>
                  <button
                    aria-label={`Open sale ${reference}`}
                    className="workspace-icon-button"
                    onClick={() => onSelect(row)}
                  >
                    <IconArrowUpRight size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
