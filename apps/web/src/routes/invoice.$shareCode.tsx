import { createFileRoute } from "@tanstack/react-router";
import { PublicInvoiceView } from "@/components/invoices/public-invoice-view";

export const Route = createFileRoute("/invoice/$shareCode")({
  component: SharedInvoicePage,
});

function SharedInvoicePage() {
  const { shareCode } = Route.useParams();
  return <PublicInvoiceView shareCode={shareCode} />;
}
