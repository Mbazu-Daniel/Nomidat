import { createFileRoute } from "@tanstack/react-router";
import { BusinessListPage } from "@/components/nomidat/business-list-page";

export const Route = createFileRoute("/sales")({ component: SalesPage });

function SalesPage() {
  return <BusinessListPage section="sales" />;
}
