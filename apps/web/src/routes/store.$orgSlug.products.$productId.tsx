import { createFileRoute } from "@tanstack/react-router";
import { StorefrontProduct } from "@/components/storefront/storefront-product";

export const Route = createFileRoute("/store/$orgSlug/products/$productId")({
  component: ProductPage,
});

function ProductPage() {
  const { orgSlug, productId } = Route.useParams();
  return <StorefrontProduct slug={orgSlug} productId={productId} />;
}
