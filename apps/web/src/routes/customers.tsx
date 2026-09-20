import { createFileRoute } from "@tanstack/react-router";
import { BusinessListPage } from "@/components/nomidat/business-list-page";
export const Route = createFileRoute("/customers")({ component: CustomersPage });
function CustomersPage() { return <BusinessListPage section="customers" />; }
