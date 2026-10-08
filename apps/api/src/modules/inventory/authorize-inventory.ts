import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import type { BusinessAuthService } from "../business/business-auth.service";

/**
 * The inventory permission check, in one place.
 *
 * Four inventory controllers each declared a `read` and a `write` helper with
 * identical bodies, so the answer to "who may touch stock here" was written four
 * times and nothing tied the names to behaviour. There is no read/write split yet
 * — `inventory` is the single area — so one method that says what it guarantees.
 */
export function authorizeInventory(
  auth: BusinessAuthService,
  req: Request,
  organizationId: string,
) {
  return authorizeOrganization(auth, req, organizationId, "inventory");
}