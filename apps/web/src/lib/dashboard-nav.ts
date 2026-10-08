import type { TablerIcon } from "@tabler/icons-react";
import {
  IconChartBar,
  IconFileInvoice,
  IconLayoutDashboard,
  IconMessageCircle,
  IconPackage,
  IconPlug,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconBuildingStore,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { canAccess } from "@/lib/permissions";

export type OrgRoutePath =
  | "/$orgSlug"
  | "/$orgSlug/inventory"
  | "/$orgSlug/customers"
  | "/$orgSlug/sales"
  | "/$orgSlug/pos"
  | "/$orgSlug/expenses"
  | "/$orgSlug/invoices"
  | "/$orgSlug/storefront"
  | "/$orgSlug/chat"
  | "/$orgSlug/channels"
  | "/$orgSlug/reports"
  | "/$orgSlug/settings";

export interface DashboardNavItem {
  section: string;
  label: string;
  to: OrgRoutePath;
  icon: TablerIcon;
  permission: string;
}

export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    section: "overview",
    label: "Overview",
    to: "/$orgSlug",
    icon: IconLayoutDashboard,
    permission: "dashboard.read",
  },
  {
    section: "inventory",
    label: "Inventory",
    to: "/$orgSlug/inventory",
    icon: IconPackage,
    permission: "stocks.read",
  },
  {
    section: "customers",
    label: "Contacts",
    to: "/$orgSlug/customers",
    icon: IconUsers,
    permission: "customers.read",
  },
  {
    section: "sales",
    label: "Sales",
    to: "/$orgSlug/sales",
    icon: IconReceipt,
    permission: "orders.read",
  },
  {
    section: "pos",
    label: "Point of sale",
    to: "/$orgSlug/pos",
    icon: IconShoppingCart,
    permission: "orders.read",
  },
  {
    section: "expenses",
    label: "Expenses",
    to: "/$orgSlug/expenses",
    icon: IconWallet,
    permission: "expenses.read",
  },
  {
    section: "invoices",
    label: "Invoices",
    to: "/$orgSlug/invoices",
    icon: IconFileInvoice,
    permission: "invoices.read",
  },
  {
    section: "storefront",
    label: "Online shop",
    to: "/$orgSlug/storefront",
    icon: IconBuildingStore,
    permission: "settings.read",
  },
  {
    section: "chat",
    label: "Ask Nomidat",
    to: "/$orgSlug/chat",
    icon: IconMessageCircle,
    permission: "dashboard.read",
  },
  {
    section: "channels",
    label: "Connected channels",
    to: "/$orgSlug/channels",
    icon: IconPlug,
    permission: "channels.read",
  },
  {
    section: "reports",
    label: "Reports",
    to: "/$orgSlug/reports",
    icon: IconChartBar,
    permission: "analytics.read",
  },
];

export const SETTINGS_NAV: DashboardNavItem = {
  section: "settings",
  label: "Settings",
  to: "/$orgSlug/settings",
  icon: IconSettings,
  permission: "settings.read",
};

export function filterDashboardNav(role: string, items: DashboardNavItem[] = DASHBOARD_NAV) {
  return items.filter((item) => canAccess(role, item.permission));
}

function navHref(to: OrgRoutePath, orgSlug: string): string {
  const section = to.slice("/$orgSlug".length);
  return `/${orgSlug}${section}`;
}

export function isNavActive(to: OrgRoutePath, orgSlug: string, pathname: string): boolean {
  const href = navHref(to, orgSlug);
  if (to === "/$orgSlug") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
