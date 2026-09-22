// fallow-ignore-file code-duplication -- page scaffolding intentionally follows the shared Nomidat organization-page pattern.
import { IconFileInvoice } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getInvoices, getOrganizations, type InvoiceRow } from "@/data/nomidat";

export function InvoicesPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOrganizations()
      .then((result) => {
        const options = result.map((item) => ({ id: item.id, name: item.name }));
        setOrganizations(options);
        setOrganizationId(options[0]?.id ?? "");
      })
      .catch(() => setError("Could not load your businesses."));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void getInvoices(organizationId)
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError("Could not load invoices.");
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <InvoiceHeader
          organizations={organizations}
          organizationId={organizationId}
          onOrganizationChange={setOrganizationId}
        />
        {error ? <ErrorMessage message={error} /> : null}
        <InvoicesContent loading={loading} rows={rows} />
      </div>
    </main>
  );
}

function InvoiceHeader({
  organizations,
  organizationId,
  onOrganizationChange,
}: {
  organizations: OrganizationOption[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
          <IconFileInvoice className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and track invoices for your customers.</p>
      </div>
      {organizations.length > 0 ? (
        <OrganizationSwitcher
          organizations={organizations}
          currentOrganizationId={organizationId}
          onChange={onOrganizationChange}
        />
      ) : null}
    </div>
  );
}

function InvoicesContent({ loading, rows }: { loading: boolean; rows: InvoiceRow[] }) {
  if (loading) {
    return <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-muted-foreground">Loading invoices…</div>;
  }

  if (rows.length === 0) {
    return <div className="rounded-2xl border border-orange-100 bg-white p-10 text-center text-sm text-muted-foreground">No invoices created yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="divide-y divide-orange-100">
        {rows.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)}
      </div>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceRow }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
        <IconFileInvoice className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{invoice.invoiceNumber}</p>
        <p className="text-xs text-muted-foreground">
          {invoice.customer ?? "Walk-in customer"} · {new Date(invoice.createdAt).toLocaleString()}
        </p>
      </div>
      <span className="text-sm font-semibold">{formatNaira(invoice.totalKobo / 100)}</span>
      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{invoice.status}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}
