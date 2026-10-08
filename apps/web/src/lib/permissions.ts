const ADMIN_ONLY_READS = new Set([
  "webhooks.read",
  "activity.read",
  "roles.read",
  "team.read",
  "settlements.read",
  "platform.read",
]);

const WRITER_AREAS: Record<string, readonly string[]> = {
  inventory_writer: [
    "stocks",
    "products",
    "product_categories",
    "warehouses",
    "suppliers",
    "purchase_orders",
  ],
  sales_writer: ["orders", "customers", "payments"],
  expenses_writer: ["expenses"],
  invoices_writer: ["invoices"],
  customers_writer: ["customers"],
  channels_writer: ["channels"],
};

function splitRoles(role: string): string[] {
  return role
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function canAccess(role: string, permission?: string): boolean {
  const roles = splitRoles(role);
  if (roles.length === 0) return false;
  if (!permission) return true;
  if (roles.includes("owner") || roles.includes("admin")) return true;
  const manager = roles.includes("manager");
  const [domain, action] = permission.split(".");
  if (action === "write" || action === "manage") {
    if (manager) return true;
    return roles.some((item) => WRITER_AREAS[item]?.includes(domain));
  }
  if (ADMIN_ONLY_READS.has(permission)) return manager;
  return true;
}
