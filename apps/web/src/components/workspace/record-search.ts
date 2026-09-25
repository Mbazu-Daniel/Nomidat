import type { BusinessRecord } from "./types";
export function matchesRecord(row: BusinessRecord, query: string, filter: string) {
  const text = [
    row.saleReference,
    row.saleItems?.map((item) => item.productName).join(" "),
    row.name,
    row.customer,
    row.description,
    row.invoiceNumber,
    row.phone,
  ].join(" ");
  if (!text.toLowerCase().includes(query.toLowerCase())) return false;
  if (filter === "low") return (row.stockQuantity ?? 0) <= (row.lowStockThreshold ?? 0);
  return filter !== "lead" || row.kind === "lead";
}
