import { createFileRoute } from "@tanstack/react-router";
import { getStorefrontConfig, type StorefrontConfig } from "@/data/storefront";
import { StorefrontHome } from "@/components/storefront/storefront-home";
import { storefrontMeta } from "@/components/storefront/storefront-seo";

function useStorefrontConfig() {
  return Route.useLoaderData() as StorefrontConfig | undefined;
}

async function loadStorefront({ params }: { params: { orgSlug: string } }) {
  // An unpublished or unknown shop is a 404, which is the same answer the public
  // API gives. That is carried through rather than thrown so the page can show
  // its own "shop unavailable" message instead of an error boundary.
  return getStorefrontConfig(params.orgSlug).catch(() => undefined);
}

export const Route = createFileRoute("/store/$orgSlug")({
  // Loaded here rather than inside the component so the document head can be
  // built from it. SEO that only arrives after first paint is not SEO.
  loader: loadStorefront,
  head: ({ loaderData }) => storefrontMeta(loaderData as StorefrontConfig | undefined),
  component: StorePage,
});

function StorePage() {
  const { orgSlug } = Route.useParams();
  const config = useStorefrontConfig();
  return <StorefrontHome slug={orgSlug} config={config} />;
}
