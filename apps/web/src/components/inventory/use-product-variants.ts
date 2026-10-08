import { getProductVariants, type ProductVariant } from "@/data/catalog";
import { useMemo } from "react";
import { useLoadedResource } from "@/lib/use-api-resource";

/**
 * Variants for a set of products. The API reads one product at a time, so the
 * distinct ids are fetched together and keyed for as long as that set holds.
 *
 * The sorted key is the dependency rather than the array, so a caller passing a
 * freshly-built array on every render does not refetch forever.
 */
export function useProductVariants(organizationId: string, productIds: string[]) {
  const key = useMemo(
    () => [...new Set(productIds.filter(Boolean))].sort().join(","),
    [productIds],
  );
  const loaded = useLoadedResource(
    async () => {
      const ids = key.split(",").filter(Boolean);
      if (ids.length === 0) return {} as Record<string, ProductVariant[]>;
      const results = await Promise.all(ids.map((id) => getProductVariants(organizationId, id)));
      return Object.fromEntries(ids.map((id, index) => [id, results[index]]));
    },
    [organizationId, key],
    {} as Record<string, ProductVariant[]>,
  );

  return { byProduct: loaded.data, error: loaded.error };
}