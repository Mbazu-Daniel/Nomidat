import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/components/nomidat/invoices-page";

export const Route = createFileRoute("/invoices")({
  component: InvoicesPage,
});
