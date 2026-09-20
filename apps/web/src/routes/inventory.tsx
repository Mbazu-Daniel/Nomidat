import { createFileRoute } from "@tanstack/react-router";
import { BusinessListPage } from "@/components/nomidat/business-list-page";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  return <BusinessListPage section="inventory" />;
}
