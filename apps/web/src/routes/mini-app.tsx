import { createFileRoute } from "@tanstack/react-router";
import { IconChartDonut, IconChevronRight, IconPackage, IconReceipt, IconSparkles, IconUsers, IconWallet } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { MiniAppHome } from "@/components/nomidat/mini-app-home";
import { loadMiniAppData } from "@/components/nomidat/mini-app-loader";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getBusinessData, getOrganizations, type BusinessSummary } from "@/data/nomidat";
import { createTelegramSession } from "@/lib/telegram-session";
import "@/lib/types/telegram-web-app.type";

export const Route = createFileRoute("/mini-app")({
  component: MiniAppPage,
  head: () => ({ scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }] }),
});

type View = "home" | "sales" | "customers" | "stock" | "expenses" | "more";
type BusinessRow = Awaited<ReturnType<typeof getBusinessData>>;

type MiniAppSession = {
  status: "loading" | "ready" | "error";
  message: string;
  userName: string | null;
  organizations: OrganizationOption[];
  organizationId: string;
};

type BusinessData = {
  summary: BusinessSummary | null;
  sales: BusinessRow;
  customers: BusinessRow;
  products: BusinessRow;
  expenses: BusinessRow;
  message: string;
};

function MiniAppPage() {
  const session = useTelegramSession();
  const business = useBusinessData(session.organizationId, session.status === "ready");

  if (session.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-sm text-muted-foreground">{session.message}</div>;
  }

  if (session.status === "error") {
    return <TelegramError message={session.message} />;
  }

  return (
    <MiniAppContent
      userName={session.userName}
      organizations={session.organizations}
      organizationId={session.organizationId}
      onOrganizationChange={session.setOrganizationId}
      view={business.view}
      onViewChange={business.setView}
      data={business.data}
      message={business.data.message}
    />
  );
}

function useTelegramSession(): MiniAppSession & { setOrganizationId: (id: string) => void } {
  const [status, setStatus] = useState<MiniAppSession["status"]>("loading");
  const [message, setMessage] = useState("Opening Telegram session…");
  const [userName, setUserName] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");

  useEffect(() => {
    let cancelled = false;

    void createTelegramSession(window.Telegram?.WebApp)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setStatus("error");
          setMessage(result.message);
          return;
        }

        setUserName(result.userName);
        setStatus("ready");
        setMessage("");
        return getOrganizations();
      })
      .then((items) => {
        if (cancelled || !items) return;
        const options = items.map((organization) => ({ id: organization.id, name: organization.name }));
        setOrganizations(options);
        setOrganizationId(options[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load your businesses.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, message, userName, organizations, organizationId, setOrganizationId };
}

function useBusinessData(organizationId: string, ready: boolean) {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<BusinessData>({
    summary: null,
    sales: [],
    customers: [],
    products: [],
    expenses: [],
    message: "",
  });

  useEffect(() => {
    if (!ready || !organizationId) {
      setData((current) => ({ ...current, summary: null, sales: [], customers: [], products: [], expenses: [] }));
      return;
    }

    let cancelled = false;
    void loadMiniAppData(view, organizationId)
      .then((result) => {
        if (!cancelled) setBusinessData(setData, result);
      })
      .catch(() => {
        if (!cancelled) setData((current) => ({ ...current, message: "Could not load this business data." }));
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, ready, view]);

  return { view, setView, data };
}

function setBusinessData(
  setData: React.Dispatch<React.SetStateAction<BusinessData>>,
  result: Partial<Omit<BusinessData, "message">>,
) {
  setData((current) => ({
    ...current,
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
    ...(result.sales !== undefined ? { sales: result.sales } : {}),
    ...(result.customers !== undefined ? { customers: result.customers } : {}),
    ...(result.products !== undefined ? { products: result.products } : {}),
    ...(result.expenses !== undefined ? { expenses: result.expenses } : {}),
    message: "",
  }));
}

function TelegramError({ message }: { message: string }) {
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

type MiniAppContentProps = {
  userName: string | null;
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
  view: View;
  onViewChange: (view: View) => void;
  data: BusinessData;
  message: string;
};

function MiniAppContent(props: MiniAppContentProps) {
  const views: Record<View, ReactNode> = {
    home: <MiniAppHome summary={props.data.summary} sales={props.data.sales} expenses={props.data.expenses} onNavigate={props.onViewChange} />,
    sales: <SalesView rows={props.data.sales} />,
    customers: <CustomersView rows={props.data.customers} />,
    stock: <StockView rows={props.data.products} />,
    expenses: <ExpensesView rows={props.data.expenses} />,
    more: <MoreView onNavigate={props.onViewChange} />,
  };

  return (
    <main className="min-h-screen bg-[#fffaf7] pb-24 text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-600">nomidat</p>
            <p className="mt-1 truncate text-lg font-semibold">Hi, {props.userName ?? "there"} 👋</p>
          </div>
          {props.organizations.length > 0 ? (
            <OrganizationSwitcher
              organizations={props.organizations}
              currentOrganizationId={props.organizationId}
              onChange={props.onOrganizationChange}
            />
          ) : null}
        </header>
        {props.message ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{props.message}</p> : null}
        {views[props.view]}
      </div>
      <MiniAppNav view={props.view} onViewChange={props.onViewChange} />
    </main>
  );
}

function SalesView({ rows }: { rows: BusinessRow }) {
  return (
    <ListView title="Sales" description="Recent recorded transactions.">
      {rows.length === 0 ? <EmptyMessage label="No sales recorded yet." /> : rows.map((sale) => (
        <Row key={sale.id} icon={<IconReceipt className="size-5" />} title={sale.customer ?? "Walk-in customer"} detail={sale.status ?? "Sale"} value={formatNaira((sale.totalKobo ?? 0) / 100)} />
      ))}
    </ListView>
  );
}

function CustomersView({ rows }: { rows: BusinessRow }) {
  return (
    <ListView title="Customers" description="Customers in this business.">
      {rows.length === 0 ? <EmptyMessage label="No customers recorded yet." /> : rows.map((customer) => (
        <Row key={customer.id} icon={<IconUsers className="size-5" />} title={customer.name ?? "Unnamed customer"} detail={customer.phone ?? "No phone number"} />
      ))}
    </ListView>
  );
}

function StockView({ rows }: { rows: BusinessRow }) {
  return (
    <ListView title="Inventory" description="Current stock levels.">
      {rows.length === 0 ? <EmptyMessage label="No products recorded yet." /> : rows.map((product) => (
        <StockRow key={product.id} product={product} />
      ))}
    </ListView>
  );
}

function StockRow({ product }: { product: BusinessRow[number] }) {
  const low = (product.stockQuantity ?? 0) <= (product.lowStockThreshold ?? 0);
  return (
    <Row
      icon={<IconPackage className="size-5" />}
      title={product.name ?? "Product"}
      detail={`${product.stockQuantity ?? 0} ${product.unit ?? "units"} · ${low ? "Low stock" : "Healthy"}`}
    />
  );
}

function ExpensesView({ rows }: { rows: BusinessRow }) {
  return (
    <ListView title="Expenses" description="Recent business spending.">
      {rows.length === 0 ? <EmptyMessage label="No expenses recorded yet." /> : rows.map((expense) => (
        <Row key={expense.id} icon={<IconWallet className="size-5" />} title={expense.description ?? "Expense"} detail={expense.category ?? "Uncategorised"} value={formatNaira((expense.amountKobo ?? 0) / 100)} />
      ))}
    </ListView>
  );
}

function MiniAppNav({ view, onViewChange }: { view: View; onViewChange: (view: View) => void }) {
  const items = [
    ["Home", "home", IconChartDonut],
    ["Sales", "sales", IconReceipt],
    ["Customers", "customers", IconUsers],
    ["More", "more", IconPackage],
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between">
        {items.map(([label, target, Icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => onViewChange(target)}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] ${view === target ? "bg-orange-50 text-orange-700" : "text-muted-foreground"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function EmptyMessage({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{label}</p>;
}

type ListViewProps = { title: string; description: string; children: ReactNode };
type RowProps = { icon: ReactNode; title: string; detail: string; value?: string };

function ListView({ title, description, children }: ListViewProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="border-b border-orange-100 p-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y divide-orange-100">{children}</div>
    </section>
  );
}

function Row({ icon, title, detail, value }: RowProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {value ? <p className="shrink-0 text-sm font-semibold">{value}</p> : null}
    </div>
  );
}

function MoreView({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="border-b border-orange-100 p-4">
        <h1 className="text-lg font-semibold">More</h1>
        <p className="mt-1 text-xs text-muted-foreground">Other Nomidat business tools.</p>
      </div>
      <div className="divide-y divide-orange-100">
        <button type="button" onClick={() => onNavigate("stock")} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconPackage className="size-5" /></span>
          <span className="flex-1"><span className="block text-sm font-medium">Inventory</span><span className="mt-1 block text-xs text-muted-foreground">View current stock levels</span></span>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </button>
        <button type="button" onClick={() => onNavigate("expenses")} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconWallet className="size-5" /></span>
          <span className="flex-1"><span className="block text-sm font-medium">Expenses</span><span className="mt-1 block text-xs text-muted-foreground">View recent business spending</span></span>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>
    </section>
  );
}
