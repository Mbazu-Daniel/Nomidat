import { getWarehouses } from "@/data/inventory";
import { useAsyncResource } from "@/lib/use-api-resource";
import type { Warehouse } from "@/data/inventory";

/**
 * Warehouses for the whole inventory area. Every stock operation books goods
 * into or out of one, so each form needs the list and there is one route to it.
 */
export function useWarehouses(organizationId: string) {
  return useAsyncResource<Warehouse[]>(getWarehouses, organizationId, [], 0);
}
