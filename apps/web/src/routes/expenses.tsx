import { createFileRoute } from "@tanstack/react-router";
import { BusinessListPage } from "@/components/nomidat/business-list-page";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  return <BusinessListPage section="expenses" />;
}
