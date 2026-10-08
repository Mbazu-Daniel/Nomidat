import { createFileRoute } from "@tanstack/react-router";
import { StorefrontCheckout } from "@/components/storefront/storefront-checkout";

export const Route = createFileRoute("/store/$orgSlug/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { orgSlug } = Route.useParams();
  return <StorefrontCheckout slug={orgSlug} />;
}
