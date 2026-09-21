import type { Request } from "express";
import { extractHeaders } from "./auth-http";
import type { BusinessAuthService } from "../../modules/business/business-auth.service";

export function authorizeOrganization(
  auth: BusinessAuthService,
  req: Request,
  organizationId: string,
) {
  return auth.authorize(extractHeaders(req), organizationId);
}
