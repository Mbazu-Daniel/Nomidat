import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from "lucide-react";

// Mirrors the real workspace nav (dashboard-nav.ts) so the preview shows the
// product a seller would actually recognise.
const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Point of sale", icon: ShoppingCart },
  { label: "Inventory", icon: Package },
  { label: "Sales", icon: Store },
  { label: "Invoices", icon: Receipt },
  { label: "Contacts", icon: Users },
  { label: "Reports", icon: BarChart3 },
];

const stats = [
  { label: "Total revenue", value: "₦4,182,900", change: "+12.4%", up: true },
  { label: "Orders", value: "1,284", change: "+8.1%", up: true },
  { label: "Revenue", value: "₦456.54", change: "+18.2%", up: true },
  { label: "Occupancy rate", value: "78.8%", change: "-2.4%", up: false },
];

const bars = [42, 58, 34, 71, 64, 88, 52, 76, 61, 94, 70, 82];
export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_60px_-30px_color-mix(in_oklch,var(--foreground)_28%,transparent)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-primary/50" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 font-display text-xs tracking-wide text-muted-foreground">
          nomidat · Dashboard overview
        </span>
      </div>

      <div className="grid md:grid-cols-[180px_1fr]">
        <nav aria-hidden className="hidden border-r border-border p-3 md:block">
          <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
            <span className="flex size-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              N
            </span>
            <span className="text-xs font-semibold text-foreground">Acme Store</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </div>
          {nav.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                index === 0 ? "bg-primary-soft text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                Good morning, Ada
              </p>
              <p className="text-xs text-muted-foreground">Here is how today is going.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground sm:flex">
              <Search className="size-3.5" />
              Search
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border p-3">
                <dt className="truncate text-[11px] text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1.5 font-display text-lg font-semibold tracking-tight text-foreground">
                  {stat.value}
                </dd>
                <dd
                  className={cn(
                    "mt-0.5 text-[11px] font-medium",
                    stat.up ? "text-success" : "text-destructive",
                  )}
                >
                  {stat.change}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Sales over time</p>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {bars.map((height, index) => (
                  <div
                    key={index}
                    style={{ height: `${height}%` }}
                    className="flex-1 rounded-sm bg-primary/70 last:bg-primary"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Payment methods</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  { label: "Cash", share: 58 },
                  { label: "Transfer", share: 27 },
                  { label: "Card", share: 15 },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 text-muted-foreground">{row.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        style={{ width: `${row.share}%` }}
                        className="block h-full rounded-full bg-primary"
                      />
                    </span>
                    <span className="w-8 text-right text-foreground">{row.share}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Wallet className="size-3.5 shrink-0" />
              Wallet balance available for payout
            </span>
            <span className="font-display text-xs font-semibold text-foreground">₦318,400</span>
          </div>
        </div>
      </div>
    </div>
  );
}
